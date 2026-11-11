import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Flag, Send, ShieldCheck } from "lucide-react-native";
import AppText from "@/components/AppText";
import { getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { TicketButton, TicketChoice, TicketHeader, TicketSearchField, TicketNotice, ticketStyles } from "@/features/supportTickets/TicketUi";
import { TicketGallery, TicketImageInput, useTicketImages } from "@/features/supportTickets/TicketAttachments";
import { useTicketData } from "@/features/supportTickets/useTicketData";
import { ticketDate } from "@/features/supportTickets/ticketModel";
import { createViolation, getMyViolations, getViolation, getViolationReasons, uploadViolationEvidence } from "./violationService";
import { actionLabels, safeEvidence, statusLabels, targetLabels, validateViolation, violationError } from "./violationModel";
import type { ViolationEntry, ViolationQuery, ViolationStatus, ViolationTarget } from "./types";

export default function ViolationsScreen({ entry, onClose, registerBack }: { entry: ViolationEntry; onClose: () => void; registerBack: (action: () => void) => void }) {
  const [route, setRoute] = useState<{ kind: "list" } | { kind: "create"; target: ViolationTarget } | { kind: "detail"; id: string }>(entry.reportId ? { kind: "detail", id: entry.reportId } : entry.target ? { kind: "create", target: entry.target } : { kind: "list" });
  const [query, setQuery] = useState<ViolationQuery>({ page: 1, pageSize: 10 });
  const back = () => { if (route.kind === "list" || (route.kind === "create" && entry.target) || (route.kind === "detail" && entry.reportId)) onClose(); else setRoute({ kind: "list" }); };
  useEffect(() => { if (route.kind === "list") registerBack(onClose); }, [route.kind, registerBack, onClose]);
  return route.kind === "create" ? <CreateReport target={route.target} onBack={back} onCreated={id => setRoute({ kind: "detail", id })} onList={() => setRoute({ kind: "list" })} registerBack={registerBack} />
    : route.kind === "detail" ? <ReportDetail id={route.id} onBack={back} registerBack={registerBack} />
      : <ReportList query={query} setQuery={setQuery} onBack={onClose} onOpen={id => setRoute({ kind: "detail", id })} />;
}

function ReportStatus({ status }: { status: ViolationStatus }) {
  const { theme } = useTheme();
  const color = status === "Resolved" ? theme.success : status === "Rejected" ? theme.muted : status === "InReview" ? (theme.mode === "dark" ? "#FBBF24" : "#A16207") : theme.brand;
  return <View style={{ alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, borderColor: color + "40", backgroundColor: color + "15", paddingHorizontal: 11, paddingVertical: 6 }}><AppText style={{ color, fontWeight: "700", fontSize: 12 }}>{statusLabels[status] ?? status}</AppText></View>;
}

function ReportList({ query, setQuery, onBack, onOpen }: { query: ViolationQuery; setQuery: (query: ViolationQuery) => void; onBack: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const queryOptions = { message: t("mobile:violation.errors.loadReports"), formatError: violationError };
  const { theme } = useTheme(); const styles = ticketStyles(theme); const [keyword, setKeyword] = useState(query.keyword ?? "");
  const [showGuide, setShowGuide] = useState(false);
  const loader = useCallback(async (signal: AbortSignal) => { const [page, reasons] = await Promise.all([getMyViolations(query, signal), getViolationReasons(signal)]); return { page, reasons }; }, [query]);
  const result = useTicketData(loader, false, queryOptions); const page = result.data?.page; const totalPages = page ? Math.ceil(page.totalCount / page.pageSize) : 0;
  useEffect(() => { if (page && totalPages > 0 && query.page > totalPages) setQuery({ ...query, page: totalPages }); }, [page, totalPages, query, setQuery]);
  return <View style={styles.screen}>
    <TicketHeader compact title={t("mobile:violation.listTitle")} onBack={onBack}
      onRefresh={result.refresh} refreshLabel={t("mobile:violation.refresh")} busy={result.refreshing} />
    <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={result.refreshing && !result.loading} onRefresh={result.refresh} tintColor={theme.brand} />}>
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:violation.guideAria")}
          accessibilityState={{ expanded: showGuide }} onPress={() => setShowGuide(value => !value)}
          style={styles.intro}>
          <View style={styles.introIcon}><ShieldCheck size={19} color={theme.brand} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={styles.introTitle}>{t("mobile:violation.guideTitle")}</AppText>
            <AppText style={styles.introText}>{t("mobile:violation.guideSubtitle")}</AppText>
          </View>
          <ChevronDown size={18} color={theme.brand} style={{ transform: [{ rotate: showGuide ? "180deg" : "0deg" }] }} />
        </Pressable>
        {showGuide ? <View style={{ paddingHorizontal: 13, paddingTop: 10, gap: 6 }}>
          <AppText style={styles.muted}>{t("mobile:violation.guideVerified")}</AppText>
          <AppText style={styles.muted}>{t("mobile:violation.guideDisclaimer")}</AppText>
        </View> : null}
      </View>
      <View style={styles.filterCard}>
        <TicketSearchField value={keyword} onChangeText={setKeyword}
          placeholder={t("mobile:violation.searchPlaceholder")} label={t("mobile:violation.searchLabel")}
          onSearch={() => setQuery({ ...query, keyword: keyword.trim() || undefined, page: 1 })} />
        <View>
          <AppText style={styles.filterLabel}>{t("violations:list.status")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {[{ value: "", label: t("mobile:violation.all") }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))].map(item => (
              <TicketChoice compact key={item.value} title={item.label} selected={(query.status ?? "") === item.value}
                onPress={() => setQuery({ ...query, status: item.value || undefined, page: 1 })} />
            ))}
          </ScrollView>
        </View>
        <View>
          <AppText style={styles.filterLabel}>{t("violations:list.target")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {[{ value: "", label: t("mobile:violation.all") }, ...Object.entries(targetLabels).map(([value, label]) => ({ value, label: value === "Booking" ? t("mobile:violation.targetBooking") : label }))].map(item => (
              <TicketChoice compact key={item.value} title={item.label} selected={(query.targetType ?? "") === item.value}
                onPress={() => setQuery({ ...query, targetType: item.value || undefined, page: 1 })} />
            ))}
          </ScrollView>
        </View>
        {Boolean(query.status || query.targetType || query.keyword) && (
          <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:violation.resetAria")} style={styles.resetLink}
            onPress={() => { setKeyword(""); setQuery({ page: 1, pageSize: 10 }); }}>
            <AppText style={styles.resetText}>{t("violations:list.clearFilters")}</AppText>
          </Pressable>
        )}
      </View>
      {result.loading && <View style={styles.empty}><ActivityIndicator color={theme.brand} size="large" /><AppText style={styles.muted}>{t("mobile:violation.loadingReports")}</AppText></View>}
      {result.error && <TicketNotice message={result.error} onRetry={result.refresh} />}
      {!result.loading && page && <><AppText style={styles.muted}>{t("mobile:violation.resultSummary", { total: String(page.totalCount) })}</AppText>
        {!page.items.length && !result.error && <View style={styles.empty}><Flag color={theme.faint} size={40} /><AppText style={styles.title}>{t("violations:list.emptyTitle")}</AppText><AppText style={styles.muted}>{t("mobile:violation.emptyHint")}</AppText></View>}
        {page.items.map(item => <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:violation.viewReportAria", { id: item.id.slice(0, 8) })} key={item.id} onPress={() => onOpen(item.id)} style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontSize: 12, fontWeight: "700" }}>{targetLabels[item.targetType]} · {item.id.slice(0, 8).toUpperCase()}</AppText><ReportStatus status={item.status} /></View><AppText style={styles.title}>{item.targetLabel}</AppText><AppText style={styles.body}>{result.data?.reasons.find(r => r.code === item.reason)?.label ?? item.reason}</AppText><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>{t("violations:detail.submittedAt", { date: ticketDate(item.createdAt) })}</AppText><ChevronRight size={19} color={theme.brand} /></View></Pressable>)}
        {totalPages > 1 && <View style={[styles.card, styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>{t("mobile:violation.pageOf", { page: String(query.page), total: String(totalPages) })}</AppText><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={t("mobile:violation.previousPageAria")} disabled={query.page <= 1 || result.refreshing} onPress={() => setQuery({ ...query, page: query.page - 1 })} style={[styles.iconButton, { opacity: query.page <= 1 ? 0.4 : 1 }]}><ChevronLeft color={theme.brand} size={21} /></Pressable>{[...new Set([1, query.page, totalPages])].map(p => <TicketChoice key={p} title={`${p}`} selected={query.page === p} disabled={result.refreshing} onPress={() => setQuery({ ...query, page: p })} />)}<Pressable accessibilityRole="button" accessibilityLabel={t("mobile:violation.nextPageAria")} disabled={query.page >= totalPages || result.refreshing} onPress={() => setQuery({ ...query, page: query.page + 1 })} style={[styles.iconButton, { opacity: query.page >= totalPages ? 0.4 : 1 }]}><ChevronRight color={theme.brand} size={21} /></Pressable></View></View>}
      </>}
    </ScrollView>
  </View>;
}

function CreateReport({ target, onBack, onCreated, onList, registerBack }: { target: ViolationTarget; onBack: () => void; onCreated: (id: string) => void; onList: () => void; registerBack: (action: () => void) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme(); const styles = ticketStyles(theme); const loader = useCallback((signal: AbortSignal) => getViolationReasons(signal), []); const queryOptions = { message: t("mobile:violation.errors.loadReports"), formatError: violationError }; const reasons = useTicketData(loader, false, queryOptions);
  const [reason, setReason] = useState(""); const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const images = useTicketImages({ max: 5, uploadFile: uploadViolationEvidence }); const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function back() {
    if (lock.current || images.picking) return;
    if (!description.trim() && !images.photos.length && !reason) return onBack();
    Alert.alert(t("mobile:violation.create.discardTitle"), t("mobile:violation.create.discardMessage"), [{ text: t("mobile:violation.create.keepDraft"), style: "cancel" }, { text: t("mobile:violation.create.discard"), style: "destructive", onPress: onBack }]);
  }
  useEffect(() => { registerBack(back); });
  async function send() {
    if (lock.current || images.picking || !reasons.data || reasons.error) return;
    const request = { targetType: target.targetType, targetId: target.targetId, reason, description: description.trim(), evidenceUrls: [] as string[] };
    const validation = validateViolation(request, reasons.data); if (validation) { setError(validation); return; }
    lock.current = true; setBusy(true); setError(""); const generation = getSessionGeneration();
    try {
      request.evidenceUrls = await images.uploadUrls();
      if (!alive.current || generation !== getSessionGeneration()) return;
      const evidenceError = validateViolation(request, reasons.data); if (evidenceError) throw new Error(evidenceError);
      const report = await createViolation(request);
      if (alive.current && generation === getSessionGeneration()) onCreated(report.id);
    } catch (e) { if (alive.current && generation === getSessionGeneration()) setError(violationError(e, t("mobile:violation.create.sendError"))); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><TicketHeader title={t("mobile:violation.create.title")} onBack={back} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={[styles.card, { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder }]}><View style={styles.row}><Flag color={theme.brand} size={22} /><AppText style={styles.label}>{t("mobile:violation.create.targetReported", { target: targetLabels[target.targetType] })}</AppText></View><AppText style={styles.title}>{target.label}</AppText><AppText style={styles.muted}>{t("mobile:violation.create.targetNotice")}</AppText></View>
    <View style={styles.card}><AppText style={styles.label}>{t("mobile:violation.create.reasonLabel")}</AppText>
      {reasons.loading && <ActivityIndicator color={theme.brand} />}{reasons.error && <TicketNotice message={reasons.error} onRetry={reasons.refresh} />}
      {reasons.data?.filter(r => r.targetTypes.includes(target.targetType)).map(r => <TicketChoice key={r.code} title={r.label} selected={reason === r.code} disabled={busy} onPress={() => setReason(r.code)} />)}
      <AppText style={styles.label}>{t("mobile:violation.create.descriptionLabel")}</AppText><TextInput accessibilityLabel={t("mobile:violation.create.descriptionAria")} editable={!busy} value={description} onChangeText={setDescription} multiline maxLength={4000} placeholder={t("mobile:violation.create.descriptionPlaceholder")} placeholderTextColor={theme.placeholder} style={[styles.input, styles.textarea]} /><AppText style={styles.count}>{t("mobile:violation.create.charCount", { total: String(description.trim().length) })}</AppText>
      <TicketImageInput images={images} disabled={busy} title={t("mobile:violation.create.evidenceTitle")} /><AppText style={styles.muted}>{t("mobile:violation.create.evidenceHint")}</AppText>
    </View>
    {error && <TicketNotice message={error} />}
    <TicketButton title={t("mobile:violation.create.submit")} busy={busy} disabled={reasons.loading || Boolean(reasons.error) || images.picking} icon={<Send color={theme.onBrand} size={18} />} onPress={() => { void send(); }} />
    <TicketButton secondary title={t("mobile:violation.create.viewSent")} disabled={busy || images.picking} onPress={() => { if (description.trim() || images.photos.length || reason) Alert.alert(t("mobile:violation.create.viewSentTitle"), t("mobile:violation.create.viewSentMessage"), [{ text: t("mobile:violation.create.keepDraft"), style: "cancel" }, { text: t("mobile:violation.create.viewList"), onPress: onList }]); else onList(); }} />
  </ScrollView></KeyboardAvoidingView>;
}

function ReportDetail({ id, onBack, registerBack }: { id: string; onBack: () => void; registerBack: (action: () => void) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  const loader = useCallback(async (signal: AbortSignal) => { const [report, reasons] = await Promise.all([getViolation(id, signal), getViolationReasons(signal)]); return { report, reasons }; }, [id]);
  const queryOptions = { message: t("mobile:violation.errors.loadReports"), formatError: violationError };
  const result = useTicketData(loader, true, queryOptions); const report = result.data?.report;
  useEffect(() => { registerBack(onBack); }, [registerBack, onBack]);
  return <View style={styles.screen}><TicketHeader title={t("mobile:violation.detail.title")} subtitle={id.slice(0, 8).toUpperCase()} onBack={onBack} onRefresh={result.refresh} refreshLabel={t("mobile:violation.refresh")} busy={result.refreshing} /><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={result.refreshing && !result.loading} onRefresh={result.refresh} tintColor={theme.brand} />}>
    {result.loading && <View style={styles.empty}><ActivityIndicator size="large" color={theme.brand} /><AppText style={styles.muted}>{t("mobile:violation.detail.loading")}</AppText></View>}{result.error && <TicketNotice message={result.error} onRetry={result.refresh} />}
    {report && <><View style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontWeight: "700" }}>{targetLabels[report.targetType]}</AppText><ReportStatus status={report.status} /></View><AppText display style={styles.title}>{report.targetLabel}</AppText><AppText style={styles.body}>{result.data?.reasons.find(r => r.code === report.reason)?.label ?? report.reason}</AppText><AppText style={styles.muted}>{`${t("mobile:violation.detail.sentAt", { date: ticketDate(report.createdAt) })}\n${t("mobile:violation.detail.updatedAt", { date: ticketDate(report.updatedAt) })}`}</AppText></View>
      {report.status === "Open" || report.status === "InReview" ? <View style={[styles.card, { backgroundColor: theme.brandSoft }]}><AppText style={styles.label}>{t("mobile:violation.detail.verifyingTitle")}</AppText><AppText style={styles.body}>{t("mobile:violation.detail.verifyingBody")}</AppText></View> : <View style={[styles.card, { borderColor: report.status === "Resolved" ? theme.success : theme.border }]}><View style={styles.row}><CheckCircle2 color={report.status === "Resolved" ? theme.success : theme.muted} size={22} /><AppText style={styles.title}>{t("mobile:violation.detail.resultTitle")}</AppText></View><AppText style={styles.label}>{statusLabels[report.status]}</AppText>{report.decision && <AppText style={styles.body}>{actionLabels[report.decision] ?? t("mobile:violation.detail.defaultDecision")}</AppText>}<AppText selectable style={styles.body}>{report.resolution?.trim() || t("mobile:violation.detail.defaultResolution")}</AppText>{report.closedAt && <AppText style={styles.muted}>{ticketDate(report.closedAt)}</AppText>}</View>}
      <View style={styles.card}><AppText style={styles.title}>{t("mobile:violation.detail.contentTitle")}</AppText><AppText selectable style={styles.body}>{report.description}</AppText><TicketGallery value={JSON.stringify(report.evidenceUrls.filter(safeEvidence))} /></View>
      <View style={styles.card}><AppText style={styles.title}>{t("mobile:violation.detail.historyTitle")}</AppText>{report.history.filter(item => !item.internal && item.action !== "InternalNote").map(item => <View key={item.id} style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: theme.brandBorder, paddingLeft: 13, paddingVertical: 7 }}><AppText style={styles.label}>{actionLabels[item.action] ?? t("mobile:violation.detail.defaultAction")}</AppText>{Boolean(item.note) && <AppText style={styles.body}>{item.note}</AppText>}<AppText style={styles.muted}>{item.actorName} · {ticketDate(item.createdAt)}</AppText></View>)}</View>
      <AppText style={styles.muted}>{t("mobile:violation.detail.footer")}</AppText>
    </>}
  </ScrollView></View>;
}
