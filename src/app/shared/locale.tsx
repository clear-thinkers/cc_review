"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLocale = "en" | "zh";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
};

const LOCALE_STORAGE_KEY = "cc_review_locale";
const DEFAULT_LOCALE: AppLocale = "en";

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Hydration guardrail: first client render must match server-rendered locale.
  // Read persisted locale only after mount to avoid server/client text mismatches.
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storedLocale === "en" || storedLocale === "zh") {
      setLocaleState(storedLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): AppLocale {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider.");
  }

  return context.locale;
}

export function useSetLocale(): (nextLocale: AppLocale) => void {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useSetLocale must be used inside LocaleProvider.");
  }

  return context.setLocale;
}
