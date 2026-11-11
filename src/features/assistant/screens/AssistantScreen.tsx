import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Bot, CalendarCheck, Headphones, History, Plus, RotateCcw, Send, ThumbsDown, ThumbsUp, X } from "lucide-react-native";

import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { getFormatLocale } from "@/i18n/formatLocale";
import { subscribeAssistant } from "@/features/assistant/assistantConnection";
import { getAssistantReplies } from "@/features/assistant/assistantPresentation";
import { ASSISTANT_PROMPTS } from "@/features/assistant/assistantContent";
import BookingFunnel from "@/features/assistant/components/BookingFunnel";
import PolicyDetailScreen from "@/features/cms/screens/PolicyDetailScreen";
import { Image } from "expo-image";
import * as SecureStore from "expo-secure-store";
import { AgentBlocks } from "@/features/assistant/components/AssistantBooking";
import {
  assistantError,
  assistantFailure,
  createConversation,
  getDraft,
  getHistory,
  getMessage,
  handoff,
  listConversations,
  patchDraft,
  sendFeedback,
  sendQuestion,
} from "@/features/assistant/assistantService";
import type { AssistantAnswer, Conversation, DraftSlots, MessageResult, ResourceCard, TimelineItem } from "@/features/assistant/assistantService";
import { answerActionsAllowed, applyMessageResult, assistantSendCanRetry, isPendingMessage, pendingNotice } from "@/features/assistant/assistantProtocol";

// Port từ FrontEnd AssistantWidget.tsx, gồm cả booking (đặt xe nhanh,
// xác nhận trong chat, thanh toán) như bản web.

const money = (value: number) =>
  new Intl.NumberFormat(getFormatLocale(), { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

function newClientId() {
  // Backend SendAssistantMessageRequest.ClientMessageId là Guid.
  // Web dùng crypto.randomUUID(); RN dùng UUID v4 thuần để tránh 400.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// AI trả về markdown (**bold**). RN Text không tự render nên parse thủ công,
// đoạn **...** thành chữ đậm, còn lại giữ nguyên (giữ số thứ tự, xuống dòng).
function renderRichText(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      return (
        <Text key={`${keyPrefix}-${index}`} style={stylesRef.bold}>
          {bold[1]}
        </Text>
      );
    }
    return <Text key={`${keyPrefix}-${index}`}>{part}</Text>;
  });
}

// Style chữ đậm dùng chung cho renderRichText (không phụ thuộc theme).
const stylesRef = StyleSheet.create({ bold: { fontWeight: "800" } });

// Tham số điền sẵn sang màn CreateBooking (giống web navigate kèm AssistantBookingState).
export type QuickBookParams = {
  vehicleId?: number;
  startAt?: string | null;
  endAt?: string | null;
  promoCode?: string | null;
  pickupAddress?: string | null;
  returnAddress?: string | null;
  customerNote?: string | null;
};

export default function AssistantScreen({
  onBack,
  onViewVehicle,
  onViewBooking,
  onQuickBook,
  onBookingConfirmed,
}: {
  onBack: () => void;
  onViewVehicle?: (vehicleId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  onQuickBook?: (params: QuickBookParams) => void;
  onBookingConfirmed?: (bookingId: number) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const statusText: Record<string, string> = {
    BotActive: t("mobile:assistant.status.botActive"),
    WaitingForStaff: t("mobile:assistant.status.waitingForStaff"),
    StaffActive: t("mobile:assistant.status.staffActive"),
    Closed: t("mobile:assistant.status.closed"),
  };

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState(() =>
    i18n.t("mobile:assistant.progress.searching"),
  );
  const [confirmStaff, setConfirmStaff] = useState(false);
  const [staffNote, setStaffNote] = useState("");
  const [firstPage, setFirstPage] = useState(1);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [uncertain, setUncertain] = useState<string | null>(null);
  const retryAction = useRef<(() => void) | null>(null);
  const pendingRequests = useRef(new Map<string, MessageResult>());
  const receipts = useRef(new Map<string, MessageResult>());
  const shownFailures = useRef(new Set<string>());
  const attempts = useRef(new Map<string, { conversationId: string; content: string; clientId: string }>());
  const serverOffset = useRef(0);

  const [funnelOpen, setFunnelOpen] = useState(false);
  const [policySlug, setPolicySlug] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ conversationId: string; content: string; clientId: string } | null>(null);
  const hydrated = useRef(false);
  const alive = useRef(true);
  const conversationEpoch = useRef(0);
  const sendLock = useRef(false);
  const listRef = useRef<FlatList>(null);
  const refreshSequence = useRef(0);
  const earliestPage = useRef<number | null>(null);
  const storageKey = `movevn_assistant_${user?.userId}`;
  const latestDraftVersion = Math.max(-1, ...items.map(item => item.draftVersion ?? -1));
  const latestConfirmationId = [...items].reverse().find(item => item.answer?.blocks?.some(block => block.type === "confirmCard"))?.id;

  useEffect(() => {
    if (conversation && user) void SecureStore.setItemAsync(storageKey, conversation.id).catch(() => undefined);
  }, [conversation?.id, storageKey, user]);

  const refresh = useCallback(async (selected: Conversation, signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current;
    const initial = await getHistory(selected.id, 1, signal);
    const lastPage = Math.max(1, Math.ceil(initial.totalCount / 50));
    // Giống web: chỉ tải từ trang đã tải gần nhất tới trang mới nhất,
    // tránh fetch toàn bộ mỗi lần poll khi chat dài.
    const startPage = Math.min(earliestPage.current ?? lastPage, lastPage);
    let rows: TimelineItem[] = [];
    for (let pageNumber = startPage; pageNumber <= lastPage; pageNumber++) {
      const page = pageNumber === 1 ? initial : await getHistory(selected.id, pageNumber, signal);
      rows.push(...page.items);
    }
    if (!alive.current || signal?.aborted || sequence !== refreshSequence.current) return;
    setRevision(value => value + 1);
    for (const result of receipts.current.values()) rows = applyMessageResult(rows, result);
    earliestPage.current = startPage;
    setItems((previous) => {
      const byId = new Map(previous.map((item) => [item.id, item]));
      const merged = new Map(byId);
      for (const item of rows) merged.set(item.id, item);
      const next = [...merged.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      return next.length === previous.length && next.every((item, index) => item === previous[index]) ? previous : next;
    });
    setFirstPage(startPage);
    for (const item of rows.filter(row => row.role === "user" && row.requestId)) {
      if (isPendingMessage(item) && !receipts.current.has(item.requestId!)) pendingRequests.current.set(item.requestId!, { ...pendingRequests.current.get(item.requestId!), ...item, id: item.requestId!, errorCode: null, deadlineAt: item.deadlineAt ?? pendingRequests.current.get(item.requestId!)?.deadlineAt ?? new Date(Date.now() + 90000).toISOString() });
      else pendingRequests.current.delete(item.requestId!);
    }
    setPending(pendingRequests.current.size > 0);
    const failed = [...rows].reverse().find((item) => item.role === "user" && item.status === "Failed");
    if (failed?.requestId && failed === rows[rows.length - 1] && !shownFailures.current.has(failed.requestId)) {
      shownFailures.current.add(failed.requestId);
      const result = await getMessage(selected.id, failed.requestId, signal);
      if (alive.current && !signal?.aborted && sequence === refreshSequence.current) { retryAction.current = result.diagnostics?.retryable === false ? null : () => void send(failed.content); setError(assistantError(result.errorCode)); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; conversationEpoch.current++;
    };
  }, []);

  // Hydrate lần đầu mở màn hình.
  useEffect(() => {
    if (!user || hydrated.current) return;
    const abort = new AbortController();
    setLoading(true);
    listConversations(abort.signal)
      .then(async (page) => {
        if (abort.signal.aborted) return;
        setConversations(page.items);
        const stored = await SecureStore.getItemAsync(storageKey).catch(() => null);
        if (abort.signal.aborted) return;
        const selected = page.items.find(item => item.id === stored) ?? page.items.find((item) => item.status !== "Closed") ?? null;
        setConversation(selected);
        if (selected) await refresh(selected, abort.signal);
        hydrated.current = true;
      })
      .catch((err) => {
        if (!abort.signal.aborted) { retryAction.current = () => void showHistory(); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.connectFailed"))); }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [user, refresh, storageKey]);

  // Realtime qua SignalR, fallback polling khi đang chờ.
  useEffect(() => {
    if (!conversation) return;
    const abort = new AbortController();
    const stop = subscribeAssistant(
      (event) => {
        if (event.conversationId !== conversation.id || abort.signal.aborted) return;
        const labels: Record<string, string> = {
          "vehicles.search": i18n.t("mobile:assistant.progress.vehicles"),
          "vehicles.availability": i18n.t("mobile:assistant.progress.availability"),
          "pricing.quote": i18n.t("mobile:assistant.progress.pricing"),
          "booking.draft.prepare": i18n.t("mobile:assistant.progress.preparing"),
        };
        setProgress(labels[event.status] ?? i18n.t("mobile:assistant.progress.processing"));
        if (["Completed", "Failed", "Cancelled", "DraftUpdated", "Finishing"].includes(event.status)) {
          void refresh(conversation, abort.signal).catch(() => undefined);
          void listConversations(abort.signal).then(page => { const current = page.items.find(item => item.id === conversation.id); if (current && !abort.signal.aborted) setConversation(previous => previous?.status === current.status ? previous : current); }).catch(() => undefined);
        }
      },
      (online) => {
        if (!abort.signal.aborted) {
          setConnected(online);
          if (online) void refresh(conversation, abort.signal).catch(() => undefined);
        }
      },
    );
    return () => {
      abort.abort();
      stop();
    };
  }, [conversation, refresh]);

  useEffect(() => {
    if (!conversation) return;
    if (!pending && conversation.status !== "WaitingForStaff" && conversation.status !== "StaffActive") return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        let terminal = false;
        for (const [id, previous] of pendingRequests.current) {
          const result = await getMessage(conversation.id, id, abort.signal);
          if (abort.signal.aborted) return;
          if (result.serverNow && Number.isFinite(Date.parse(result.serverNow))) serverOffset.current = Date.parse(result.serverNow) - Date.now();
          const current = { ...previous, ...result, deadlineAt: result.deadlineAt ?? previous.deadlineAt };
          if (isPendingMessage(current)) pendingRequests.current.set(id, current);
          else { pendingRequests.current.delete(id); receipts.current.set(id, current); setItems(items => applyMessageResult(items, current)); terminal = true; }
        }
        setUncertain([...pendingRequests.current.values()].map(message => pendingNotice(message, Date.now() + serverOffset.current)).find(Boolean) ?? null);
        setPending(pendingRequests.current.size > 0);
        if (terminal || conversation.ticketId) {
          await refresh(conversation, abort.signal);
          const page = await listConversations(abort.signal);
          const current = page.items.find(item => item.id === conversation.id);
          if (current && !abort.signal.aborted) setConversation(previous => previous?.status === current.status ? previous : current);
        }
      } catch { if (!abort.signal.aborted) setUncertain(i18n.t("mobile:assistant.progress.uncertain")); }
      if (!abort.signal.aborted) timer = setTimeout(poll, connected && conversation.status === "BotActive" ? 5000 : 3000);
    };
    timer = setTimeout(poll, 3000);
    return () => { abort.abort(); clearTimeout(timer); };
  }, [conversation, pending, connected, refresh]);

  useEffect(() => {
    if (items.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [items.length, pending]);

  async function send(content = draft) {
    if (!user || !content.trim() || content.trim().length > 2000 || sendLock.current) return;
    sendLock.current = true;
    setBusy(true);
    setError(null);
    const epoch = conversationEpoch.current;
    let acceptedConversation: Conversation | null = null;
    try {
      const current = conversation ?? (await createConversation());
      if (!alive.current || epoch !== conversationEpoch.current) return;
      setConversation(current);
      hydrated.current = true;
      const attemptKey = current.id + "\0" + content.trim();
      const request = attempts.current.get(attemptKey) ?? { conversationId: current.id, content: content.trim(), clientId: newClientId() };
      attempt.current = request; attempts.current.set(attemptKey, request);
      const result = await sendQuestion(current.id, request.content, request.clientId);
      if (!alive.current || epoch !== conversationEpoch.current) return;
      acceptedConversation = current;
      attempt.current = null; attempts.current.delete(attemptKey);
      setDraft(value => value.trim() === request.content ? "" : value); retryAction.current = null;
      if (isPendingMessage(result)) pendingRequests.current.set(result.id, { ...result, deadlineAt: result.deadlineAt ?? new Date(Date.now() + 90000).toISOString() });
      else { receipts.current.set(result.id, result); setItems(items => applyMessageResult(items, result)); }
      setPending(pendingRequests.current.size > 0);
      await refresh(current);
    } catch (err) {
      if (!alive.current || epoch !== conversationEpoch.current) return;
      if (acceptedConversation) { const accepted = acceptedConversation; retryAction.current = () => { void refresh(accepted).catch(() => undefined); }; setError(i18n.t("mobile:assistant.errors.acceptedButUnloaded")); return; }
      if (!draft.trim()) setDraft(content);
      const retryable = assistantSendCanRetry(err);
      if (!retryable && attempt.current) { attempts.current.delete(attempt.current.conversationId + "\0" + attempt.current.content); attempt.current = null; }
      retryAction.current = retryable ? () => void send(content) : null;
      setError(assistantFailure(err, i18n.t("mobile:assistant.errors.sendUnconfirmed")));
    } finally {
      sendLock.current = false;
      if (alive.current && epoch === conversationEpoch.current) setBusy(false);
    }
  }

  function newConversation() {
    conversationEpoch.current++;
    pendingRequests.current.clear(); receipts.current.clear(); shownFailures.current.clear(); attempts.current.clear(); retryAction.current = null; setUncertain(null);
    void SecureStore.deleteItemAsync(storageKey).catch(() => undefined);
    refreshSequence.current++;
    attempt.current = null;
    setFirstPage(1);
    earliestPage.current = null;
    setConversation(null);
    setItems([]);
    setDraft("");
    setPending(false);
    setError(null);
    setHistoryOpen(false);
    setConfirmStaff(false);
    hydrated.current = true;
  }

  async function choose(current: Conversation) {
    conversationEpoch.current++;
    pendingRequests.current.clear(); receipts.current.clear(); shownFailures.current.clear(); attempts.current.clear(); retryAction.current = null; setUncertain(null);
    refreshSequence.current++;
    attempt.current = null;
    setItems([]);
    setFirstPage(1);
    earliestPage.current = null;
    setConversation(current);
    setError(null);
    setHistoryOpen(false);
    setLoading(true);
    setConfirmStaff(false);
    try {
      await refresh(current);
    } catch (err) {
      retryAction.current = () => void choose(current); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.loadConversation")));
    } finally {
      setLoading(false);
    }
  }

  async function earlier() {
    if (!conversation || firstPage <= 1 || loading) return;
    setLoading(true);
    try {
      const page = await getHistory(conversation.id, firstPage - 1);
      earliestPage.current = firstPage - 1;
      setItems((old) => {
        const byId = new Map(old.map((item) => [item.id, item]));
        for (const item of page.items) if (!byId.has(item.id)) byId.set(item.id, item);
        return [...byId.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      });
      setFirstPage(firstPage - 1);
    } catch (err) {
      retryAction.current = () => void earlier(); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.loadEarlier")));
    } finally {
      setLoading(false);
    }
  }

  async function showHistory() {
    setHistoryOpen(true);
    setLoading(true);
    try {
      setConversations((await listConversations()).items);
    } catch (err) {
      retryAction.current = () => void showHistory(); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.loadHistory")));
    } finally {
      setLoading(false);
    }
  }

  async function transfer() {
    if (!staffNote.trim() || sendLock.current) return;
    sendLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const current = conversation ?? (await createConversation());
      const updated = await handoff(current.id, staffNote.trim());
      setConversation(updated);
      setConfirmStaff(false);
      setPending(false);
      hydrated.current = true;
      await refresh(updated);
    } catch (err) {
      retryAction.current = () => void transfer(); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.handoff")));
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  }

  async function vote(messageId: string, helpful: boolean) {
    if (!conversation) return;
    try {
      await sendFeedback(conversation.id, messageId, helpful);
      setVotes((old) => ({ ...old, [messageId]: helpful }));
    } catch (err) {
      retryAction.current = () => void vote(messageId, helpful); setError(assistantFailure(err, i18n.t("mobile:assistant.errors.feedback")));
    }
  }

  async function openQuickBook(patch?: Partial<DraftSlots>) {
    if (!user || sendLock.current) return;
    sendLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const current = conversation ?? (await createConversation());
      setConversation(current);
      hydrated.current = true;
      if (patch && Object.keys(patch).length > 0) {
        const existing = await getDraft(current.id);
        await patchDraft(current.id, existing?.version ?? 0, patch);
      }
      setFunnelOpen(true);
    } catch (err) {
      setError(assistantFailure(err, i18n.t("mobile:assistant.errors.quickBook")));
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  }

  function bookVehicle(vehicleId: number, startAt?: string | null, endAt?: string | null) {
    void openQuickBook({
      vehicleId,
      ...(startAt ? { startAt } : {}),
      ...(endAt ? { endAt } : {}),
    });
  }

  function applyPromoCode(code: string) {
    void openQuickBook({ promoCode: code.toUpperCase() });
  }

  function handleDraftChanged() {
    if (conversation) void refresh(conversation).catch(() => undefined);
  }

  const staff = conversation?.status === "WaitingForStaff" || conversation?.status === "StaffActive";
  const closed = conversation?.status === "Closed";
  const isCustomer = user?.roles.includes("Customer") ?? false;
  const lastQuestion = [...items].reverse().find((item) => item.role === "user")?.content;
  const lastAnswer = [...items].reverse().find((item) => item.answer);

  if (policySlug) return <PolicyDetailScreen slug={policySlug} onBack={() => setPolicySlug(null)} />;
  if (funnelOpen && conversation) {
    const byId = new Map<number, ResourceCard>();
    for (const item of items) for (const group of item.answer?.cards ?? []) {
      if (group.name.startsWith("vehicles.") && group.name !== "vehicles.reviews")
        for (const vehicle of group.data.items ?? [group.data]) if (vehicle.id) byId.set(vehicle.id, vehicle);
    }
    return <BookingFunnel conversationId={conversation.id} vehicles={[...byId.values()]} revision={revision} onClose={() => setFunnelOpen(false)} onViewBooking={onViewBooking} />;
  }

  return (
    // Tránh bàn phím đè ô nhập trên cả iOS lẫn Android.
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>{staff ? <Headphones color={theme.brand} size={22} /> : <Bot color={theme.brand} size={23} />}</View>
        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={styles.headerTitle}>{t("mobile:assistant.header.title")}</Text>
          <Text numberOfLines={1} style={styles.headerSub}>{statusText[conversation?.status ?? "BotActive"]}</Text>
        </View>
        <Pressable accessibilityLabel={t("mobile:assistant.header.history")} disabled={busy || loading} onPress={() => void showHistory()} style={styles.iconButton}>
          <History color={theme.muted} size={18} />
        </Pressable>
        <Pressable accessibilityLabel={t("mobile:assistant.header.newChat")} disabled={busy || loading} onPress={newConversation} style={styles.iconButton}>
          <Plus color={theme.muted} size={20} />
        </Pressable>
        <Pressable accessibilityLabel={t("mobile:assistant.header.close")} onPress={onBack} style={styles.iconButton}>
          <X color={theme.muted} size={20} />
        </Pressable>
      </View>

      {isCustomer && !!onQuickBook && !historyOpen && (
        <Pressable
          accessibilityLabel={t("mobile:assistant.quickBook.label")}
          disabled={busy || loading}
          onPress={() => void openQuickBook()}
          style={[styles.bookingBanner, (busy || loading) && styles.disabled]}
        >
          <CalendarCheck color="#fff" size={18} />
          <Text style={styles.bookingBannerText}>{t("mobile:assistant.quickBook.label")}</Text>
        </Pressable>
      )}

      {!user ? (
        <View style={styles.center}>
          <Text style={styles.title}>{t("mobile:assistant.guest.title")}</Text>
          <Text style={styles.muted}>{t("mobile:assistant.guest.body")}</Text>
        </View>
      ) : historyOpen ? (
        <View style={styles.history}>
          <Pressable onPress={() => setHistoryOpen(false)}>
            <Text style={styles.link}>{t("mobile:assistant.history.back")}</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>{t("mobile:assistant.history.title")}</Text>
          {error && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>{retryAction.current && <Pressable disabled={loading} onPress={() => { setError(null); retryAction.current?.(); }}><Text style={styles.retryText}>{t("mobile:assistant.retry")}</Text></Pressable>}</View>}
          {loading ? (
            <ActivityIndicator color={theme.brand} />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => void choose(item)} style={styles.historyRow}>
                  <Text style={styles.historyName}>{item.ticketId ? t("mobile:assistant.history.ticket", { id: item.ticketId }) : t("mobile:assistant.history.generic")}</Text>
                  <Text style={styles.muted}>
                    {new Date(item.createdAt).toLocaleString(getFormatLocale())} · {statusText[item.status]}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>{t("mobile:assistant.history.empty")}</Text>}
            />
          )}
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              firstPage > 1 ? (
                <Pressable disabled={loading} onPress={() => void earlier()} style={styles.earlierButton}>
                  <Text style={styles.link}>{t("mobile:assistant.earlier")}</Text>
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.brand} />
                </View>
              ) : (
                <View style={styles.welcome}>
                  <Text style={styles.title}>{t("mobile:assistant.welcome.title")}</Text>
                  <Text style={styles.muted}>{t("mobile:assistant.welcome.body")}</Text>
                  {ASSISTANT_PROMPTS.map((text) => (
                    <Pressable key={text} disabled={busy || pending} onPress={() => void send(text)} style={styles.promptChip}>
                      <Text style={styles.promptText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.role === "user" && styles.bubbleRowRight]}>
                <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
                  {item.role !== "user" && <Text style={styles.botLabel}>{item.role === "staff" ? t("mobile:assistant.botLabel.staff") : t("mobile:assistant.botLabel.ai")}</Text>}
                  <Text style={[styles.message, item.role === "user" && styles.messageUser]}>
                    {item.status === "Stale"
                      ? assistantError("AI_SOURCE_STALE")
                      : renderRichText(item.content, item.id)}
                  </Text>
                  {item.answer && (
                    <AnswerDetails
                      answer={item.answer}
                      conversationId={conversation?.id}
                      onViewPolicy={setPolicySlug}
                      onMore={() => void send("Xem thêm xe")}
                      onViewVehicle={onViewVehicle}
                      onViewBooking={onViewBooking}
                      onBookVehicle={isCustomer && onQuickBook ? bookVehicle : undefined}
                      onUsePromo={isCustomer && onQuickBook ? applyPromoCode : undefined}
                      onDraftChanged={handleDraftChanged}
                      onBooked={onBookingConfirmed}
                      disabled={!answerActionsAllowed(item, latestDraftVersion < 0 ? undefined : latestDraftVersion, pending)}
                      actionsDisabled={item.id !== latestConfirmationId}
                    />
                  )}
                  {item.role === "assistant" && item.status === "Completed" && item.requestId && (
                    <View style={styles.voteRow}>
                      {[true, false].map((helpful) => (
                        <Pressable
                          key={String(helpful)}
                          accessibilityLabel={helpful ? t("mobile:assistant.vote.helpful") : t("mobile:assistant.vote.notHelpful")}
                          onPress={() => void vote(item.requestId!, helpful)}
                          style={[styles.voteButton, votes[item.requestId!] === helpful && styles.voteActive]}
                        >
                          {helpful ? <ThumbsUp color={theme.brand} size={13} /> : <ThumbsDown color={theme.muted} size={13} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {item.role === "user" && item.status === "Failed" && <Text style={styles.failedHint}>{t("mobile:assistant.failed")}</Text>}
                </View>
              </View>
            )}
            ListFooterComponent={
              pending ? (
                <View style={styles.pendingRow}>
                  <ActivityIndicator color={theme.brand} size="small" />
                  <Text style={styles.muted}>{uncertain ?? progress}</Text>
                </View>
              ) : undefined
            }
          />

          {staff && (
            <Text style={styles.staffBanner}>
              {conversation?.status === "WaitingForStaff"
                ? t("mobile:assistant.staff.waiting")
                : t("mobile:assistant.staff.active")}
            </Text>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {retryAction.current && <Pressable
                disabled={busy}
                onPress={() => {
                  setError(null); retryAction.current?.();
                }}
                style={styles.retryRow}
              >
                <RotateCcw color={theme.danger} size={12} />
                <Text style={styles.retryText}>{t("mobile:assistant.retry")}</Text>
              </Pressable>}
            </View>
          )}

          {confirmStaff ? (
            <View style={styles.staffForm}>
              <Text style={styles.title}>{t("mobile:assistant.staff.confirmTitle")}</Text>
              <TextInput
                placeholder={t("mobile:assistant.staff.confirmPlaceholder")}
                value={staffNote}
                onChangeText={setStaffNote}
                maxLength={4000}
                multiline
                style={styles.input}
              />
              <View style={styles.staffActions}>
                <Pressable disabled={busy} onPress={() => setConfirmStaff(false)}>
                  <Text style={styles.muted}>{t("mobile:assistant.staff.back")}</Text>
                </Pressable>
                <Pressable disabled={busy || !staffNote.trim()} onPress={() => void transfer()} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>{t("mobile:assistant.staff.confirm")}</Text>
                </Pressable>
              </View>
            </View>
          ) : closed ? (
            <Pressable onPress={newConversation} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{t("mobile:assistant.staff.startNew")}</Text>
            </Pressable>
          ) : (
            <View style={styles.composer}>
              {!staff && <QuickReplies content={lastAnswer?.content ?? ""} lastAnswer={lastAnswer?.answer?.quickReplies} onPick={(text) => void send(text)} disabled={busy || pending} />}
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={2000}
                  multiline
                  placeholder={staff ? t("mobile:assistant.composer.toStaff") : t("mobile:assistant.composer.toAssistant")}
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
                <Pressable
                  accessibilityLabel={t("mobile:assistant.composer.send")}
                  disabled={busy || !draft.trim()}
                  onPress={() => void send()}
                  style={[styles.sendButton, (!draft.trim() || busy) && styles.sendDisabled]}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={18} />}
                </Pressable>
              </View>
              <View style={styles.composerFooter}>
                <Text style={styles.muted}>MoveVN</Text>
                {/* Backend Handoff chỉ cho Customer — giống web ẩn với Owner/Staff */}
                {isCustomer && !staff && (
                  <Pressable
                    disabled={busy}
                    onPress={() => {
                      setStaffNote(lastQuestion ?? "");
                      setConfirmStaff(true);
                    }}
                  >
                    <Text style={styles.link}>{t("mobile:assistant.staff.meet")}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

function QuickReplies({ disabled, onPick, lastAnswer, content }: { disabled: boolean; onPick: (text: string) => void; lastAnswer?: string[]; content: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chips = getAssistantReplies(content, lastAnswer);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chips.map((text) => (
        <Pressable key={text} disabled={disabled} onPress={() => onPick(text)} style={styles.chip}>
          <Text style={styles.chipText}>{text}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function AnswerDetails({
  answer,
  conversationId,
  onViewVehicle,
  onViewPolicy,
  onMore,
  onViewBooking,
  onBookVehicle,
  onUsePromo,
  onDraftChanged,
  onBooked,
  disabled,
  actionsDisabled,
}: {
  answer: AssistantAnswer;
  conversationId?: string;
  onViewPolicy: (slug: string) => void;
  onMore: () => void;
  onViewVehicle?: (vehicleId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  onBookVehicle?: (vehicleId: number, startAt?: string | null, endAt?: string | null) => void;
  onUsePromo?: (code: string) => void;
  onDraftChanged?: () => void;
  onBooked?: (bookingId: number) => void;
  disabled?: boolean;
  actionsDisabled?: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.cards}>
      {answer.blocks && answer.blocks.length > 0 && conversationId ? (
        <AgentBlocks
          blocks={answer.blocks}
          conversationId={conversationId}
          onChanged={() => onDraftChanged?.()}
          onBooked={onBooked}
          onViewBooking={onViewBooking}
          disabled={disabled || actionsDisabled}
        />
      ) : null}
      {answer.cards.map((group, index) => group.data.lookupStatus === "unavailable" ? (
        <View key={`${group.name}-${index}`} style={styles.cardGroup}>
          <Text style={styles.warn}>{t("mobile:assistant.details.lookupUnavailable")}</Text>
        </View>
      ) : (
        <View key={`${group.name}-${index}`} style={styles.cardGroup}>
          {group.name.startsWith("vehicles.") && group.data.availabilityChecked === false && (
            <Text style={styles.muted}>{t("mobile:assistant.details.basePrice")}</Text>
          )}
          {group.data.availabilityChecked && group.data.startDate && group.data.endDate && <Text style={styles.muted}>{t("mobile:assistant.details.rentalPeriod", { start: new Date(group.data.startDate).toLocaleString(getFormatLocale()), end: new Date(group.data.endDate).toLocaleString(getFormatLocale()) })}</Text>}
          {group.name === "vehicles.reviews" && group.data.averageRating != null && <Text style={styles.promo}>{t("mobile:assistant.details.reviews", { rating: group.data.averageRating, n: group.data.totalCount ?? group.data.items?.length ?? 0 })}</Text>}
          {group.name === "vehicles.reviews" && !group.data.items?.length && <Text style={styles.muted}>{t("mobile:assistant.details.noReviews")}</Text>}
          {group.name === "promotions.list" && !group.data.items?.length && <Text style={styles.muted}>{t("mobile:assistant.details.noPromotions")}</Text>}
          {(group.data.items ?? [group.data])
            .filter((card) => card.id)
            .map((card: ResourceCard, cardIndex) => {
              const title = card.bookingCode || card.vehicleName || `${card.brandName ?? ""} ${card.modelName ?? ""}`.trim() || `#${card.id}`;
              const meta = [card.seatCount ? t("mobile:assistant.details.seats", { n: card.seatCount }) : null, card.transmission, card.fuelType, card.areaName]
                .filter(Boolean)
                .join(" · ");
              const isVehicle = group.name.startsWith("vehicles.") && group.name !== "vehicles.reviews";
              const isBooking = group.name.startsWith("bookings.");
              // Chưa cắm điều hướng thì card chỉ đọc — không hiện link để tránh bấm chết.
              const canOpen = (isVehicle && onViewVehicle) || (isBooking && onViewBooking);
              const body = (
                <>
                  {(card.featuredImage || card.vehicleImage) && <Image source={card.featuredImage || card.vehicleImage} style={{ width: "100%", height: 100, borderRadius: 8 }} contentFit="cover" />}
                  {group.name !== "vehicles.reviews" && <Text style={styles.cardTitle}>{title}</Text>}
                  {card.status && <Text style={styles.muted}>{card.status}</Text>}
                  {card.quote && <Text style={styles.muted}>{t("mobile:assistant.details.refund", { amount: money(card.quote.refundAmount), policy: card.quote.policyMessage })}</Text>}
                  {card.rating != null && <Text style={styles.promo}>{"★".repeat(Math.max(0, Math.min(5, Math.round(card.rating))))} · {card.rating}/5</Text>}
                  {card.description && <Text style={styles.muted}>{card.description}</Text>}
                  {card.code && card.discountValue != null && <Text style={styles.promo}>{card.discountType === "Percent" ? card.maxDiscountAmount ? t("mobile:assistant.details.discountPercentCapped", { value: card.discountValue, max: money(card.maxDiscountAmount) }) : t("mobile:assistant.details.discountPercent", { value: card.discountValue }) : t("mobile:assistant.details.discountAmount", { amount: money(card.discountValue) })}</Text>}
                  {card.minOrderAmount != null && <Text style={styles.muted}>{t("mobile:assistant.details.minOrder", { amount: money(card.minOrderAmount) })}</Text>}
                  {card.code && card.endAt && <Text style={styles.muted}>{t("mobile:assistant.details.expiry", { date: new Date(card.endAt).toLocaleDateString(getFormatLocale()) })}</Text>}
                  {meta ? <Text style={styles.muted}>{meta}</Text> : null}
                  {card.pricePerDay != null && <Text style={styles.price}>{t("mobile:assistant.details.perDay", { amount: money(card.pricePerDay) })}</Text>}
                  {card.totalDynamicPrice != null && (
                    <Text style={styles.price}>
                      {t("mobile:assistant.details.perDays", { amount: money(card.totalDynamicPrice), days: card.rentalDays })}
                    </Text>
                  )}
                  {card.totalAmount != null && <Text style={styles.price}>{money(card.totalAmount)}</Text>}
                  {card.code ? (
                    <Text style={styles.promo}>
                      {card.code} — {card.name ?? ""}
                    </Text>
                  ) : null}
                  {card.comment ? <Text style={styles.muted}>{card.comment}</Text> : null}
                  {canOpen ? <Pressable accessibilityRole="link" onPress={() => {
                    if (isVehicle) onViewVehicle?.(card.id);
                    else if (isBooking) onViewBooking?.(card.id);
                  }}><Text style={styles.link}>{isBooking ? t("mobile:assistant.details.viewBooking") : t("mobile:assistant.details.viewDetail")}</Text></Pressable> : null}
                  {isVehicle && onBookVehicle ? (
                    <Pressable
                      disabled={disabled}
                      onPress={() => onBookVehicle(card.id, group.data.startDate, group.data.endDate)}
                      style={[styles.bookButton, disabled && styles.disabled]}
                    >
                      <Text style={styles.bookButtonText}>
                        {group.data.availabilityChecked && group.data.startDate && group.data.endDate
                          ? t("mobile:assistant.details.bookVehicleKeep")
                          : t("mobile:assistant.details.bookVehicle")}
                      </Text>
                    </Pressable>
                  ) : null}
                  {group.name === "promotions.list" && card.code && onUsePromo ? (
                    <Pressable
                      disabled={disabled}
                      onPress={() => onUsePromo(card.code!)}
                      style={[styles.bookButton, disabled && styles.disabled]}
                    >
                      <Text style={styles.bookButtonText}>{t("mobile:assistant.details.usePromo")}</Text>
                    </Pressable>
                  ) : null}
                </>
              );
              return (
                <View key={`${group.name}-${index}-${card.id}-${cardIndex}`} style={styles.card}>
                  {body}
                </View>
              );
            })}
          {group.name === "vehicles.reviews" && group.data.id && onViewVehicle && <Pressable onPress={() => onViewVehicle(group.data.id)}><Text style={styles.link}>{t("mobile:assistant.details.viewVehicle")}</Text></Pressable>}
          {group.data.hasMore && <Pressable disabled={disabled} onPress={onMore}><Text style={styles.link}>{t("mobile:assistant.details.moreVehicles")}</Text></Pressable>}
        </View>
      ))}
      {answer.sources.length > 0 && (
        <View style={styles.sources}>
          {answer.sources.filter((source, index, all) => all.findIndex(item => item.id === source.id) === index).map((source) => (
            <Pressable key={source.id} accessibilityRole="link" onPress={() => onViewPolicy(source.slug)} style={styles.sourceChip}>
              <Text style={styles.sourceText}>{source.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    headerInfo: { flex: 1, minWidth: 0, flexShrink: 1 },
    headerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    headerSub: { color: theme.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13 },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    welcome: { padding: 20, gap: 8 },
    promptChip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.surface,
    },
    promptText: { color: theme.text, fontSize: 14 },
    list: { padding: 14, gap: 12, paddingBottom: 20 },
    earlierButton: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
    bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
    bubbleRowRight: { justifyContent: "flex-end" },
    bubble: { maxWidth: "88%", borderRadius: 14, padding: 12 },
    bubbleUser: { backgroundColor: theme.brand },
    bubbleBot: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    botLabel: { color: theme.brand, fontSize: 12, fontWeight: "800", marginBottom: 4 },
    message: { color: theme.text, fontSize: 14, lineHeight: 20 },
    messageUser: { color: "#fff" },
    failedHint: { color: "#fff", opacity: 0.8, fontSize: 12, marginTop: 4 },
    voteRow: { flexDirection: "row", gap: 6, marginTop: 8 },
    voteButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
    voteActive: { backgroundColor: theme.brandSoft, borderWidth: 1, borderColor: theme.brandBorder },
    pendingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    staffBanner: {
      marginHorizontal: 14,
      marginBottom: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.infoSoft,
      color: theme.info,
      fontSize: 12,
    },
    errorBox: {
      marginHorizontal: 14,
      marginBottom: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.dangerSoft,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
    },
    errorText: { color: theme.danger, fontSize: 12, lineHeight: 18 },
    retryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    retryText: { color: theme.danger, fontSize: 12, fontWeight: "800" },
    staffForm: { padding: 14, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    staffActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 14 },
    primaryButton: {
      margin: 14,
      borderRadius: 14,
      backgroundColor: theme.brand,
      padding: 14,
      alignItems: "center",
    },
    primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, padding: 12, backgroundColor: theme.surface },
    chips: { gap: 8, paddingBottom: 8 },
    chip: { borderWidth: 1, borderColor: theme.brandBorder, backgroundColor: theme.brandSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    chipText: { color: theme.brand, fontSize: 12, fontWeight: "700" },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.input,
      fontSize: 14,
    },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" },
    sendDisabled: { opacity: 0.4 },
    disabled: { opacity: 0.4 },
    bookingBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 14,
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: theme.brand,
      paddingVertical: 12,
    },
    bookingBannerText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    bookButton: {
      marginTop: 6,
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      paddingVertical: 9,
      alignItems: "center",
    },
    bookButtonText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    composerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    history: { flex: 1, padding: 14, gap: 10 },
    sectionTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    historyRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
    historyName: { color: theme.text, fontSize: 14, fontWeight: "700" },
    cards: { marginTop: 10, gap: 8 },
    cardGroup: { gap: 8 },
    warn: { color: theme.danger, fontSize: 12 },
    card: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 10, backgroundColor: theme.background, gap: 4 },
    cardTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    price: { color: theme.success, fontSize: 13, fontWeight: "800" },
    promo: { color: theme.success, fontSize: 12, fontWeight: "800" },
    sources: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    sourceChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    sourceText: { color: theme.muted, fontSize: 11 },
  });
