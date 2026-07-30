import { NextResponse, type NextRequest } from "next/server";
import { supabase, getServerSupabaseClient } from "@/lib/supabaseClient";

const DEFAULT_DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const MAX_EXAMPLE_LENGTH = 30;
const RETRY_LIMIT = 2;

// One-shot generation: given just the phrase text, return a Chinese
// definition, an English definition, pinyin, one example, and example
// pinyin in a single call. Flatter than the character generation route
// (src/app/api/flashcard/generate/route.ts) because a vocab phrase has no
// nested meaning/phrase hierarchy to regenerate piecemeal — see
// docs/feature-specs/2026-07-26-phrase-keyed-input.md.

const VOCAB_PHRASE_FORMAT_SUFFIX = `Return JSON only:
{"meaning_zh":"...", "meaning_en":"...", "pinyin":"...", "example":"...", "example_pinyin":"..."}
Do not return any extra fields.`;

const VOCAB_PHRASE_SYSTEM_PROMPT = `Given a fixed Chinese phrase for elementary students, generate a concise Chinese definition, a concise English definition, its pinyin, and one example sentence.
Rules:
- Keep the phrase unchanged.
- meaning_zh must be a simple, child-friendly Chinese definition of the phrase.
- meaning_en must be a simple, child-friendly English definition of the phrase.
- Pinyin must match the given phrase and include tones.
- Example must naturally include the exact phrase.
- Example must be <= 30 Chinese characters.
- example_pinyin must match the example and include tones.
- Positive and age-appropriate.`;

// Narrow mode: given only a Chinese sentence the parent just typed by hand
// (manual "+ Example" add, or editing one example's Chinese text), fill in
// just its pinyin — never touches the phrase's own pinyin/definitions or
// any other example. Generic prompt, no phrase context needed; mirrors
// EXAMPLE_PINYIN_SYSTEM_PROMPT in the character route exactly, since pinyin
// generation for a fixed sentence has no phrase/character coupling.
const EXAMPLE_PINYIN_SYSTEM_PROMPT = `Given one Chinese example sentence, provide accurate pinyin with tones.
Rules:
- Keep pinyin aligned to the Chinese characters in order.
- Use spaces between syllables.
- Include tones.`;

const EXAMPLE_PINYIN_FORMAT_SUFFIX = `Return JSON only:
{"example_pinyin":"..."}
Do not return any extra fields.`;

/**
 * Resolves the active vocab_phrase system prompt for this family from the
 * DB. Falls back to the hardcoded constant if no DB match is found — same
 * pattern as resolveSystemPrompt in the character generate route.
 */
async function resolveSystemPrompt(familyId: string | null): Promise<string> {
  let instructions = VOCAB_PHRASE_SYSTEM_PROMPT;

  if (familyId) {
    try {
      const adminClient = getServerSupabaseClient();

      const { data: customSlot } = await adminClient
        .from("prompt_templates")
        .select("prompt_body")
        .eq("family_id", familyId)
        .eq("prompt_type", "vocab_phrase")
        .eq("is_active", true)
        .eq("is_default", false)
        .maybeSingle();
      if (customSlot && typeof (customSlot as { prompt_body?: string }).prompt_body === "string") {
        instructions = (customSlot as { prompt_body: string }).prompt_body;
      } else {
        const { data: defaultSlot } = await adminClient
          .from("prompt_templates")
          .select("prompt_body")
          .is("family_id", null)
          .eq("prompt_type", "vocab_phrase")
          .eq("is_default", true)
          .maybeSingle();
        if (defaultSlot && typeof (defaultSlot as { prompt_body?: string }).prompt_body === "string") {
          instructions = (defaultSlot as { prompt_body: string }).prompt_body;
        }
      }
    } catch (err) {
      console.warn("[vocab-phrase/generate] Failed to resolve prompt from DB, using hardcoded fallback:", err);
    }
  }

  return `${instructions}\n${VOCAB_PHRASE_FORMAT_SUFFIX}`;
}

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

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

type DeepSeekChoice = { message?: { content?: string } };
type DeepSeekResponse = { choices?: DeepSeekChoice[] };

function readDeepSeekMessageText(payload: unknown): string {
  const source = payload as DeepSeekResponse;
  return source.choices?.[0]?.message?.content?.trim() ?? "";
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

function buildUserPrompt(phrase: string, existingExamples: string[]): string {
  return [
    `Phrase: ${phrase}`,
    `Existing examples (avoid duplicating any of these): ${existingExamples.join("、") || "none"}`,
    "Return JSON only.",
  ].join("\n");
}

function isValidVocabPhraseResponse(
  payload: unknown,
  phrase: string,
  existingExamples: string[]
): payload is {
  meaning_zh: string;
  meaning_en: string;
  pinyin: string;
  example: string;
  example_pinyin: string;
} {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const source = payload as Record<string, unknown>;
  const meaningZh = readString(source.meaning_zh);
  const meaningEn = readString(source.meaning_en);
  const pinyin = readString(source.pinyin);
  const example = readString(source.example);
  const examplePinyin = readString(source.example_pinyin);
  if (!meaningZh || !meaningEn || !pinyin || !example || !examplePinyin) {
    return false;
  }

  if (!example.includes(phrase)) {
    return false;
  }

  if (Array.from(example).length > MAX_EXAMPLE_LENGTH) {
    return false;
  }

  if (existingExamples.includes(example)) {
    return false;
  }

  return true;
}

function isValidExamplePinyinResponse(payload: unknown): payload is { example_pinyin: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const examplePinyin = readString((payload as Record<string, unknown>).example_pinyin);
  return Boolean(examplePinyin);
}

async function handleExamplePinyinMode(
  example: string,
  apiKey: string,
  endpoint: string,
  model: string
): Promise<NextResponse> {
  const examplePinyinLength = Array.from(example).length;
  if (!example || examplePinyinLength > MAX_EXAMPLE_LENGTH) {
    return NextResponse.json(
      { error: "A non-empty example sentence (<= 30 Chinese characters) is required." },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
    const message = await callDeepSeek({
      endpoint,
      apiKey,
      model,
      systemPrompt: `${EXAMPLE_PINYIN_SYSTEM_PROMPT}\n${EXAMPLE_PINYIN_FORMAT_SUFFIX}`,
      userPrompt: `Example: ${example}\nReturn JSON only.`,
      temperature: 0.2,
    });
    const payload = extractJsonPayload(message);
    if (isValidExamplePinyinResponse(payload)) {
      return NextResponse.json({ example_pinyin: payload.example_pinyin, model });
    }
  }

  return NextResponse.json({ error: "Failed to generate example pinyin after retries." }, { status: 502 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY. Add it to your environment to enable phrase generation." },
      { status: 503 }
    );
  }

  const familyId = await extractFamilyId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = readString((body as Record<string, unknown> | null)?.mode);
  const endpoint = resolveDeepSeekEndpoint(process.env.DEEPSEEK_API_URL);
  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;

  if (mode === "example_pinyin") {
    const example = readString((body as Record<string, unknown> | null)?.example);
    try {
      return await handleExamplePinyinMode(example, apiKey, endpoint, model);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to generate example pinyin.",
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 502 }
      );
    }
  }

  const phrase = readString((body as Record<string, unknown> | null)?.phrase);
  const phraseLength = Array.from(phrase).length;
  if (!phrase || phraseLength < 2 || phraseLength > 10) {
    return NextResponse.json(
      { error: "A phrase between 2 and 10 Chinese characters is required." },
      { status: 400 }
    );
  }
  const existingExamples = readStringArray((body as Record<string, unknown> | null)?.existing_examples);

  try {
    const systemPrompt = await resolveSystemPrompt(familyId);
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
      const message = await callDeepSeek({
        endpoint,
        apiKey,
        model,
        systemPrompt,
        userPrompt: buildUserPrompt(phrase, existingExamples),
        temperature: 0.4,
      });
      const payload = extractJsonPayload(message);
      if (isValidVocabPhraseResponse(payload, phrase, existingExamples)) {
        return NextResponse.json({
          meaning_zh: payload.meaning_zh,
          meaning_en: payload.meaning_en,
          pinyin: payload.pinyin,
          example: payload.example,
          example_pinyin: payload.example_pinyin,
          model,
        });
      }
    }

    return NextResponse.json(
      { error: "Failed to generate valid phrase content after retries." },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate vocab phrase content.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
