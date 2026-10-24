import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Clock3, Star } from "lucide-react-native";
import AppText from "@/components/AppText";
import { getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { getTicketQuality, rateSupportTicket } from "./supportTicketService";
import { ticketDate, ticketError } from "./ticketModel";
import { useTicketData } from "./useTicketData";
import { TicketButton, TicketNotice, ticketStyles } from "./TicketUi";

const stateLabels: Record<string, string> = { Pending: "Trong hạn", DueSoon: "Sắp đến hạn", Overdue: "Quá hạn", Met: "Đúng hạn", Late: "Trễ hạn", Unanswered: "Chưa phản hồi trước khi kết thúc" };
export default function TicketQualityPanel({ id, revision, closed }: { id: number; revision: string; closed: boolean }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  // Reload when a new message or status comes in; the server is the authority for rating eligibility.
  const loader = useCallback((signal: AbortSignal) => getTicketQuality(id, signal), [id]);
  const query = useTicketData(loader);
  const previousRevision = useRef(revision);
  useEffect(() => { if (previousRevision.current !== revision) { previousRevision.current = revision; query.refresh(); } }, [revision, query.refresh]);
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current || rating < 1 || !closed || !query.data?.canRate) return;
    lock.current = true; setBusy(true); setError(""); const generation = getSessionGeneration();
    try { await rateSupportTicket(id, rating, comment); if (generation === getSessionGeneration()) { setSaved(true); query.refresh(); } }
    catch (e) { if (generation === getSessionGeneration()) setError(ticketError(e, "Chưa gửi được đánh giá. Hãy làm mới trạng thái trước khi thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  }
  const cycle = query.data?.cycles[0];
  useEffect(() => { setSaved(false); setRating(0); setComment(""); setError(""); }, [cycle?.number]);
  return <View style={styles.card}><View style={styles.row}><Clock3 size={19} color={theme.brand} /><AppText style={styles.title}>Tiến độ hỗ trợ</AppText></View>
    <AppText style={styles.muted}>Giờ Việt Nam · Thời hạn tính liên tục 24/7. Phản hồi AI không tính là phản hồi của nhân viên.</AppText>
    {query.loading && <AppText style={styles.muted}>Đang tải thời hạn xử lý…</AppText>}
    {query.error ? <TicketNotice message={query.error} onRetry={query.refresh} /> : query.data && <>
      {cycle ? <View style={{ gap: 14 }}><AppText style={styles.muted}>Đợt xử lý {cycle.number} · {ticketDate(cycle.startedAt)}</AppText>{[
        { label: "Phản hồi đầu tiên", state: cycle.responseState, due: cycle.responseDueAt, done: cycle.firstResponseAt },
        { label: "Giải quyết yêu cầu", state: cycle.resolutionState, due: cycle.resolutionDueAt, done: cycle.resolvedAt },
      ].map(metric => <View key={metric.label} style={{ padding: 13, gap: 5, borderRadius: 12, backgroundColor: theme.surfaceAlt }}><AppText style={styles.label}>{metric.label}</AppText><AppText style={{ color: ["Overdue", "Late", "Unanswered"].includes(metric.state) ? theme.danger : metric.state === "Met" ? theme.success : theme.brand, fontSize: 13, fontWeight: "600" }}>{stateLabels[metric.state] ?? metric.state}</AppText><AppText style={styles.muted}>Thời hạn: {ticketDate(metric.due)}</AppText>{metric.done && <AppText style={styles.muted}>Ghi nhận: {ticketDate(metric.done)}</AppText>}</View>)}</View>
      : <AppText style={styles.muted}>Yêu cầu này chưa có dữ liệu theo dõi thời hạn. Không tính quá hạn hồi tố cho yêu cầu cũ.</AppText>}
      {saved && <AppText accessibilityRole="alert" style={{ color: theme.success }}>Cảm ơn bạn! Đánh giá đã được ghi nhận.</AppText>}
      {closed && query.data.canRate && !saved && <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 16 }}><AppText style={styles.label}>Bạn hài lòng với hỗ trợ vừa nhận được?</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel="Mức độ hài lòng" style={styles.row}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={`${star} sao`} accessibilityState={{ checked: rating === star, disabled: busy }} disabled={busy} onPress={() => setRating(star)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Star size={29} color={star <= rating ? "#F59E0B" : theme.faint} fill={star <= rating ? "#F59E0B" : "transparent"} /></Pressable>)}</View>
        <TextInput accessibilityLabel="Nhận xét hỗ trợ" editable={!busy} multiline maxLength={1000} value={comment} onChangeText={setComment} placeholder="Nhận xét (không bắt buộc)" placeholderTextColor={theme.placeholder} style={[styles.input, { minHeight: 85, textAlignVertical: "top" }]} />
        <AppText style={styles.muted}>Mỗi đợt xử lý được đánh giá một lần.</AppText>
        {error && <TicketNotice message={error} onRetry={query.refresh} />}
        <TicketButton title="Gửi đánh giá" disabled={rating < 1} busy={busy} onPress={() => { void submit(); }} />
      </View>}
      {query.data.feedback.map(item => <View key={item.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 12 }}><AppText style={{ color: "#D97706", fontWeight: "700" }}>★ {item.rating}/5 · {item.cycleNumber ? `Đợt ${item.cycleNumber}` : "Đánh giá hỗ trợ"}</AppText>{Boolean(item.comment) && <AppText style={styles.body}>{item.comment}</AppText>}<AppText style={styles.muted}>{ticketDate(item.createdAt)}</AppText></View>)}
    </>}
  </View>;
}
