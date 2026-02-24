type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const LOCAL_DATA_PATHS = {
  word: "/data/word.json",
  ci: "/data/ci.json",
  idiom: "/data/idiom.json",
  xiehouyu: "/data/xiehouyu.json",
} as const;

const DEFAULT_CI_LIMIT = 5;
const DEFAULT_IDIOM_LIMIT = 2;
const DEFAULT_XIEHOUYU_LIMIT = 2;

export type XinhuaWordEntry = {
  word: string;
  oldword?: string;
  pinyin?: string;
  explanation?: string;
  radicals?: string;
  strokes?: string | number;
  more?: string;
};

export type XinhuaCiEntry = {
  ci: string;
  explanation?: string;
};

export type XinhuaIdiomEntry = {
  word: string;
  pinyin?: string;
  explanation?: string;
  example?: string;
  derivation?: string;
  abbreviation?: string;
};

export type XinhuaXiehouyuEntry = {
  riddle?: string;
  answer?: string;
};

export type XinhuaDataset = {
  word: XinhuaWordEntry[];
  ci: XinhuaCiEntry[];
  idiom: XinhuaIdiomEntry[];
  xiehouyu: XinhuaXiehouyuEntry[];
};

export type XinhuaFlashcardPhrase = {
  text: string;
  explanation: string;
};

export type XinhuaFlashcardIdiom = {
  text: string;
  pinyin: string[];
  explanation: string;
  example: string;
  derivation: string;
  abbreviation: string;
};

export type XinhuaFlashcardXiehouyu = {
  riddle: string;
  answer: string;
};

export type XinhuaFlashcardExample = {
  sentence: string;
  source: "xinhua_idiom" | "llm_pending" | "none";
  reference: string | null;
};

export type XinhuaFlashcardInfo = {
  word: string;
  pinyin: string[];
  explanation: string;
  radicals: string;
  strokes: string;
  oldword: string;
  more: string;
  ci: XinhuaFlashcardPhrase[];
  idiom: XinhuaFlashcardIdiom[];
  xiehouyu: XinhuaFlashcardXiehouyu[];
  example: XinhuaFlashcardExample;
  wordEntry: XinhuaWordEntry | null;
  ciEntries: XinhuaCiEntry[];
  idiomEntries: XinhuaIdiomEntry[];
  xiehouyuEntries: XinhuaXiehouyuEntry[];
};

export type XinhuaFlashcardQueryOptions = {
  ciLimit?: number;
  idiomLimit?: number;
  xiehouyuLimit?: number;
  includeAllMatches?: boolean;
};

let datasetCache: XinhuaDataset | null = null;
let datasetPromise: Promise<XinhuaDataset> | null = null;
const flashcardCache = new Map<string, XinhuaFlashcardInfo | null>();

function normalizeText(value: string | undefined): string {
  return value ? value.trim() : "";
}

function ensureArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label} data. Expected an array.`);
  }

  return value as T[];
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return fallback;
  }

  const normalized = Math.floor(limit);
  if (normalized < 0) {
    return 0;
  }

  return normalized;
}

function splitPinyin(raw: string | undefined): string[] {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  const parts = normalized
    .replace(/\r?\n/g, " ")
    .split(/[,\s;/、，；]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (!seen.has(part)) {
      seen.add(part);
      result.push(part);
    }
  }

  return result;
}

function containsCharacter(text: string, character: string): boolean {
  return normalizeText(text).includes(character);
}

function normalizeCharacter(character: string): string {
  const trimmed = character.trim();
  if (!trimmed) {
    return "";
  }

  return Array.from(trimmed)[0] ?? "";
}

function rankPhrase(text: string, index: number): number {
  const length = Array.from(text).length;
  const shortWordDistance = Math.abs(length - 2);
  return shortWordDistance * 10 + Math.min(index, 9);
}

function dedupeByText<T>(items: T[], getText: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const text = normalizeText(getText(item));
    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    result.push(item);
  }

  return result;
}

function selectCiEntries(dataset: XinhuaDataset, character: string, limit: number): XinhuaCiEntry[] {
  const matches = dataset.ci
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => containsCharacter(entry.ci, character));

  const deduped = dedupeByText(matches, (item) => item.entry.ci);
  const sorted = deduped.sort((left, right) => {
    const leftText = normalizeText(left.entry.ci);
    const rightText = normalizeText(right.entry.ci);
    const leftScore = rankPhrase(leftText, left.index);
    const rightScore = rankPhrase(rightText, right.index);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.index - right.index;
  });

  return sorted.slice(0, limit).map(({ entry }) => ({
    ci: normalizeText(entry.ci),
    explanation: normalizeText(entry.explanation),
  }));
}

function selectIdiomEntries(dataset: XinhuaDataset, character: string, limit: number): XinhuaIdiomEntry[] {
  const matches = dataset.idiom
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => containsCharacter(entry.word, character));
  const deduped = dedupeByText(matches, (item) => item.entry.word);

  return deduped.slice(0, limit).map(({ entry }) => ({
    word: normalizeText(entry.word),
    pinyin: normalizeText(entry.pinyin),
    explanation: normalizeText(entry.explanation),
    example: normalizeText(entry.example),
    derivation: normalizeText(entry.derivation),
    abbreviation: normalizeText(entry.abbreviation),
  }));
}

function selectXiehouyuEntries(
  dataset: XinhuaDataset,
  character: string,
  limit: number
): XinhuaXiehouyuEntry[] {
  const matches = dataset.xiehouyu
    .filter((entry) => containsCharacter(entry.riddle ?? "", character) || containsCharacter(entry.answer ?? "", character))
    .slice(0, limit);

  return matches.map((entry) => ({
    riddle: normalizeText(entry.riddle),
    answer: normalizeText(entry.answer),
  }));
}

function buildExample(ci: XinhuaCiEntry[], idiom: XinhuaIdiomEntry[]): XinhuaFlashcardExample {
  const idiomWithExample = idiom.find((entry) => Boolean(entry.example));
  if (idiomWithExample) {
    return {
      sentence: normalizeText(idiomWithExample.example),
      source: "xinhua_idiom",
      reference: normalizeText(idiomWithExample.word),
    };
  }

  const firstCi = ci[0];
  if (firstCi) {
    return {
      sentence: "",
      source: "llm_pending",
      reference: normalizeText(firstCi.ci),
    };
  }

  const firstIdiom = idiom[0];
  if (firstIdiom) {
    return {
      sentence: "",
      source: "llm_pending",
      reference: normalizeText(firstIdiom.word),
    };
  }

  return {
    sentence: "",
    source: "none",
    reference: null,
  };
}

async function fetchJson<T>(path: string, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(path, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadXinhuaDataset(fetcher: Fetcher = fetch): Promise<XinhuaDataset> {
  if (datasetCache) {
    return datasetCache;
  }

  if (datasetPromise) {
    return datasetPromise;
  }

  datasetPromise = Promise.all([
    fetchJson<unknown>(LOCAL_DATA_PATHS.word, fetcher),
    fetchJson<unknown>(LOCAL_DATA_PATHS.ci, fetcher),
    fetchJson<unknown>(LOCAL_DATA_PATHS.idiom, fetcher),
    fetchJson<unknown>(LOCAL_DATA_PATHS.xiehouyu, fetcher),
  ])
    .then(([wordRaw, ciRaw, idiomRaw, xiehouyuRaw]) => {
      const dataset: XinhuaDataset = {
        word: ensureArray<XinhuaWordEntry>(wordRaw, "word.json"),
        ci: ensureArray<XinhuaCiEntry>(ciRaw, "ci.json"),
        idiom: ensureArray<XinhuaIdiomEntry>(idiomRaw, "idiom.json"),
        xiehouyu: ensureArray<XinhuaXiehouyuEntry>(xiehouyuRaw, "xiehouyu.json"),
      };

      datasetCache = dataset;
      return dataset;
    })
    .finally(() => {
      datasetPromise = null;
    });

  return datasetPromise;
}

export function buildXinhuaFlashcardInfo(
  dataset: XinhuaDataset,
  characterInput: string,
  options: XinhuaFlashcardQueryOptions = {}
): XinhuaFlashcardInfo | null {
  const character = normalizeCharacter(characterInput);
  if (!character) {
    return null;
  }

  const includeAllMatches = Boolean(options.includeAllMatches);
  const ciLimit = includeAllMatches ? Number.POSITIVE_INFINITY : clampLimit(options.ciLimit, DEFAULT_CI_LIMIT);
  const idiomLimit = includeAllMatches
    ? Number.POSITIVE_INFINITY
    : clampLimit(options.idiomLimit, DEFAULT_IDIOM_LIMIT);
  const xiehouyuLimit = includeAllMatches
    ? Number.POSITIVE_INFINITY
    : clampLimit(options.xiehouyuLimit, DEFAULT_XIEHOUYU_LIMIT);

  const wordEntry = dataset.word.find((entry) => normalizeText(entry.word) === character);
  const ciEntries = ciLimit > 0 ? selectCiEntries(dataset, character, ciLimit) : [];
  const idiomEntries = idiomLimit > 0 ? selectIdiomEntries(dataset, character, idiomLimit) : [];
  const xiehouyuEntries = xiehouyuLimit > 0 ? selectXiehouyuEntries(dataset, character, xiehouyuLimit) : [];

  if (!wordEntry && ciEntries.length === 0 && idiomEntries.length === 0 && xiehouyuEntries.length === 0) {
    return null;
  }

  return {
    word: character,
    pinyin: splitPinyin(wordEntry?.pinyin),
    explanation: normalizeText(wordEntry?.explanation),
    radicals: normalizeText(wordEntry?.radicals),
    strokes: normalizeText(
      typeof wordEntry?.strokes === "number" ? String(wordEntry.strokes) : wordEntry?.strokes
    ),
    oldword: normalizeText(wordEntry?.oldword),
    more: normalizeText(wordEntry?.more),
    ci: ciEntries.map((entry) => ({
      text: normalizeText(entry.ci),
      explanation: normalizeText(entry.explanation),
    })),
    idiom: idiomEntries.map((entry) => ({
      text: normalizeText(entry.word),
      pinyin: splitPinyin(entry.pinyin),
      explanation: normalizeText(entry.explanation),
      example: normalizeText(entry.example),
      derivation: normalizeText(entry.derivation),
      abbreviation: normalizeText(entry.abbreviation),
    })),
    xiehouyu: xiehouyuEntries.map((entry) => ({
      riddle: normalizeText(entry.riddle),
      answer: normalizeText(entry.answer),
    })),
    example: buildExample(ciEntries, idiomEntries),
    wordEntry: wordEntry
      ? {
          word: normalizeText(wordEntry.word),
          oldword: normalizeText(wordEntry.oldword),
          pinyin: normalizeText(wordEntry.pinyin),
          explanation: normalizeText(wordEntry.explanation),
          radicals: normalizeText(wordEntry.radicals),
          strokes: normalizeText(
            typeof wordEntry.strokes === "number" ? String(wordEntry.strokes) : wordEntry.strokes
          ),
          more: normalizeText(wordEntry.more),
        }
      : null,
    ciEntries,
    idiomEntries,
    xiehouyuEntries,
  };
}

export async function getXinhuaFlashcardInfo(
  characterInput: string,
  options: XinhuaFlashcardQueryOptions = {},
  fetcher: Fetcher = fetch
): Promise<XinhuaFlashcardInfo | null> {
  const normalizedCharacter = normalizeCharacter(characterInput);
  if (!normalizedCharacter) {
    return null;
  }

  const includeAllMatches = Boolean(options.includeAllMatches);
  const ciLimit = includeAllMatches ? Number.POSITIVE_INFINITY : clampLimit(options.ciLimit, DEFAULT_CI_LIMIT);
  const idiomLimit = includeAllMatches
    ? Number.POSITIVE_INFINITY
    : clampLimit(options.idiomLimit, DEFAULT_IDIOM_LIMIT);
  const xiehouyuLimit = includeAllMatches
    ? Number.POSITIVE_INFINITY
    : clampLimit(options.xiehouyuLimit, DEFAULT_XIEHOUYU_LIMIT);
  const cacheKey = `${normalizedCharacter}|${ciLimit}|${idiomLimit}|${xiehouyuLimit}|all:${includeAllMatches}`;

  if (flashcardCache.has(cacheKey)) {
    return flashcardCache.get(cacheKey) ?? null;
  }

  const dataset = await loadXinhuaDataset(fetcher);
  const info = buildXinhuaFlashcardInfo(dataset, normalizedCharacter, {
    ciLimit,
    idiomLimit,
    xiehouyuLimit,
    includeAllMatches,
  });

  flashcardCache.set(cacheKey, info);
  return info;
}

export function resetXinhuaCachesForTests(): void {
  datasetCache = null;
  datasetPromise = null;
  flashcardCache.clear();
}
