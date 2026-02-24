"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getXinhuaFlashcardInfo,
  type XinhuaFlashcardInfo,
  type XinhuaFlashcardQueryOptions,
} from "@/lib/xinhua";

export type UseXinhuaFlashcardInfoResult = {
  data: XinhuaFlashcardInfo | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useXinhuaFlashcardInfo(
  character: string,
  options: XinhuaFlashcardQueryOptions = {}
): UseXinhuaFlashcardInfoResult {
  const ciLimit = options.ciLimit;
  const idiomLimit = options.idiomLimit;
  const xiehouyuLimit = options.xiehouyuLimit;
  const includeAllMatches = options.includeAllMatches;

  const [data, setData] = useState<XinhuaFlashcardInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(() => {
    setReloadNonce((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const trimmedCharacter = character.trim();
    let active = true;
    Promise.resolve()
      .then(async () => {
        if (!active) {
          return;
        }

        if (!trimmedCharacter) {
          setData(null);
          setError(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        const nextData = await getXinhuaFlashcardInfo(trimmedCharacter, {
          ciLimit,
          idiomLimit,
          xiehouyuLimit,
          includeAllMatches,
        });

        if (!active) {
          return;
        }

        setData(nextData);
      })
      .catch((nextError: unknown) => {
        if (!active) {
          return;
        }

        setData(null);
        setError(nextError instanceof Error ? nextError : new Error(String(nextError)));
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [character, ciLimit, idiomLimit, xiehouyuLimit, includeAllMatches, reloadNonce]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
