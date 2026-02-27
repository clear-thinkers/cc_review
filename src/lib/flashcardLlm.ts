const MAX_MEANINGS = 3;
const MIN_MEANINGS = 1;
const MAX_PHRASES_PER_MEANING = 2;
const MAX_EXAMPLE_LENGTH = 30;

const UNSAFE_CONTENT_PATTERN =
  /(æš´åŠ›|æ‰“æž¶|æ–—æ®´|äº‰åµ|ææƒ§|å®³æ€•|ç„¦è™‘|ä½œå¼Š|æ’’è°Ž|å·æ‡’|çŽ©ç«|å±é™©|è‰²æƒ…|æ¯’å“|èµŒåš|ä»‡æ¨|ä¸æ–‡æ˜Ž)/;

export type FlashcardLlmRequest = {
  character: string;
  pronunciation: string;
};

export type FlashcardMeaningPhrase = {
  phrase: string;
  pinyin: string;
  example: string;
  example_pinyin?: string;
  include_in_fill_test?: boolean;
};

export type FlashcardMeaning = {
  definition: string;
  definition_en?: string;
  phrases: FlashcardMeaningPhrase[];
};

export type FlashcardLlmResponse = {
  character: string;
  pronunciation: string;
  meanings: FlashcardMeaning[];
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dedupeByKey<T>(values: T[], keyOf: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = keyOf(value);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function isChinesePhraseLengthValid(phrase: string): boolean {
  const length = Array.from(phrase).length;
  return length >= 2 && length <= 4;
}

function isExampleLengthValid(example: string): boolean {
  return Array.from(example).length <= MAX_EXAMPLE_LENGTH;
}

function hasUnsafeContent(text: string): boolean {
  return UNSAFE_CONTENT_PATTERN.test(text);
}

function readIncludeInFillTest(source: Record<string, unknown>): boolean {
  if (typeof source.include_in_fill_test === "boolean") {
    return source.include_in_fill_test;
  }

  if (typeof source.includeInFillTest === "boolean") {
    return source.includeInFillTest;
  }

  return true;
}

function normalizePhrase(raw: unknown, character: string): FlashcardMeaningPhrase | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const phrase = readString(source.phrase);
  const pinyin = readString(source.pinyin);
  const example = readString(source.example);
  const examplePinyin =
    typeof source.example_pinyin === "string"
      ? source.example_pinyin.trim()
      : typeof source.examplePinyin === "string"
        ? source.examplePinyin.trim()
        : "";
  const includeInFillTest = readIncludeInFillTest(source);

  if (!phrase || !pinyin || !example) {
    return null;
  }

  if (!phrase.includes(character)) {
    return null;
  }

  if (!isChinesePhraseLengthValid(phrase)) {
    return null;
  }

  if (!isExampleLengthValid(example)) {
    return null;
  }

  if (
    hasUnsafeContent(phrase) ||
    hasUnsafeContent(example) ||
    hasUnsafeContent(character)
  ) {
    return null;
  }

  return {
    phrase,
    pinyin,
    example,
    ...(examplePinyin ? { example_pinyin: examplePinyin } : {}),
    include_in_fill_test: includeInFillTest,
  };
}

function normalizeMeaning(raw: unknown, character: string): FlashcardMeaning | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const definition = readString(source.definition);
  const definitionEn = readString(source.definition_en);
  const phrases = dedupeByKey(
    readArray(source.phrases)
      .map((phrase) => normalizePhrase(phrase, character))
      .filter((phrase): phrase is FlashcardMeaningPhrase => phrase !== null),
    (phrase) => `${phrase.phrase}|${phrase.example}`
  ).slice(0, MAX_PHRASES_PER_MEANING);

  if (!definition || hasUnsafeContent(definition)) {
    return null;
  }

  if (phrases.length < MAX_PHRASES_PER_MEANING) {
    return null;
  }

  return {
    definition,
    ...(definitionEn ? { definition_en: definitionEn } : {}),
    phrases,
  };
}

function extractJsonPayload(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]) as unknown;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }

  return {};
}

export function buildFlashcardLlmRequestKey(request: FlashcardLlmRequest): string {
  return `${request.character}|${request.pronunciation}`;
}

export function normalizeFlashcardLlmRequest(raw: unknown): FlashcardLlmRequest | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const characterRaw = readString(source.character);
  const pronunciation = readString(source.pronunciation);
  if (!characterRaw || !pronunciation) {
    return null;
  }

  return {
    character: Array.from(characterRaw)[0] ?? characterRaw,
    pronunciation,
  };
}

export function normalizeFlashcardLlmResponse(raw: unknown, request: FlashcardLlmRequest): FlashcardLlmResponse {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const meanings = dedupeByKey(
    readArray(source.meanings)
      .map((meaning) => normalizeMeaning(meaning, request.character))
      .filter((meaning): meaning is FlashcardMeaning => meaning !== null),
    (meaning) => meaning.definition
  ).slice(0, MAX_MEANINGS);

  return {
    character: request.character,
    pronunciation: request.pronunciation,
    meanings: meanings.slice(0, Math.max(MIN_MEANINGS, meanings.length)),
  };
}

export function parseAndNormalizeFlashcardLlmResponse(
  rawText: string,
  request: FlashcardLlmRequest
): FlashcardLlmResponse {
  const payload = extractJsonPayload(rawText);
  return normalizeFlashcardLlmResponse(payload, request);
}

