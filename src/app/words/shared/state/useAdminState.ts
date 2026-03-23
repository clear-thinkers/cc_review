import { useRef, useState } from "react";
import type {
  AdminEditingExample,
  AdminEditingPhrase,
  AdminEditingMeaning,
  AdminPendingMeaning,
  AdminPendingPhrase,
  AdminStatsFilter,
  AdminTarget,
  HiddenAdminTarget,
} from "../../admin/admin.types";

export function useAdminState() {
  const [adminTargets, setAdminTargets] = useState<AdminTarget[]>([]);
  const [hiddenAdminTargets, setHiddenAdminTargets] = useState<HiddenAdminTarget[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminJsonByKey, setAdminJsonByKey] = useState<Record<string, string>>({});
  const [adminSavedByKey, setAdminSavedByKey] = useState<Record<string, boolean>>({});
  const [adminPreloading, setAdminPreloading] = useState(false);
  const [adminPreloadCancelling, setAdminPreloadCancelling] = useState(false);
  const preloadCancelRef = useRef(false);
  const [adminProgressText, setAdminProgressText] = useState<string | null>(null);
  const [adminRegeneratingKey, setAdminRegeneratingKey] = useState<string | null>(null);
  const [adminSavingKey, setAdminSavingKey] = useState<string | null>(null);
  const [adminDeletingKey, setAdminDeletingKey] = useState<string | null>(null);
  const [adminRefreshingAllPinyin, setAdminRefreshingAllPinyin] = useState(false);
  const [adminPendingPhrases, setAdminPendingPhrases] = useState<AdminPendingPhrase[]>([]);
  const [adminPendingMeanings, setAdminPendingMeanings] = useState<AdminPendingMeaning[]>([]);
  const [adminEditingMeaning, setAdminEditingMeaning] = useState<AdminEditingMeaning | null>(null);
  const [adminEditingPhrase, setAdminEditingPhrase] = useState<AdminEditingPhrase | null>(null);
  const [adminEditingExample, setAdminEditingExample] = useState<AdminEditingExample | null>(null);
  const [adminStatsFilter, setAdminStatsFilter] = useState<AdminStatsFilter>("targets");
  const [adminSelectedTargetKeys, setAdminSelectedTargetKeys] = useState<string[]>([]);
  const [adminCreatingReviewTestSession, setAdminCreatingReviewTestSession] = useState(false);

  return {
    adminTargets,
    setAdminTargets,
    hiddenAdminTargets,
    setHiddenAdminTargets,
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
    adminPreloadCancelling,
    setAdminPreloadCancelling,
    preloadCancelRef,
    adminProgressText,
    setAdminProgressText,
    adminRegeneratingKey,
    setAdminRegeneratingKey,
    adminSavingKey,
    setAdminSavingKey,
    adminDeletingKey,
    setAdminDeletingKey,
    adminRefreshingAllPinyin,
    setAdminRefreshingAllPinyin,
    adminPendingPhrases,
    setAdminPendingPhrases,
    adminPendingMeanings,
    setAdminPendingMeanings,
    adminEditingMeaning,
    setAdminEditingMeaning,
    adminEditingPhrase,
    setAdminEditingPhrase,
    adminEditingExample,
    setAdminEditingExample,
    adminStatsFilter,
    setAdminStatsFilter,
    adminSelectedTargetKeys,
    setAdminSelectedTargetKeys,
    adminCreatingReviewTestSession,
    setAdminCreatingReviewTestSession,
  };
}
