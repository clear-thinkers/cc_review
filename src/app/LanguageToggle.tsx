"use client";

import { appStrings } from "./app.strings";
import { useLocale, useSetLocale, type AppLocale } from "./shared/locale";

export default function LanguageToggle() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const str = appStrings[locale];

  function renderButton(buttonLocale: AppLocale) {
    const isActive = locale === buttonLocale;
    return (
      <button
        type="button"
        onClick={() => setLocale(buttonLocale)}
        className={
          isActive
            ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
            : "rounded-full border px-3 py-1 text-xs font-semibold"
        }
        aria-pressed={isActive}
      >
        {buttonLocale === "en" ? str.locale.englishButton : str.locale.chineseButton}
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-50">
      <div className="flex items-center gap-1 rounded-full border bg-white/95 p-1 shadow-sm">
        <span className="px-2 text-xs text-gray-600">{str.locale.label}</span>
        {renderButton("en")}
        {renderButton("zh")}
      </div>
    </div>
  );
}
