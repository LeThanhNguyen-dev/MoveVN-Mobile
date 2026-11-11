import { useCallback, useEffect, useState } from "react";
import i18n from "@/i18n";
import { getOwnerAnalytics } from "@/features/ownerAnalytics/service";
import { datePreset, defaultFilters, type OwnerAnalytics } from "@/features/ownerAnalytics/types";
import { getApiErrorMessage } from "@/services/apiClient";
import { getOwnerOperations, type OwnerOperations } from "./service";

export function useOwnerDashboard(userId: number, enabled: boolean) {
  const [operations, setOperations] = useState<OwnerOperations | null>(null);
  const [business, setBusiness] = useState<OwnerAnalytics | null>(null);
  const [operationsError, setOperationsError] = useState("");
  const [businessError, setBusinessError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setOperations(null); setBusiness(null);
    setOperationsError(""); setBusinessError("");
    // Thống kê lỗi vẫn cho phép xem công việc vận hành và ngược lại.
    void Promise.allSettled([
      getOwnerOperations().then(result => { if (active) setOperations(result); })
        .catch(error => { if (active) setOperationsError(getApiErrorMessage(error, i18n.t("mobile:ownerHome.errors.operations"))); }),
      getOwnerAnalytics({ ...defaultFilters(), ...datePreset("month"), pageSize: 3 }, controller.signal)
        .then(result => { if (active) setBusiness(result); })
        .catch(error => { if (active) setBusinessError(getApiErrorMessage(error, i18n.t("mobile:ownerHome.errors.business"))); }),
    ]).then(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [userId, enabled, revision]);
  return { operations, business, operationsError, businessError, loading, refresh };
}
