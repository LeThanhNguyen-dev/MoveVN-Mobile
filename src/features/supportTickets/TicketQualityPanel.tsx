import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { Clock3, Star } from "lucide-react-native";
import AppText from "@/components/AppText";
import { getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { translatedLabels } from "@/i18n/liveLabels";
import { getTicketQuality, rateSupportTicket } from "./supportTicketService";
import { ticketDate, ticketError } from "./ticketModel";
import { useTicketData } from "./useTicketData";
import { TicketButton, TicketNotice, ticketStyles } from "./TicketUi";

const sharedStateLabels = translatedLabels("support", {
  DueSoon: "quality.stateDueSoon", Overdue: "quality.stateOverdue", Met: "quality.stateMet",
});
const mobileStateLabels = translatedLabels("mobile", {
  Pending: "supportTicket.quality.pending", Late: "supportTicket.quality.late",
  Unanswered: "supportTicket.quality.unanswered",
});
export default function TicketQualityPanel({ id, revision, closed }: { id: number; revision: string; closed: boolean }) {
  const { t } = useTranslation();
  // Read the lazy labels at render so a runtime language change is applied immediately.
  const stateLabels: Record<string, string> = { ...sharedStateLabels, ...mobileStateLabels };
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
    catch (e) { if (generation === getSessionGeneration()) setError(ticketError(e, t("mobile:supportTicket.quality.ratingFailed"))); }
    finally { lock.current = false; setBusy(false); }
  }
  const cycle = query.data?.cycles[0];
  useEffect(() => { setSaved(false); setRating(0); setComment(""); setError(""); }, [cycle?.number]);
  return <View style={styles.card}><View style={styles.row}><Clock3 size={19} color={theme.brand} /><AppText style={styles.title}>{t("mobile:supportTicket.quality.title")}</AppText></View>
    <AppText style={styles.muted}>{t("mobile:supportTicket.quality.hint")}</AppText>
    {query.loading && <AppText style={styles.muted}>{t("mobile:supportTicket.quality.loading")}</AppText>}
    {query.error ? <TicketNotice message={query.error} onRetry={query.refresh} /> : query.data && <>
      {cycle ? <View style={{ gap: 14 }}><AppText style={styles.muted}>{t("mobile:supportTicket.quality.cycleStarted", { number: cycle.number, time: ticketDate(cycle.startedAt) })}</AppText>{[
        { label: t("support:ticketQuality.metricFirstResponse"), state: cycle.responseState, due: cycle.responseDueAt, done: cycle.firstResponseAt },
        { label: t("mobile:supportTicket.quality.metricResolution"), state: cycle.resolutionState, due: cycle.resolutionDueAt, done: cycle.resolvedAt },
      ].map(metric => <View key={metric.label} style={{ padding: 13, gap: 5, borderRadius: 12, backgroundColor: theme.surfaceAlt }}><AppText style={styles.label}>{metric.label}</AppText><AppText style={{ color: ["Overdue", "Late", "Unanswered"].includes(metric.state) ? theme.danger : metric.state === "Met" ? theme.success : theme.brand, fontSize: 13, fontWeight: "600" }}>{stateLabels[metric.state] ?? metric.state}</AppText><AppText style={styles.muted}>{t("mobile:supportTicket.quality.deadline", { date: ticketDate(metric.due) })}</AppText>{metric.done && <AppText style={styles.muted}>{t("mobile:supportTicket.quality.recordedAt", { date: ticketDate(metric.done) })}</AppText>}</View>)}</View>
      : <AppText style={styles.muted}>{t("mobile:supportTicket.quality.noDeadline")}</AppText>}
      {saved && <AppText accessibilityRole="alert" style={{ color: theme.success }}>{t("mobile:supportTicket.quality.ratingSaved")}</AppText>}
      {closed && query.data.canRate && !saved && <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 16 }}><AppText style={styles.label}>{t("support:ticketQuality.ratingQuestion")}</AppText>
        <View accessibilityRole="radiogroup" accessibilityLabel={t("support:ticketQuality.ratingAria")} style={styles.row}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={t("support:ticketQuality.starAria", { count: star })} accessibilityState={{ checked: rating === star, disabled: busy }} disabled={busy} onPress={() => setRating(star)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Star size={29} color={star <= rating ? "#F59E0B" : theme.faint} fill={star <= rating ? "#F59E0B" : "transparent"} /></Pressable>)}</View>
        <TextInput accessibilityLabel={t("mobile:supportTicket.quality.commentAria")} editable={!busy} multiline maxLength={1000} value={comment} onChangeText={setComment} placeholder={t("support:ticketQuality.commentLabel")} placeholderTextColor={theme.placeholder} style={[styles.input, { minHeight: 85, textAlignVertical: "top" }]} />
        <AppText style={styles.muted}>{t("support:ticketQuality.rateOnce")}</AppText>
        {error && <TicketNotice message={error} onRetry={query.refresh} />}
        <TicketButton title={t("support:ticketQuality.submitRating")} disabled={rating < 1} busy={busy} onPress={() => { void submit(); }} />
      </View>}
      {query.data.feedback.map(item => <View key={item.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 12 }}><AppText style={{ color: "#D97706", fontWeight: "700" }}>{t("mobile:supportTicket.quality.feedbackRating", { rating: item.rating, cycle: item.cycleNumber ? t("support:quality.cycleLabel", { number: item.cycleNumber }) : t("support:ticketQuality.feedbackTitle") })}</AppText>{Boolean(item.comment) && <AppText style={styles.body}>{item.comment}</AppText>}<AppText style={styles.muted}>{ticketDate(item.createdAt)}</AppText></View>)}
    </>}
  </View>;
}
