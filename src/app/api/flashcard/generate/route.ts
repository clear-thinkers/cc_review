import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeFlashcardLlmRequest,
  parseAndNormalizeFlashcardLlmResponse,
  type FlashcardLlmRequest,
} from "@/lib/flashcardLlm";
import { supabase, getServerSupabaseClient } from "@/lib/supabaseClient";
import type { PromptType } from "@/lib/supabase-service";

const DEFAULT_DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const MAX_EXAMPLE_LENGTH = 30;
const RETRY_LIMIT = 2;

// ── Hardcoded return-format suffixes (not user-editable) ───────────────────
// These are always appended to the resolved instructions at call time.
// User-customizable prompt bodies store instructions + rules ONLY.

const FULL_FORMAT_SUFFIX = `Output format:
{
  "character":"character",
  "pronunciation":"pinyin",
  "meanings":[
    {
      "definition":"meaning in Chinese",
      "definition_en":"optional English meaning",
      "phrases":[
        {"phrase":"phrase", "pinyin":"phrase pinyin", "example":"short sentence", "example_pinyin":"example sentence pinyin"}
      ]
    }
  ]
}
Return JSON only.`;

const PHRASE_FORMAT_SUFFIX = `Return JSON only:
{"phrase":"...", "pinyin":"...", "example":"...", "example_pinyin":"..."}
Do not return any extra fields.`;

const EXAMPLE_FORMAT_SUFFIX = `Return JSON only:
{"example":"...", "example_pinyin":"..."}
Do not return any extra fields.`;

const PHRASE_DETAIL_FORMAT_SUFFIX = `Return JSON only:
{"pinyin":"...", "example":"...", "example_pinyin":"..."}
Do not return any extra fields.`;

const MEANING_DETAIL_FORMAT_SUFFIX = `Return JSON only:
{"definition_en":"..."}
Do not return any extra fields.`;

const PROMPT_FORMAT_SUFFIXES: Record<PromptType, string> = {
  full: FULL_FORMAT_SUFFIX,
  phrase: PHRASE_FORMAT_SUFFIX,
  example: EXAMPLE_FORMAT_SUFFIX,
  phrase_details: PHRASE_DETAIL_FORMAT_SUFFIX,
  meaning_details: MEANING_DETAIL_FORMAT_SUFFIX,
};

// ── User-customizable instruction defaults (instructions + rules only) ───────

const FULL_SYSTEM_PROMPT = `You are a professional elementary Chinese learning assistant.
Generate JSON only for one character and one pronunciation.
Rules:
- 1-3 meanings.
- 2 phrases per meaning, prioritize common Chinese idioms.
- examples <= 30 Chinese characters.
- positive, age-appropriate content.`;

const PHRASE_SYSTEM_PROMPT = `Generate one new phrase and one matching example sentence for elementary students.
Rules:
- phrase must include the target character.
- phrase must match the pronunciation and meaning provided for that character.
- phrase length 2-4 Chinese characters.
- example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- positive and age-appropriate.`;

const EXAMPLE_SYSTEM_PROMPT = `Generate one new example sentence for elementary students.
Rules:
- sentence must naturally use the given phrase.
- sentence must be <= 30 Chinese characters.
- example_pinyin must match the sentence and include tones.
- positive and age-appropriate.`;

const PHRASE_DETAIL_SYSTEM_PROMPT = `Given a fixed phrase, generate phrase pinyin and one short example sentence for elementary students.
Rules:
- Keep the phrase unchanged.
- Pinyin must match the given phrase and include tones.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.`;

const MEANING_DETAIL_SYSTEM_PROMPT = `Given a Chinese meaning definition for elementary learners, provide a concise English translation.
Rules:
- Keep translation simple and child-friendly.
- Do not add extra explanation.`;

const EXAMPLE_PINYIN_SYSTEM_PROMPT = `Given one Chinese example sentence, provide accurate pinyin with tones.
Return JSON only:
{"example_pinyin":"..."}
Rules:
- Keep pinyin aligned to the Chinese characters in order.
- Use spaces between syllables.
- Include tones.
- do not return any extra fields.`;

/**
 * Resolves the active system prompt for a given mode and family from the DB.
 * Falls back to the hardcoded constant if no DB match is found.
 * Uses service-role client (bypasses RLS) since this runs server-side.
 */
async function resolveSystemPrompt(
  mode: PromptType,
  familyId: string | null,
  hardcodedFallback: string
): Promise<string> {
  const formatSuffix = PROMPT_FORMAT_SUFFIXES[mode];
  let instructions = hardcodedFallback;

  if (familyId) {
    try {
      const adminClient = getServerSupabaseClient();

      // Try family's active custom slot first
      const { data: customSlot } = await adminClient
        .from("prompt_templates")
        .select("prompt_body")
        .eq("family_id", familyId)
        .eq("prompt_type", mode)
        .eq("is_active", true)
        .eq("is_default", false)
        .maybeSingle();
      if (customSlot && typeof (customSlot as { prompt_body?: string }).prompt_body === "string") {
        instructions = (customSlot as { prompt_body: string }).prompt_body;
      } else {
        // Fall back to Default instructions
        const { data: defaultSlot } = await adminClient
          .from("prompt_templates")
          .select("prompt_body")
          .is("family_id", null)
          .eq("prompt_type", mode)
          .eq("is_default", true)
          .maybeSingle();
        if (defaultSlot && typeof (defaultSlot as { prompt_body?: string }).prompt_body === "string") {
          instructions = (defaultSlot as { prompt_body: string }).prompt_body;
        }
      }
    } catch (err) {
      console.warn("[generate] Failed to resolve prompt from DB, using hardcoded fallback:", err);
    }
  }

  return `${instructions}\n${formatSuffix}`;
}

/**
 * Extracts the family_id from the Authorization header JWT.
 * Returns null if the header is missing or the token is invalid.
 */
async function extractFamilyId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    const familyId = user?.app_metadata?.family_id;
    return typeof familyId === "string" && familyId ? familyId : null;
  } catch {
    return null;
  }
}

type GenerateMode = "full" | "phrase" | "example" | "phrase_details" | "meaning_details" | "example_pinyin";

type GenerateRequest = FlashcardLlmRequest & {
  mode: GenerateMode;
  meaning: string;
  meaningEn: string;
  phrase: string;
  example: string;
  existingPhrases: string[];
  existingExamples: string[];
};

type DeepSeekChoice = {
  message?: {
    content?: string;
  };
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = readString(item);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push(text);
  }
  return result;
}

function extractJsonPayload(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      // continue
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      // continue
    }
  }

  return {};
}

function readDeepSeekMessageText(payload: unknown): string {
  const source = payload as DeepSeekResponse;
  return source.choices?.[0]?.message?.content?.trim() ?? "";
}

function resolveDeepSeekEndpoint(rawEndpoint: string | undefined): string {
  const configured = (rawEndpoint ?? "").trim();
  if (!configured) {
    return DEFAULT_DEEPSEEK_API_URL;
  }

  if (!configured.startsWith("http://") && !configured.startsWith("https://")) {
    return DEFAULT_DEEPSEEK_API_URL;
  }

  if (configured.endsWith("/chat/completions")) {
    return configured;
  }

  return `${configured.replace(/\/+$/, "")}/chat/completions`;
}

function normalizeRequest(body: unknown): GenerateRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const source = body as Record<string, unknown>;
  const base = normalizeFlashcardLlmRequest(source);
  if (!base) {
    return null;
  }

  const modeRaw = readString(source.mode).toLowerCase();
  const mode: GenerateMode =
    modeRaw === "phrase" ||
    modeRaw === "example" ||
    modeRaw === "phrase_details" ||
    modeRaw === "meaning_details" ||
    modeRaw === "example_pinyin"
      ? modeRaw
      : "full";

  return {
    ...base,
    mode,
    meaning: readString(source.meaning),
    meaningEn: readString(source.meaning_en),
    phrase: readString(source.phrase),
    example: readString(source.example),
    existingPhrases: readStringArray(source.existing_phrases),
    existingExamples: readStringArray(source.existing_examples),
  };
}

async function callDeepSeek(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}): Promise<string> {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek API request failed: ${detail.slice(0, 800)}`);
  }

  return readDeepSeekMessageText((await response.json()) as unknown);
}

function buildUserPromptForFull(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    "Return JSON only.",
  ].join("\n");
}

function buildUserPromptForPhrase(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    `Meaning (ZH): ${request.meaning}`,
    request.meaningEn ? `Meaning (EN): ${request.meaningEn}` : "",
    `Existing phrases (avoid duplicates): ${request.existingPhrases.join("、") || "none"}`,
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPromptForExample(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    `Meaning (ZH): ${request.meaning}`,
    request.meaningEn ? `Meaning (EN): ${request.meaningEn}` : "",
    `Phrase: ${request.phrase}`,
    `Existing examples (avoid duplicates): ${request.existingExamples.join("、") || "none"}`,
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPromptForPhraseDetails(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    `Meaning (ZH): ${request.meaning}`,
    request.meaningEn ? `Meaning (EN): ${request.meaningEn}` : "",
    `Phrase: ${request.phrase}`,
    `Existing examples (avoid duplicates): ${request.existingExamples.join("、") || "none"}`,
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPromptForMeaningDetails(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    `Meaning (ZH): ${request.meaning}`,
    "Return JSON only.",
  ].join("\n");
}

function buildUserPromptForExamplePinyin(request: GenerateRequest): string {
  return [
    `Character: ${request.character}`,
    `Pronunciation: ${request.pronunciation}`,
    request.meaning ? `Meaning (ZH): ${request.meaning}` : "",
    request.meaningEn ? `Meaning (EN): ${request.meaningEn}` : "",
    request.phrase ? `Phrase: ${request.phrase}` : "",
    `Example: ${request.example}`,
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function isValidPhraseResponse(payload: unknown, request: GenerateRequest): payload is {
  phrase: string;
  pinyin: string;
  example: string;
  example_pinyin: string;
} {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const phrase = readString(source.phrase);
  const pinyin = readString(source.pinyin);
  const example = readString(source.example);
  const examplePinyin = readString(source.example_pinyin);
  if (!phrase || !pinyin || !example || !examplePinyin) {
    return false;
  }

  if (!phrase.includes(request.character)) {
    return false;
  }

  const phraseLength = Array.from(phrase).length;
  if (phraseLength < 2 || phraseLength > 4) {
    return false;
  }

  if (Array.from(example).length > MAX_EXAMPLE_LENGTH) {
    return false;
  }

  const phraseKey = normalizeComparableText(phrase);
  const existingPhraseKeys = request.existingPhrases.map(normalizeComparableText);
  if (existingPhraseKeys.includes(phraseKey)) {
    return false;
  }

  return true;
}

function isValidExampleResponse(
  payload: unknown,
  request: GenerateRequest
): payload is { example: string; example_pinyin: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const example = readString(source.example);
  const examplePinyin = readString(source.example_pinyin);
  if (!example || !examplePinyin) {
    return false;
  }

  if (Array.from(example).length > MAX_EXAMPLE_LENGTH) {
    return false;
  }

  if (request.existingExamples.includes(example)) {
    return false;
  }

  return request.phrase ? example.includes(request.phrase) : true;
}

function isValidPhraseDetailResponse(
  payload: unknown,
  request: GenerateRequest
): payload is { pinyin: string; example: string; example_pinyin: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const pinyin = readString(source.pinyin);
  const example = readString(source.example);
  const examplePinyin = readString(source.example_pinyin);
  if (!pinyin || !example || !examplePinyin) {
    return false;
  }

  if (Array.from(example).length > MAX_EXAMPLE_LENGTH) {
    return false;
  }

  if (request.existingExamples.includes(example)) {
    return false;
  }

  return true;
}

function isValidMeaningDetailResponse(payload: unknown): payload is { definition_en: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const definitionEn = readString(source.definition_en);
  return Boolean(definitionEn);
}

function isValidExamplePinyinResponse(payload: unknown): payload is { example_pinyin: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const examplePinyin = readString(source.example_pinyin);
  return Boolean(examplePinyin);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY. Add it to your environment to enable phrase/example generation." },
      { status: 503 }
    );
  }

  const familyId = await extractFamilyId(request);

  let parsedRequest: GenerateRequest | null = null;
  try {
    parsedRequest = normalizeRequest((await request.json()) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!parsedRequest) {
    return NextResponse.json({ error: "Invalid flashcard generation request payload." }, { status: 400 });
  }

  if (parsedRequest.mode === "phrase" && !parsedRequest.meaning) {
    return NextResponse.json({ error: "Phrase regeneration requires a meaning." }, { status: 400 });
  }

  if (parsedRequest.mode === "example" && (!parsedRequest.meaning || !parsedRequest.phrase)) {
    return NextResponse.json({ error: "Example regeneration requires meaning and phrase." }, { status: 400 });
  }

  if (parsedRequest.mode === "phrase_details" && (!parsedRequest.meaning || !parsedRequest.phrase)) {
    return NextResponse.json(
      { error: "Phrase detail generation requires meaning and phrase." },
      { status: 400 }
    );
  }

  if (parsedRequest.mode === "meaning_details" && !parsedRequest.meaning) {
    return NextResponse.json(
      { error: "Meaning detail generation requires a meaning." },
      { status: 400 }
    );
  }

  if (parsedRequest.mode === "example_pinyin" && !parsedRequest.example) {
    return NextResponse.json(
      { error: "Example pinyin generation requires an example sentence." },
      { status: 400 }
    );
  }

  const endpoint = resolveDeepSeekEndpoint(process.env.DEEPSEEK_API_URL);
  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;

  try {
    if (parsedRequest.mode === "phrase") {
      const phraseSystemPrompt = await resolveSystemPrompt("phrase", familyId, PHRASE_SYSTEM_PROMPT);
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        const message = await callDeepSeek({
          endpoint,
          apiKey,
          model,
          systemPrompt: phraseSystemPrompt,
          userPrompt: buildUserPromptForPhrase(parsedRequest),
          temperature: 0.6,
        });
        const payload = extractJsonPayload(message);
        if (isValidPhraseResponse(payload, parsedRequest)) {
          return NextResponse.json({
            phrase: payload.phrase,
            pinyin: payload.pinyin,
            example: payload.example,
            example_pinyin: payload.example_pinyin,
            model,
          });
        }
      }

      return NextResponse.json(
        { error: "Failed to generate a valid non-duplicate phrase after retries." },
        { status: 502 }
      );
    }

    if (parsedRequest.mode === "example") {
      const exampleSystemPrompt = await resolveSystemPrompt("example", familyId, EXAMPLE_SYSTEM_PROMPT);
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        const message = await callDeepSeek({
          endpoint,
          apiKey,
          model,
          systemPrompt: exampleSystemPrompt,
          userPrompt: buildUserPromptForExample(parsedRequest),
          temperature: 0.6,
        });
        const payload = extractJsonPayload(message);
        if (isValidExampleResponse(payload, parsedRequest)) {
          return NextResponse.json({
            example: payload.example,
            example_pinyin: payload.example_pinyin,
            model,
          });
        }
      }

      return NextResponse.json(
        { error: "Failed to generate a valid non-duplicate example after retries." },
        { status: 502 }
      );
    }

    if (parsedRequest.mode === "phrase_details") {
      const phraseDetailSystemPrompt = await resolveSystemPrompt("phrase_details", familyId, PHRASE_DETAIL_SYSTEM_PROMPT);
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        const message = await callDeepSeek({
          endpoint,
          apiKey,
          model,
          systemPrompt: phraseDetailSystemPrompt,
          userPrompt: buildUserPromptForPhraseDetails(parsedRequest),
          temperature: 0.4,
        });
        const payload = extractJsonPayload(message);
        if (isValidPhraseDetailResponse(payload, parsedRequest)) {
          return NextResponse.json({
            pinyin: payload.pinyin,
            example: payload.example,
            example_pinyin: payload.example_pinyin,
            model,
          });
        }
      }

      return NextResponse.json(
        { error: "Failed to generate valid pinyin/example for phrase after retries." },
        { status: 502 }
      );
    }

    if (parsedRequest.mode === "meaning_details") {
      const meaningDetailSystemPrompt = await resolveSystemPrompt("meaning_details", familyId, MEANING_DETAIL_SYSTEM_PROMPT);
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        const message = await callDeepSeek({
          endpoint,
          apiKey,
          model,
          systemPrompt: meaningDetailSystemPrompt,
          userPrompt: buildUserPromptForMeaningDetails(parsedRequest),
          temperature: 0.2,
        });
        const payload = extractJsonPayload(message);
        if (isValidMeaningDetailResponse(payload)) {
          return NextResponse.json({ definition_en: payload.definition_en, model });
        }
      }

      return NextResponse.json(
        { error: "Failed to generate English meaning after retries." },
        { status: 502 }
      );
    }

    if (parsedRequest.mode === "example_pinyin") {
      for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
        const message = await callDeepSeek({
          endpoint,
          apiKey,
          model,
          systemPrompt: EXAMPLE_PINYIN_SYSTEM_PROMPT,
          userPrompt: buildUserPromptForExamplePinyin(parsedRequest),
          temperature: 0.2,
        });
        const payload = extractJsonPayload(message);
        if (isValidExamplePinyinResponse(payload)) {
          return NextResponse.json({ example_pinyin: payload.example_pinyin, model });
        }
      }

      return NextResponse.json(
        { error: "Failed to generate example pinyin after retries." },
        { status: 502 }
      );
    }

    const fullSystemPrompt = await resolveSystemPrompt("full", familyId, FULL_SYSTEM_PROMPT);
    const message = await callDeepSeek({
      endpoint,
      apiKey,
      model,
      systemPrompt: fullSystemPrompt,
      userPrompt: buildUserPromptForFull(parsedRequest),
      temperature: 0.4,
    });
    const normalized = parseAndNormalizeFlashcardLlmResponse(message, parsedRequest);
    return NextResponse.json({ ...normalized, model });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate flashcard content.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
