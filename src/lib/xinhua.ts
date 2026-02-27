type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const LOCAL_DATA_PATHS = {
  detail: "/data/char_detail.json",
} as const;

export type DictionaryExplanationEntry = {
  content?: string;
  explanation?: string;
  text?: string;
  example?: string;
  hansi?: string;
  detail?: Array<{ text?: string }>;
  words?: Array<{ word?: string; text?: string; example?: string }>;
};

export type DictionaryPronunciationEntry = {
  pinyin?: string;
  explanations?: DictionaryExplanationEntry[];
};

export type DictionaryDetailEntry = {
  char: string;
  pronunciations?: DictionaryPronunciationEntry[];
  word?: DictionaryPronunciationEntry[];
};

export type XinhuaDataset = {
  detail: DictionaryDetailEntry[];
};

export type XinhuaFlashcardPronunciation = {
  pinyin: string;
  explanations: string[];
};

export type XinhuaFlashcardInfo = {
  word: string;
  pinyin: string[];
  pronunciations: XinhuaFlashcardPronunciation[];
};

export type XinhuaFlashcardQueryOptions = {
  includeAllMatches?: boolean;
};

let datasetCache: XinhuaDataset | null = null;
let datasetPromise: Promise<XinhuaDataset> | null = null;
const flashcardCache = new Map<string, XinhuaFlashcardInfo | null>();

function normalizeText(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label} data. Expected an array.`);
  }

  return value as T[];
}

function normalizeCharacter(character: string): string {
  const trimmed = character.trim();
  if (!trimmed) {
    return "";
  }

  return Array.from(trimmed)[0] ?? "";
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function parseDatasetArray<T>(raw: string, label: string): T[] {
  const source = raw.replace(/^\uFEFF/, "").trim();
  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source) as unknown;
    return ensureArray<T>(parsed, label);
  } catch {
    // Some source files are line-separated objects with trailing commas.
  }

  try {
    const wrapped = `[${source.replace(/,\s*$/, "")}]`;
    const parsed = JSON.parse(wrapped) as unknown;
    return ensureArray<T>(parsed, label);
  } catch {
    // Fall through to line parser for better resilience.
  }

  const parsedLines: T[] = [];
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleanLine = line.replace(/,\s*$/, "");
    if (!cleanLine) {
      continue;
    }

    parsedLines.push(JSON.parse(cleanLine) as T);
  }

  if (parsedLines.length > 0) {
    return parsedLines;
  }

  throw new Error(`Invalid ${label} data. Could not parse dataset payload.`);
}

async function fetchDatasetArray<T>(path: string, label: string, fetcher: Fetcher): Promise<T[]> {
  const response = await fetcher(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }

  const raw = await response.text();
  return parseDatasetArray<T>(raw, label);
}

function extractDetailPronunciations(detailEntry: DictionaryDetailEntry | undefined): XinhuaFlashcardPronunciation[] {
  const words = Array.isArray(detailEntry?.pronunciations) ? detailEntry.pronunciations : detailEntry?.word;
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: XinhuaFlashcardPronunciation[] = [];

  for (const entry of words) {
    const pinyin = normalizeText(entry.pinyin);
    if (!pinyin || seen.has(pinyin)) {
      continue;
    }

    seen.add(pinyin);
    result.push({
      pinyin,
      explanations: [],
    });
  }

  return result;
}

export async function loadXinhuaDataset(fetcher: Fetcher = fetch): Promise<XinhuaDataset> {
  if (datasetCache) {
    return datasetCache;
  }

  if (datasetPromise) {
    return datasetPromise;
  }

  datasetPromise = fetchDatasetArray<DictionaryDetailEntry>(LOCAL_DATA_PATHS.detail, "char_detail.json", fetcher)
    .then((detail) => {
      const dataset: XinhuaDataset = { detail };
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
  characterInput: string
): XinhuaFlashcardInfo | null {
  const character = normalizeCharacter(characterInput);
  if (!character) {
    return null;
  }

  const detailEntry = dataset.detail.find((entry) => normalizeText(entry.char) === character);
  if (!detailEntry) {
    return null;
  }

  const pronunciations = extractDetailPronunciations(detailEntry);
  const pinyin = dedupeStrings(pronunciations.map((entry) => entry.pinyin));

  if (pronunciations.length === 0 && pinyin.length === 0) {
    return null;
  }

  return {
    word: character,
    pinyin,
    pronunciations,
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
  const cacheKey = `${normalizedCharacter}|all:${includeAllMatches}`;

  if (flashcardCache.has(cacheKey)) {
    return flashcardCache.get(cacheKey) ?? null;
  }

  const dataset = await loadXinhuaDataset(fetcher);
  const info = buildXinhuaFlashcardInfo(dataset, normalizedCharacter);

  flashcardCache.set(cacheKey, info);
  return info;
}

export function resetXinhuaCachesForTests(): void {
  datasetCache = null;
  datasetPromise = null;
  flashcardCache.clear();
}
