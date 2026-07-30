import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

import {
  addVocabPhrase,
  addVocabPhrases,
  assignVocabPhraseLessonTags,
  deleteVocabPhrase,
  getExistingVocabPhrasesByText,
  gradeVocabPhrase,
  listVocabPhrases,
  nudgeWordFamiliarity,
  updateVocabPhrase,
} from "./supabase-service";

function mockSession() {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        user: {
          id: "auth-user-1",
          app_metadata: {
            family_id: "family-1",
            user_id: "user-1",
          },
        },
      },
    },
  });
}

describe("supabase-service vocab phrases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("listVocabPhrases scopes the select to the current family", async () => {
    const builder = { select: vi.fn(), eq: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await expect(listVocabPhrases()).resolves.toEqual([]);
    expect(builder.eq).toHaveBeenCalledWith("family_id", "family-1");
  });

  it("getExistingVocabPhrasesByText returns [] without querying for an empty list", async () => {
    await expect(getExistingVocabPhrasesByText([])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("getExistingVocabPhrasesByText maps rows to VocabPhrase, defaulting missing fields", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.in.mockResolvedValue({
      data: [
        {
          id: "phrase-1",
          family_id: "family-1",
          phrase: "谢谢",
          pinyin: "xièxie",
          meaning_en: "thank you",
          examples: [{ zh: "谢谢你。", pinyin: "xièxie nǐ.", include_in_fill_test: true }],
          test_count: 2,
          created_at: "2026-07-26T00:00:00.000Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    await expect(getExistingVocabPhrasesByText(["谢谢"])).resolves.toEqual([
      {
        id: "phrase-1",
        phrase: "谢谢",
        pinyin: "xièxie",
        meaningEn: "thank you",
        examples: [{ zh: "谢谢你。", pinyin: "xièxie nǐ.", includeInFillTest: true }],
        testCount: 2,
        createdAt: new Date("2026-07-26T00:00:00.000Z").getTime(),
      },
    ]);
  });

  it("addVocabPhrase trims and inserts a single phrase", async () => {
    const builder = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({
      data: {
        id: "phrase-1",
        family_id: "family-1",
        phrase: "谢谢",
        pinyin: null,
        meaning_en: null,
        examples: [],
        test_count: 0,
        created_at: "2026-07-26T00:00:00.000Z",
      },
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const result = await addVocabPhrase("  谢谢  ");
    expect(builder.insert).toHaveBeenCalledWith({ family_id: "family-1", phrase: "谢谢" });
    expect(result.phrase).toBe("谢谢");
    expect(result.examples).toEqual([]);
  });

  it("addVocabPhrases returns [] without querying for an empty list, otherwise upserts with ignoreDuplicates", async () => {
    await expect(addVocabPhrases([])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();

    const builder = { upsert: vi.fn(), select: vi.fn() };
    builder.upsert.mockReturnValue(builder);
    builder.select.mockResolvedValue({
      data: [
        {
          id: "phrase-2",
          family_id: "family-1",
          phrase: "对不起",
          pinyin: null,
          meaning_en: null,
          examples: [],
          test_count: 0,
          created_at: "2026-07-26T00:00:00.000Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const created = await addVocabPhrases(["你好", "对不起"]);
    expect(builder.upsert).toHaveBeenCalledWith(
      [
        { family_id: "family-1", phrase: "你好" },
        { family_id: "family-1", phrase: "对不起" },
      ],
      { onConflict: "family_id,phrase", ignoreDuplicates: true }
    );
    // Only the newly-inserted row comes back — "你好" was a duplicate and is silently skipped.
    expect(created).toHaveLength(1);
    expect(created[0]?.phrase).toBe("对不起");
  });

  it("updateVocabPhrase writes only the provided fields", async () => {
    const builder = { update: vi.fn(), eq: vi.fn() };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue({ ...builder, eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockReturnValue(builder);

    await updateVocabPhrase("phrase-1", { meaningEn: "thanks" });
    expect(builder.update).toHaveBeenCalledWith({ meaning_en: "thanks" });
  });

  it("updateVocabPhrase is a no-op when given no fields", async () => {
    await updateVocabPhrase("phrase-1", {});
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("deleteVocabPhrase scopes the delete to id and family_id", async () => {
    const builder = { delete: vi.fn(), eq: vi.fn() };
    builder.delete.mockReturnValue(builder);
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    builder.eq.mockReturnValue({ eq: secondEq });
    fromMock.mockReturnValue(builder);

    await deleteVocabPhrase("phrase-1");
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", "phrase-1");
    expect(secondEq).toHaveBeenCalledWith("family_id", "family-1");
  });

  it("gradeVocabPhrase increments test_count regardless of correctness (no scheduler fields touched)", async () => {
    const selectBuilder = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
    selectBuilder.select.mockReturnValue(selectBuilder);
    selectBuilder.eq.mockReturnValue(selectBuilder);
    selectBuilder.single.mockResolvedValue({
      data: {
        id: "phrase-1",
        family_id: "family-1",
        phrase: "谢谢",
        pinyin: null,
        meaning_en: null,
        examples: [],
        test_count: 4,
        created_at: "2026-07-26T00:00:00.000Z",
      },
      error: null,
    });

    const updateBuilder = { update: vi.fn(), eq: vi.fn() };
    updateBuilder.update.mockReturnValue(updateBuilder);
    updateBuilder.eq.mockResolvedValue({ error: null });

    let call = 0;
    fromMock.mockImplementation(() => (call++ === 0 ? selectBuilder : updateBuilder));

    const result = await gradeVocabPhrase("phrase-1");
    expect(updateBuilder.update).toHaveBeenCalledWith({ test_count: 5 });
    expect(result.testCount).toBe(5);
  });

  it("assignVocabPhraseLessonTags upserts one row per phrase id, ignoring duplicates", async () => {
    const builder = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    fromMock.mockReturnValue(builder);

    await assignVocabPhraseLessonTags(["phrase-1", "phrase-2"], "tag-1");
    expect(builder.upsert).toHaveBeenCalledWith(
      [
        { vocab_phrase_id: "phrase-1", lesson_tag_id: "tag-1", family_id: "family-1" },
        { vocab_phrase_id: "phrase-2", lesson_tag_id: "tag-1", family_id: "family-1" },
      ],
      { onConflict: "vocab_phrase_id,lesson_tag_id,family_id", ignoreDuplicates: true }
    );
  });

  it("nudgeWordFamiliarity no-ops silently when the character was never added standalone", async () => {
    const builder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await expect(nudgeWordFamiliarity("missing-word")).resolves.toBeUndefined();
    // Only the read happened — no update call was ever built.
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("nudgeWordFamiliarity applies a 'good' grade and bumps reviewCount but not testCount", async () => {
    const now = new Date("2026-07-26T00:00:00.000Z").getTime();
    const selectBuilder = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    selectBuilder.select.mockReturnValue(selectBuilder);
    selectBuilder.eq.mockReturnValue(selectBuilder);
    selectBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: "word-1",
        family_id: "family-1",
        hanzi: "谢",
        created_at: "2026-01-01T00:00:00.000Z",
        repetitions: 3,
        interval_days: 8,
        ease: 8,
        next_review_at: now,
        review_count: 10,
        test_count: 7,
        fill_test: null,
      },
      error: null,
    });

    const updateBuilder = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
    updateBuilder.update.mockReturnValue(updateBuilder);

    let call = 0;
    fromMock.mockImplementation(() => (call++ === 0 ? selectBuilder : updateBuilder));

    await nudgeWordFamiliarity("word-1", now);

    expect(updateBuilder.update).toHaveBeenCalledTimes(1);
    const writtenRow = updateBuilder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(writtenRow.review_count).toBe(11);
    expect(writtenRow.test_count).toBe(7); // unchanged — not a direct standalone test
    expect(writtenRow.ease).toBeGreaterThan(8); // stability increased via calculateNextState("good")
  });
});
