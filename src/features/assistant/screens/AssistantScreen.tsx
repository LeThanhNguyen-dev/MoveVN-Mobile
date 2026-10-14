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

import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { subscribeAssistant } from "@/features/assistant/assistantConnection";
import { AgentBlocks } from "@/features/assistant/components/AssistantBooking";
import {
  assistantError,
  createConversation,
  getConversationState,
  getDraft,
  getHistory,
  getMessage,
  handoff,
  listConversations,
  patchDraft,
  sendFeedback,
  sendQuestion,
} from "@/features/assistant/assistantService";
import type { AssistantAnswer, Conversation, DraftSlots, ResourceCard, TimelineItem } from "@/features/assistant/assistantService";

// Port từ FrontEnd AssistantWidget.tsx, gồm cả booking (đặt xe nhanh,
// xác nhận trong chat, thanh toán) như bản web.

const statusText: Record<string, string> = {
  BotActive: "Tư vấn cùng AI",
  WaitingForStaff: "Đang chờ nhân viên",
  StaffActive: "Nhân viên đang hỗ trợ",
  Closed: "Cuộc trò chuyện đã kết thúc",
};

const prompts = ["Thuê xe cần giấy tờ gì?", "Tìm xe phù hợp với tôi", "Tôi muốn xem booking của mình"];

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

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
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const [progress, setProgress] = useState("MoveVN đang tìm câu trả lời…");
  const [confirmStaff, setConfirmStaff] = useState(false);
  const [staffNote, setStaffNote] = useState("");
  const [firstPage, setFirstPage] = useState(1);
  const [votes, setVotes] = useState<Record<string, boolean>>({});

  const hydrated = useRef(false);
  const alive = useRef(true);
  const sendLock = useRef(false);
  const listRef = useRef<FlatList>(null);
  const refreshSequence = useRef(0);
  const earliestPage = useRef<number | null>(null);

  const refresh = useCallback(async (selected: Conversation, signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current;
    const initial = await getHistory(selected.id, 1, signal);
    const lastPage = Math.max(1, Math.ceil(initial.totalCount / 50));
    // Giống web: chỉ tải từ trang đã tải gần nhất tới trang mới nhất,
    // tránh fetch toàn bộ mỗi lần poll khi chat dài.
    const startPage = Math.min(earliestPage.current ?? lastPage, lastPage);
    const rows: TimelineItem[] = [];
    for (let pageNumber = startPage; pageNumber <= lastPage; pageNumber++) {
      const page = pageNumber === 1 ? initial : await getHistory(selected.id, pageNumber, signal);
      rows.push(...page.items);
    }
    if (!alive.current || signal?.aborted || sequence !== refreshSequence.current) return;
    earliestPage.current = startPage;
    setItems((previous) => {
      const byId = new Map(previous.map((item) => [item.id, item]));
      const merged = new Map(byId);
      for (const item of rows) merged.set(item.id, item);
      const next = [...merged.values()].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      return next.length === previous.length && next.every((item, index) => item === previous[index]) ? previous : next;
    });
    setFirstPage(startPage);
    const active = rows.find((item) => item.role === "user" && ["Queued", "Processing"].includes(item.status));
    setPending(Boolean(active));
    const failed = [...rows].reverse().find((item) => item.role === "user" && item.status === "Failed");
    if (failed?.requestId && failed === rows[rows.length - 1]) {
      const result = await getMessage(selected.id, failed.requestId, signal);
      if (alive.current && !signal?.aborted && sequence === refreshSequence.current) setError(assistantError(result.errorCode));
    } else {
      setError(null);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
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
        const selected = page.items.find((item) => item.status !== "Closed") ?? null;
        setConversation(selected);
        if (selected) await refresh(selected, abort.signal);
        hydrated.current = true;
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(getApiErrorMessage(err, "Chưa kết nối được với máy chủ. Bạn thử lại nhé."));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [user, refresh]);

  // Realtime qua SignalR, fallback polling khi đang chờ.
  useEffect(() => {
    if (!conversation) return;
    const abort = new AbortController();
    const stop = subscribeAssistant(
      (event) => {
        if (event.conversationId !== conversation.id || abort.signal.aborted) return;
        const labels: Record<string, string> = {
          "vehicles.search": "Đang tìm xe…",
          "vehicles.availability": "Đang kiểm tra ngày trống…",
          "pricing.quote": "Đang tính giá chuyến đi…",
          "booking.draft.prepare": "Đang chuẩn bị xác nhận…",
        };
        setProgress(labels[event.status] ?? "MoveVN đang xử lý…");
        if (["Completed", "Failed", "Cancelled", "DraftUpdated", "Finishing"].includes(event.status)) {
          void refresh(conversation, abort.signal).catch(() => undefined);
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
    const timer = setTimeout(
      () => {
        void refresh(conversation).catch(() => undefined);
      },
      connected && conversation.status === "BotActive" ? 15000 : 3000,
    );
    return () => clearTimeout(timer);
  }, [conversation, pending, connected, refresh, items]);

  useEffect(() => {
    if (items.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [items.length, pending]);

  async function send(content = draft) {
    if (!user || !content.trim() || content.trim().length > 2000 || sendLock.current || pending) return;
    sendLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const current = conversation ?? (await createConversation());
      setConversation(current);
      hydrated.current = true;
      const result = await sendQuestion(current.id, content.trim(), newClientId());
      setDraft("");
      setPending(["Queued", "Processing"].includes(result.status));
      await refresh(current);
    } catch (err) {
      setError(getApiErrorMessage(err, "Chưa gửi được tin nhắn. Nhấn gửi lại để thử tiếp."));
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  }

  function newConversation() {
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
    earliestPage.current = null;
    setConversation(current);
    setError(null);
    setHistoryOpen(false);
    setLoading(true);
    setConfirmStaff(false);
    try {
      await refresh(current);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được hội thoại."));
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
      setError(getApiErrorMessage(err, "Chưa tải được tin nhắn cũ."));
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
      setError(getApiErrorMessage(err, "Không tải được lịch sử."));
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
      setError(getApiErrorMessage(err, "Chưa chuyển được yêu cầu. Bạn thử lại nhé."));
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
      setError(getApiErrorMessage(err, "Chưa gửi được đánh giá."));
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
        const existing = await getDraft(current.id).catch(() => null);
        await patchDraft(current.id, existing?.version ?? 0, patch).catch(() => null);
      }
      const [draft, state] = await Promise.all([
        getDraft(current.id).catch(() => null),
        getConversationState(current.id).catch(() => null),
      ]);
      const slots = draft?.slots ?? {};
      const activeFilters = state?.activeFilters as Record<string, unknown> | undefined;
      const vehicleId = slots.vehicleId ?? state?.focusVehicleId ?? undefined;
      if (!vehicleId) {
        setError("Bạn chọn xe trong đoạn chat trước nhé — mình sẽ điền sẵn vào form đặt xe.");
        return;
      }
      onQuickBook?.({
        vehicleId,
        startAt: slots.startAt ?? (activeFilters?.startAt as string | undefined) ?? null,
        endAt: slots.endAt ?? (activeFilters?.endAt as string | undefined) ?? null,
        promoCode: slots.promoCode ?? null,
        pickupAddress: slots.pickupAddress ?? null,
        returnAddress: slots.returnAddress ?? null,
        customerNote: slots.customerNote ?? null,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Chưa mở được đặt xe nhanh. Bạn thử lại nhé."));
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
          <Text numberOfLines={1} style={styles.headerTitle}>Trợ lý MoveVN</Text>
          <Text numberOfLines={1} style={styles.headerSub}>{statusText[conversation?.status ?? "BotActive"]}</Text>
        </View>
        <Pressable accessibilityLabel="Lịch sử trò chuyện" onPress={() => void showHistory()} style={styles.iconButton}>
          <History color={theme.muted} size={18} />
        </Pressable>
        <Pressable accessibilityLabel="Cuộc trò chuyện mới" onPress={newConversation} style={styles.iconButton}>
          <Plus color={theme.muted} size={20} />
        </Pressable>
        <Pressable accessibilityLabel="Đóng trợ lý" onPress={onBack} style={styles.iconButton}>
          <X color={theme.muted} size={20} />
        </Pressable>
      </View>

      {isCustomer && !!onQuickBook && !historyOpen && (
        <Pressable
          accessibilityLabel="Đặt xe nhanh"
          disabled={busy || loading}
          onPress={() => void openQuickBook()}
          style={[styles.bookingBanner, (busy || loading) && styles.disabled]}
        >
          <CalendarCheck color="#fff" size={18} />
          <Text style={styles.bookingBannerText}>Đặt xe nhanh</Text>
        </Pressable>
      )}

      {!user ? (
        <View style={styles.center}>
          <Text style={styles.title}>Chào bạn, mình là trợ lý MoveVN</Text>
          <Text style={styles.muted}>Đăng nhập để trò chuyện nhé.</Text>
        </View>
      ) : historyOpen ? (
        <View style={styles.history}>
          <Pressable onPress={() => setHistoryOpen(false)}>
            <Text style={styles.link}>‹ Quay lại</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Lịch sử trò chuyện</Text>
          {loading ? (
            <ActivityIndicator color={theme.brand} />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => void choose(item)} style={styles.historyRow}>
                  <Text style={styles.historyName}>{item.ticketId ? `Yêu cầu #${item.ticketId}` : "Trò chuyện với MoveVN"}</Text>
                  <Text style={styles.muted}>
                    {new Date(item.createdAt).toLocaleString("vi-VN")} · {statusText[item.status]}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Chưa có cuộc trò chuyện.</Text>}
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
                  <Text style={styles.link}>Xem tin trước</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.brand} />
                </View>
              ) : (
                <View style={styles.welcome}>
                  <Text style={styles.title}>Mình có thể giúp gì cho bạn?</Text>
                  <Text style={styles.muted}>Cùng tìm chiếc xe phù hợp hoặc giải đáp về chuyến đi của bạn.</Text>
                  {prompts.map((text) => (
                    <Pressable key={text} disabled={busy} onPress={() => void send(text)} style={styles.promptChip}>
                      <Text style={styles.promptText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.role === "user" && styles.bubbleRowRight]}>
                <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
                  {item.role !== "user" && <Text style={styles.botLabel}>{item.role === "staff" ? "Nhân viên MoveVN" : "MoveVN AI"}</Text>}
                  <Text style={[styles.message, item.role === "user" && styles.messageUser]}>
                    {item.status === "Stale"
                      ? assistantError("AI_SOURCE_STALE")
                      : renderRichText(item.content, item.id)}
                  </Text>
                  {item.answer && (
                    <AnswerDetails
                      answer={item.answer}
                      conversationId={conversation?.id}
                      onViewVehicle={onViewVehicle}
                      onViewBooking={onViewBooking}
                      onBookVehicle={isCustomer && onQuickBook ? bookVehicle : undefined}
                      onUsePromo={isCustomer && onQuickBook ? applyPromoCode : undefined}
                      onDraftChanged={handleDraftChanged}
                      onBooked={onBookingConfirmed}
                      disabled={busy || pending}
                    />
                  )}
                  {item.role === "assistant" && item.status === "Completed" && item.requestId && (
                    <View style={styles.voteRow}>
                      {[true, false].map((helpful) => (
                        <Pressable
                          key={String(helpful)}
                          onPress={() => void vote(item.requestId!, helpful)}
                          style={[styles.voteButton, votes[item.requestId!] === helpful && styles.voteActive]}
                        >
                          {helpful ? <ThumbsUp color={theme.brand} size={13} /> : <ThumbsDown color={theme.muted} size={13} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {item.role === "user" && item.status === "Failed" && <Text style={styles.failedHint}>Chưa nhận được câu trả lời</Text>}
                </View>
              </View>
            )}
            ListFooterComponent={
              pending ? (
                <View style={styles.pendingRow}>
                  <ActivityIndicator color={theme.brand} size="small" />
                  <Text style={styles.muted}>{progress}</Text>
                </View>
              ) : null
            }
          />

          {staff && (
            <Text style={styles.staffBanner}>
              {conversation?.status === "WaitingForStaff"
                ? "Yêu cầu đã được gửi. Bạn có thể nhắn thêm trong lúc chờ nhân viên."
                : "Nhân viên đã tiếp nhận. Bạn tiếp tục trao đổi tại đây nhé."}
            </Text>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                disabled={busy || pending}
                onPress={() => {
                  if (draft.trim() || lastQuestion) void send(draft.trim() || lastQuestion!);
                }}
                style={styles.retryRow}
              >
                <RotateCcw color={theme.danger} size={12} />
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          )}

          {confirmStaff ? (
            <View style={styles.staffForm}>
              <Text style={styles.title}>Chuyển sang nhân viên?</Text>
              <TextInput
                placeholder="Bạn cần hỗ trợ vấn đề gì?"
                value={staffNote}
                onChangeText={setStaffNote}
                maxLength={4000}
                multiline
                style={styles.input}
              />
              <View style={styles.staffActions}>
                <Pressable disabled={busy} onPress={() => setConfirmStaff(false)}>
                  <Text style={styles.muted}>Quay lại</Text>
                </Pressable>
                <Pressable disabled={busy || !staffNote.trim()} onPress={() => void transfer()} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>Đồng ý chuyển</Text>
                </Pressable>
              </View>
            </View>
          ) : closed ? (
            <Pressable onPress={newConversation} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Bắt đầu trò chuyện mới</Text>
            </Pressable>
          ) : (
            <View style={styles.composer}>
              {!staff && <QuickReplies lastAnswer={lastAnswer?.answer?.quickReplies} onPick={(text) => void send(text)} disabled={busy || pending} />}
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={2000}
                  multiline
                  placeholder={staff ? "Nhắn cho nhân viên…" : "Hỏi MoveVN…"}
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
                <Pressable
                  accessibilityLabel="Gửi tin nhắn"
                  disabled={busy || pending || !draft.trim()}
                  onPress={() => void send()}
                  style={[styles.sendButton, (!draft.trim() || busy || pending) && styles.sendDisabled]}
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
                    <Text style={styles.link}>Gặp nhân viên</Text>
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

function QuickReplies({ disabled, onPick, lastAnswer }: { disabled: boolean; onPick: (text: string) => void; lastAnswer?: string[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chips = lastAnswer?.length
    ? lastAnswer
    : ["Tìm xe phù hợp với tôi", "Có mã giảm giá nào không?", "Tôi muốn xem booking của mình"];
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
  onViewBooking,
  onBookVehicle,
  onUsePromo,
  onDraftChanged,
  onBooked,
  disabled,
}: {
  answer: AssistantAnswer;
  conversationId?: string;
  onViewVehicle?: (vehicleId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  onBookVehicle?: (vehicleId: number, startAt?: string | null, endAt?: string | null) => void;
  onUsePromo?: (code: string) => void;
  onDraftChanged?: () => void;
  onBooked?: (bookingId: number) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.cards}>
      {answer.blocks && answer.blocks.length > 0 && conversationId ? (
        <AgentBlocks
          blocks={answer.blocks}
          conversationId={conversationId}
          onChanged={() => onDraftChanged?.()}
          onBooked={onBooked}
        />
      ) : null}
      {answer.cards.map((group, index) => (
        <View key={`${group.name}-${index}`} style={styles.cardGroup}>
          {group.data.lookupStatus === "unavailable" && <Text style={styles.warn}>Tra cứu đang gián đoạn. Bạn thử lại nhé.</Text>}
          {group.name.startsWith("vehicles.") && group.data.availabilityChecked === false && (
            <Text style={styles.muted}>Giá cơ bản; cần ngày nhận và trả để kiểm tra lịch trống.</Text>
          )}
          {(group.data.items ?? [group.data])
            .filter((card) => card.id)
            .map((card: ResourceCard) => {
              const title = card.bookingCode || card.vehicleName || `${card.brandName ?? ""} ${card.modelName ?? ""}`.trim() || `#${card.id}`;
              const meta = [card.seatCount ? `${card.seatCount} chỗ` : null, card.transmission, card.fuelType, card.areaName]
                .filter(Boolean)
                .join(" · ");
              const isVehicle = group.name.startsWith("vehicles.");
              const isBooking = group.name.startsWith("bookings.");
              // Chưa cắm điều hướng thì card chỉ đọc — không hiện link để tránh bấm chết.
              const canOpen = (isVehicle && onViewVehicle) || (isBooking && onViewBooking);
              const body = (
                <>
                  <Text style={styles.cardTitle}>{title}</Text>
                  {meta ? <Text style={styles.muted}>{meta}</Text> : null}
                  {card.pricePerDay != null && <Text style={styles.price}>{money(card.pricePerDay)}/ngày</Text>}
                  {card.totalDynamicPrice != null && (
                    <Text style={styles.price}>
                      {money(card.totalDynamicPrice)} / {card.rentalDays} ngày
                    </Text>
                  )}
                  {card.totalAmount != null && <Text style={styles.price}>{money(card.totalAmount)}</Text>}
                  {card.code ? (
                    <Text style={styles.promo}>
                      {card.code} — {card.name ?? ""}
                    </Text>
                  ) : null}
                  {card.comment ? <Text style={styles.muted}>{card.comment}</Text> : null}
                  {canOpen ? <Text style={styles.link}>{isBooking ? "Xem booking" : "Xem chi tiết"}</Text> : null}
                  {isVehicle && onBookVehicle ? (
                    <Pressable
                      disabled={disabled}
                      onPress={() => onBookVehicle(card.id, group.data.startDate, group.data.endDate)}
                      style={[styles.bookButton, disabled && styles.disabled]}
                    >
                      <Text style={styles.bookButtonText}>
                        Đặt xe này{group.data.availabilityChecked && group.data.startDate && group.data.endDate ? " · giữ ngày đã chọn" : ""}
                      </Text>
                    </Pressable>
                  ) : null}
                  {group.name === "promotions.list" && card.code && onUsePromo ? (
                    <Pressable
                      disabled={disabled}
                      onPress={() => onUsePromo(card.code!)}
                      style={[styles.bookButton, disabled && styles.disabled]}
                    >
                      <Text style={styles.bookButtonText}>Dùng mã này</Text>
                    </Pressable>
                  ) : null}
                </>
              );
              return canOpen ? (
                <Pressable
                  key={card.id}
                  onPress={() => {
                    if (isVehicle) onViewVehicle?.(card.id);
                    else if (isBooking) onViewBooking?.(card.id);
                  }}
                  style={styles.card}
                >
                  {body}
                </Pressable>
              ) : (
                <View key={card.id} style={styles.card}>
                  {body}
                </View>
              );
            })}
        </View>
      ))}
      {answer.sources.length > 0 && (
        <View style={styles.sources}>
          {answer.sources.map((source) => (
            <View key={source.id} style={styles.sourceChip}>
              <Text style={styles.sourceText}>{source.title}</Text>
            </View>
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
