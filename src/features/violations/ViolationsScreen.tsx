import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
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

const queryOptions = { message: "Không tải được báo cáo vi phạm. Vui lòng thử lại.", formatError: violationError };
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
  const { theme } = useTheme(); const styles = ticketStyles(theme); const [keyword, setKeyword] = useState(query.keyword ?? "");
  const [showGuide, setShowGuide] = useState(false);
  const loader = useCallback(async (signal: AbortSignal) => { const [page, reasons] = await Promise.all([getMyViolations(query, signal), getViolationReasons(signal)]); return { page, reasons }; }, [query]);
  const result = useTicketData(loader, false, queryOptions); const page = result.data?.page; const totalPages = page ? Math.ceil(page.totalCount / page.pageSize) : 0;
  useEffect(() => { if (page && totalPages > 0 && query.page > totalPages) setQuery({ ...query, page: totalPages }); }, [page, totalPages, query, setQuery]);
  return <View style={styles.screen}>
    <TicketHeader compact title="Báo cáo vi phạm" onBack={onBack}
      onRefresh={result.refresh} refreshLabel="Làm mới báo cáo" busy={result.refreshing} />
    <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={result.refreshing && !result.loading} onRefresh={result.refresh} tintColor={theme.brand} />}>
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="Hướng dẫn gửi báo cáo vi phạm"
          accessibilityState={{ expanded: showGuide }} onPress={() => setShowGuide(value => !value)}
          style={styles.intro}>
          <View style={styles.introIcon}><ShieldCheck size={19} color={theme.brand} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={styles.introTitle}>Cách gửi báo cáo</AppText>
            <AppText style={styles.introText}>Từ hồ sơ, chi tiết xe hoặc đơn thuê.</AppText>
          </View>
          <ChevronDown size={18} color={theme.brand} style={{ transform: [{ rotate: showGuide ? "180deg" : "0deg" }] }} />
        </Pressable>
        {showGuide ? <View style={{ paddingHorizontal: 13, paddingTop: 10, gap: 6 }}>
          <AppText style={styles.muted}>Mọi phản ánh đều được xác minh trước khi kết luận.</AppText>
          <AppText style={styles.muted}>Báo cáo vi phạm không tự hoàn tiền hoặc thay thế hồ sơ tranh chấp. Nếu cần trợ giúp sử dụng ứng dụng, hãy gửi yêu cầu hỗ trợ.</AppText>
        </View> : null}
      </View>
      <View style={styles.filterCard}>
        <TicketSearchField value={keyword} onChangeText={setKeyword}
          placeholder="Tên, biển số hoặc mã đặt xe…" label="Tìm báo cáo theo tên, biển số hoặc mã đặt xe"
          onSearch={() => setQuery({ ...query, keyword: keyword.trim() || undefined, page: 1 })} />
        <View>
          <AppText style={styles.filterLabel}>Trạng thái</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {[{ value: "", label: "Tất cả" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))].map(item => (
              <TicketChoice compact key={item.value} title={item.label} selected={(query.status ?? "") === item.value}
                onPress={() => setQuery({ ...query, status: item.value || undefined, page: 1 })} />
            ))}
          </ScrollView>
        </View>
        <View>
          <AppText style={styles.filterLabel}>Đối tượng</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {[{ value: "", label: "Tất cả" }, ...Object.entries(targetLabels).map(([value, label]) => ({ value, label: value === "Booking" ? "Đơn thuê" : label }))].map(item => (
              <TicketChoice compact key={item.value} title={item.label} selected={(query.targetType ?? "") === item.value}
                onPress={() => setQuery({ ...query, targetType: item.value || undefined, page: 1 })} />
            ))}
          </ScrollView>
        </View>
        {Boolean(query.status || query.targetType || query.keyword) && (
          <Pressable accessibilityRole="button" accessibilityLabel="Xóa bộ lọc báo cáo" style={styles.resetLink}
            onPress={() => { setKeyword(""); setQuery({ page: 1, pageSize: 10 }); }}>
            <AppText style={styles.resetText}>Xóa bộ lọc</AppText>
          </Pressable>
        )}
      </View>
      {result.loading && <View style={styles.empty}><ActivityIndicator color={theme.brand} size="large" /><AppText style={styles.muted}>Đang tải báo cáo…</AppText></View>}
      {result.error && <TicketNotice message={result.error} onRetry={result.refresh} />}
      {!result.loading && page && <><AppText style={styles.muted}>{page.totalCount} báo cáo phù hợp · Mới nhất trước</AppText>
        {!page.items.length && !result.error && <View style={styles.empty}><Flag color={theme.faint} size={40} /><AppText style={styles.title}>Chưa có báo cáo phù hợp</AppText><AppText style={styles.muted}>Bạn có thể đổi bộ lọc hoặc mở đối tượng cần phản ánh để gửi báo cáo.</AppText></View>}
        {page.items.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`Xem báo cáo ${item.id.slice(0, 8)}`} key={item.id} onPress={() => onOpen(item.id)} style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontSize: 12, fontWeight: "700" }}>{targetLabels[item.targetType]} · {item.id.slice(0, 8).toUpperCase()}</AppText><ReportStatus status={item.status} /></View><AppText style={styles.title}>{item.targetLabel}</AppText><AppText style={styles.body}>{result.data?.reasons.find(r => r.code === item.reason)?.label ?? item.reason}</AppText><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>Gửi lúc {ticketDate(item.createdAt)}</AppText><ChevronRight size={19} color={theme.brand} /></View></Pressable>)}
        {totalPages > 1 && <View style={[styles.card, styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>Trang {query.page}/{totalPages}</AppText><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Trang báo cáo trước" disabled={query.page <= 1 || result.refreshing} onPress={() => setQuery({ ...query, page: query.page - 1 })} style={[styles.iconButton, { opacity: query.page <= 1 ? 0.4 : 1 }]}><ChevronLeft color={theme.brand} size={21} /></Pressable>{[...new Set([1, query.page, totalPages])].map(p => <TicketChoice key={p} title={`${p}`} selected={query.page === p} disabled={result.refreshing} onPress={() => setQuery({ ...query, page: p })} />)}<Pressable accessibilityRole="button" accessibilityLabel="Trang báo cáo sau" disabled={query.page >= totalPages || result.refreshing} onPress={() => setQuery({ ...query, page: query.page + 1 })} style={[styles.iconButton, { opacity: query.page >= totalPages ? 0.4 : 1 }]}><ChevronRight color={theme.brand} size={21} /></Pressable></View></View>}
      </>}
    </ScrollView>
  </View>;
}

function CreateReport({ target, onBack, onCreated, onList, registerBack }: { target: ViolationTarget; onBack: () => void; onCreated: (id: string) => void; onList: () => void; registerBack: (action: () => void) => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme); const loader = useCallback((signal: AbortSignal) => getViolationReasons(signal), []); const reasons = useTicketData(loader, false, queryOptions);
  const [reason, setReason] = useState(""); const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const images = useTicketImages({ max: 5, uploadFile: uploadViolationEvidence }); const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function back() {
    if (lock.current || images.picking) return;
    if (!description.trim() && !images.photos.length && !reason) return onBack();
    Alert.alert("Bỏ báo cáo đang soạn?", "Nội dung này chưa được gửi.", [{ text: "Soạn tiếp", style: "cancel" }, { text: "Bỏ nội dung", style: "destructive", onPress: onBack }]);
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
    } catch (e) { if (alive.current && generation === getSessionGeneration()) setError(violationError(e, "Chưa gửi được báo cáo. Nội dung và ảnh vẫn được giữ để bạn thử lại.")); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><TicketHeader title="Gửi báo cáo vi phạm" onBack={back} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={[styles.card, { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder }]}><View style={styles.row}><Flag color={theme.brand} size={22} /><AppText style={styles.label}>{targetLabels[target.targetType]} được phản ánh</AppText></View><AppText style={styles.title}>{target.label}</AppText><AppText style={styles.muted}>Đối tượng được gắn từ màn hình bạn đang xem. Báo cáo sẽ được xác minh, chưa phải kết luận vi phạm.</AppText></View>
    <View style={styles.card}><AppText style={styles.label}>Lý do báo cáo *</AppText>
      {reasons.loading && <ActivityIndicator color={theme.brand} />}{reasons.error && <TicketNotice message={reasons.error} onRetry={reasons.refresh} />}
      {reasons.data?.filter(r => r.targetTypes.includes(target.targetType)).map(r => <TicketChoice key={r.code} title={r.label} selected={reason === r.code} disabled={busy} onPress={() => setReason(r.code)} />)}
      <AppText style={styles.label}>Mô tả sự việc *</AppText><TextInput accessibilityLabel="Mô tả báo cáo vi phạm" editable={!busy} value={description} onChangeText={setDescription} multiline maxLength={4000} placeholder="Mô tả cụ thể điều đã xảy ra, thời điểm và thông tin giúp xác minh…" placeholderTextColor={theme.placeholder} style={[styles.input, styles.textarea]} /><AppText style={styles.count}>{description.trim().length}/4.000 · tối thiểu 20 ký tự</AppText>
      <TicketImageInput images={images} disabled={busy} title="Ảnh bằng chứng" /><AppText style={styles.muted}>Gửi đầy đủ bằng chứng trước khi xác nhận. Bạn chưa thể chỉnh sửa hoặc bổ sung sau khi gửi.</AppText>
    </View>
    {error && <TicketNotice message={error} />}
    <TicketButton title="Gửi báo cáo" busy={busy} disabled={reasons.loading || Boolean(reasons.error) || images.picking} icon={<Send color={theme.onBrand} size={18} />} onPress={() => { void send(); }} />
    <TicketButton secondary title="Xem báo cáo đã gửi" disabled={busy || images.picking} onPress={() => { if (description.trim() || images.photos.length || reason) Alert.alert("Xem báo cáo đã gửi?", "Nội dung hiện tại chưa được gửi và sẽ không được lưu.", [{ text: "Soạn tiếp", style: "cancel" }, { text: "Xem danh sách", onPress: onList }]); else onList(); }} />
  </ScrollView></KeyboardAvoidingView>;
}

function ReportDetail({ id, onBack, registerBack }: { id: string; onBack: () => void; registerBack: (action: () => void) => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  const loader = useCallback(async (signal: AbortSignal) => { const [report, reasons] = await Promise.all([getViolation(id, signal), getViolationReasons(signal)]); return { report, reasons }; }, [id]);
  const result = useTicketData(loader, true, queryOptions); const report = result.data?.report;
  useEffect(() => { registerBack(onBack); }, [registerBack, onBack]);
  return <View style={styles.screen}><TicketHeader title="Chi tiết báo cáo" subtitle={id.slice(0, 8).toUpperCase()} onBack={onBack} onRefresh={result.refresh} refreshLabel="Làm mới báo cáo" busy={result.refreshing} /><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={result.refreshing && !result.loading} onRefresh={result.refresh} tintColor={theme.brand} />}>
    {result.loading && <View style={styles.empty}><ActivityIndicator size="large" color={theme.brand} /><AppText style={styles.muted}>Đang tải hồ sơ…</AppText></View>}{result.error && <TicketNotice message={result.error} onRetry={result.refresh} />}
    {report && <><View style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontWeight: "700" }}>{targetLabels[report.targetType]}</AppText><ReportStatus status={report.status} /></View><AppText display style={styles.title}>{report.targetLabel}</AppText><AppText style={styles.body}>{result.data?.reasons.find(r => r.code === report.reason)?.label ?? report.reason}</AppText><AppText style={styles.muted}>Đã gửi: {ticketDate(report.createdAt)}{`\nCập nhật: ${ticketDate(report.updatedAt)}`}</AppText></View>
      {report.status === "Open" || report.status === "InReview" ? <View style={[styles.card, { backgroundColor: theme.brandSoft }]}><AppText style={styles.label}>Báo cáo đang được xác minh</AppText><AppText style={styles.body}>Đã tiếp nhận phản ánh của bạn. Chưa có kết luận đối tượng vi phạm. Kết quả sẽ được cập nhật tại đây và qua thông báo.</AppText></View> : <View style={[styles.card, { borderColor: report.status === "Resolved" ? theme.success : theme.border }]}><View style={styles.row}><CheckCircle2 color={report.status === "Resolved" ? theme.success : theme.muted} size={22} /><AppText style={styles.title}>Kết quả xác minh</AppText></View><AppText style={styles.label}>{statusLabels[report.status]}</AppText>{report.decision && <AppText style={styles.body}>{actionLabels[report.decision] ?? "Bộ phận kiểm duyệt đã ghi nhận kết luận."}</AppText>}<AppText selectable style={styles.body}>{report.resolution?.trim() || "Chưa có nội dung kết luận hiển thị."}</AppText>{report.closedAt && <AppText style={styles.muted}>{ticketDate(report.closedAt)}</AppText>}</View>}
      <View style={styles.card}><AppText style={styles.title}>Nội dung bạn đã gửi</AppText><AppText selectable style={styles.body}>{report.description}</AppText><TicketGallery value={JSON.stringify(report.evidenceUrls.filter(safeEvidence))} /></View>
      <View style={styles.card}><AppText style={styles.title}>Tiến trình xử lý</AppText>{report.history.filter(item => !item.internal && item.action !== "InternalNote").map(item => <View key={item.id} style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: theme.brandBorder, paddingLeft: 13, paddingVertical: 7 }}><AppText style={styles.label}>{actionLabels[item.action] ?? "Cập nhật hồ sơ"}</AppText>{Boolean(item.note) && <AppText style={styles.body}>{item.note}</AppText>}<AppText style={styles.muted}>{item.actorName} · {ticketDate(item.createdAt)}</AppText></View>)}</View>
      <AppText style={styles.muted}>Chỉ người gửi được xem báo cáo của mình. Tự kiểm tra cập nhật mỗi 20 giây khi màn hình đang hoạt động.</AppText>
    </>}
  </ScrollView></View>;
}
