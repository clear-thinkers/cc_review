import { alignPinyinPartsForCount } from "../../shared/words.shared.utils";

const HANZI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const PINYIN_CLEAN_REGEX = /[^\p{L}\p{M}0-9]/gu;

export function isHanziCharacter(character: string): boolean {
  return HANZI_REGEX.test(character);
}

export function splitPinyinTokens(pinyin: string): string[] {
  return pinyin
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(PINYIN_CLEAN_REGEX, ""))
    .filter(Boolean);
}

export function getAlignedPinyinTokens(text: string, pinyin: string): string[] {
  const baseTokens = splitPinyinTokens(pinyin);
  const hanziCount = Array.from(text).reduce(
    (count, character) => (isHanziCharacter(character) ? count + 1 : count),
    0
  );

  if (hanziCount === 0 || baseTokens.length === hanziCount) {
    return baseTokens;
  }

  // Admin page handles compact pinyin robustly; reuse identical count-aware alignment.
  const compactTokens = alignPinyinPartsForCount(hanziCount, pinyin)
    .map((token) => token.replace(PINYIN_CLEAN_REGEX, ""))
    .filter(Boolean);

  if (compactTokens.length === 0) {
    return baseTokens;
  }

  return compactTokens;
}
