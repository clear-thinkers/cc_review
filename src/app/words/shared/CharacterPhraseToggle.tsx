export type CharacterPhraseViewMode = "characters" | "phrases";

export default function CharacterPhraseToggle({
  mode,
  onChange,
  charactersLabel,
  phrasesLabel,
}: {
  mode: CharacterPhraseViewMode;
  onChange: (mode: CharacterPhraseViewMode) => void;
  charactersLabel: string;
  phrasesLabel: string;
}) {
  return (
    <div className="flex gap-1 rounded-lg p-1" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "characters"}
        className={
          mode === "characters"
            ? "rounded-md border-2 px-3 py-1.5 text-sm font-semibold btn-toggle-on"
            : "btn-nav rounded-md border-2 px-3 py-1.5 text-sm font-medium hover:bg-[#fff1cd]"
        }
        onClick={() => onChange("characters")}
      >
        {charactersLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "phrases"}
        className={
          mode === "phrases"
            ? "rounded-md border-2 px-3 py-1.5 text-sm font-semibold btn-toggle-on"
            : "btn-nav rounded-md border-2 px-3 py-1.5 text-sm font-medium hover:bg-[#fff1cd]"
        }
        onClick={() => onChange("phrases")}
      >
        {phrasesLabel}
      </button>
    </div>
  );
}
