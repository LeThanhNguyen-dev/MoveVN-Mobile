import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ticketError } from "./ticketModel";

export function useTicketData<T>(load: (signal: AbortSignal) => Promise<T>, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setRevision(x => x + 1), []);
  const accept = useCallback((value: T) => {
    request.current++; controller.current?.abort(); setData(value); setError(""); setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { setData(null); setError(""); setLoading(true); }, [load]);
  useEffect(() => {
    const id = ++request.current; const abort = new AbortController(); controller.current = abort;
    setRefreshing(true);
    void load(abort.signal).then(result => { if (!abort.signal.aborted && id === request.current) { setData(result); setError(""); } })
      .catch(e => { if (!abort.signal.aborted && id === request.current) setError(ticketError(e, "Không tải được yêu cầu hỗ trợ. Vui lòng thử lại.")); })
      .finally(() => { if (!abort.signal.aborted && id === request.current) { setLoading(false); setRefreshing(false); } });
    return () => { abort.abort(); };
  }, [load, revision]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    const timer = poll ? setInterval(() => { if (AppState.currentState === "active" && !controller.current?.signal.aborted) refresh(); }, 20000) : null;
    return () => { subscription.remove(); if (timer) clearInterval(timer); };
  }, [refresh, poll]);
  return { data, error, loading, refreshing, refresh, accept };
}
