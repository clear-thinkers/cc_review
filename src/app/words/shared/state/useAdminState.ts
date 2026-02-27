import { useState } from "react";
import type {
  AdminPendingMeaning,
  AdminPendingPhrase,
  AdminStatsFilter,
  AdminTarget,
} from "../words.shared.types";

export function useAdminState() {
  const [adminTargets, setAdminTargets] = useState<AdminTarget[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminJsonByKey, setAdminJsonByKey] = useState<Record<string, string>>({});
  const [adminSavedByKey, setAdminSavedByKey] = useState<Record<string, boolean>>({});
  const [adminPreloading, setAdminPreloading] = useState(false);
  const [adminProgressText, setAdminProgressText] = useState<string | null>(null);
  const [adminRegeneratingKey, setAdminRegeneratingKey] = useState<string | null>(null);
  const [adminSavingKey, setAdminSavingKey] = useState<string | null>(null);
  const [adminDeletingKey, setAdminDeletingKey] = useState<string | null>(null);
  const [adminPendingPhrases, setAdminPendingPhrases] = useState<AdminPendingPhrase[]>([]);
  const [adminPendingMeanings, setAdminPendingMeanings] = useState<AdminPendingMeaning[]>([]);
  const [adminEditingExampleRowKey, setAdminEditingExampleRowKey] = useState<string | null>(null);
  const [adminStatsFilter, setAdminStatsFilter] = useState<AdminStatsFilter>("targets");

  return {
    adminTargets,
    setAdminTargets,
    adminLoading,
    setAdminLoading,
    adminNotice,
    setAdminNotice,
    adminJsonByKey,
    setAdminJsonByKey,
    adminSavedByKey,
    setAdminSavedByKey,
    adminPreloading,
    setAdminPreloading,
    adminProgressText,
    setAdminProgressText,
    adminRegeneratingKey,
    setAdminRegeneratingKey,
    adminSavingKey,
    setAdminSavingKey,
    adminDeletingKey,
    setAdminDeletingKey,
    adminPendingPhrases,
    setAdminPendingPhrases,
    adminPendingMeanings,
    setAdminPendingMeanings,
    adminEditingExampleRowKey,
    setAdminEditingExampleRowKey,
    adminStatsFilter,
    setAdminStatsFilter,
  };
}
