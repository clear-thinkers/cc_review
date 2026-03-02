"use client";

import { appStrings } from "./app.strings";
import { useLocale } from "./shared/locale";

export default function Home() {
  const locale = useLocale();
  const str = appStrings[locale];

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{str.home.pageTitle}</h1>
      <a className="underline" href="/words">
        {str.home.enterGameLink}
      </a>
    </main>
  );
}
