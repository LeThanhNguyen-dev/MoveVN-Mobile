import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ArrowLeft, BarChart3, CalendarCheck, CarFront, ChevronDown, ChevronUp, CircleHelp, Download, RefreshCw, SlidersHorizontal, Star, Trophy, X } from "lucide-react-native";
import AppText from "@/components/AppText";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import { getApiErrorMessage } from "@/services/apiClient";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getOwnerAnalytics } from "./service";
import { downloadOwnerWorkbook } from "./downloadWorkbook";
import OwnerVehicleDetails from "./OwnerVehicleDetails";
import { comparison, datePreset, defaultFilters, money, number, percent, presetLabels, shortDate, validateDates, type AnalyticsFilters, type OwnerAnalytics, type OwnerTrendPoint, type VehicleAnalytics } from "./types";

export default function OwnerAnalyticsScreen({ user, onAvatarPress, onBack }: { user: AuthUser; onAvatarPress?: () => void; onBack?: () => void }) {
  const { theme } = useTheme(); const styles = useMemo(() => createStyles(theme), [theme]);
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState({ fromDate: filters.fromDate, toDate: filters.toDate, granularity: filters.granularity });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [data, setData] = useState<OwnerAnalytics | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [formError, setFormError] = useState("");
  const [reload, setReload] = useState(0); const [exporting, setExporting] = useState(false); const [exportError, setExportError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false); const [definitionsOpen, setDefinitionsOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  useEffect(() => { setDraft({ fromDate: filters.fromDate, toDate: filters.toDate, granularity: filters.granularity }); setFormError(""); setExportError(""); }, [filters]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    getOwnerAnalytics(filters, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(e => { if (!controller.signal.aborted) setError(getApiErrorMessage(e, "Không tải được thống kê. Vui lòng thử lại.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, reload]);
  function update(values: Partial<AnalyticsFilters>) {
    const resetDetails = ["vehicleId", "fromDate", "toDate"].some(key => key in values);
    setFilters(f => ({ ...f, ...values, ...(resetDetails ? { bookingPage: 1, disputePage: 1 } : {}), page: values.page ?? 1 }));
  }
  function apply() {
    const issue = validateDates(draft.fromDate, draft.toDate);
    setFormError(issue);
    if (!issue) {
      update(draft);
      setFiltersExpanded(false);
    }
  }
  async function download() {
    if (!data || exporting) return; setExporting(true); setExportError("");
    try { await downloadOwnerWorkbook(filters); }
    catch (e) { setExportError(e instanceof Error && e.message ? e.message : "Chưa thể xuất Excel. Vui lòng thử lại."); }
    finally { setExporting(false); }
  }
  const selected = data?.vehicleOptions.find(v => v.vehicleId === filters.vehicleId);
  const chooseVehicle = (id?: number) => { update({ vehicleId: id }); setPickerOpen(false); setVehicleSearch(""); };
  const action = (label: string, onPress: () => void, primary = false, disabled = false, child?: ReactNode) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primaryButton, disabled && styles.disabled]}>{child}<AppText style={[styles.buttonText, primary && styles.primaryText]}>{label}</AppText></Pressable>;
  return <View style={styles.root}>
    <View style={styles.header}>{onBack ? <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.iconButton}><ArrowLeft size={21} color={theme.text} /></Pressable>
      <AppText numberOfLines={1} style={[styles.title, styles.flex]}>Thống kê đội xe</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Làm mới thống kê" accessibilityState={{ disabled: loading }} onPress={() => setReload(n => n + 1)} disabled={loading} style={[styles.iconButton, loading && styles.disabled]}><RefreshCw size={18} color={theme.brand} /></Pressable>
    </View> : <AppDashboardHeader user={user} onAvatarPress={onAvatarPress} />}</View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(n => n + 1)} tintColor={theme.brand} colors={[theme.brand]} />}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><BarChart3 size={20} color={theme.brand} /></View>
        <View style={styles.flex}><AppText style={styles.heroTitle}>Hiệu quả đội xe</AppText><AppText style={styles.hint}>Thu nhập, đơn thuê và đánh giá của bạn.</AppText></View>
      </View>
      <View style={[styles.panel, styles.filterPanel]}><View style={styles.rowBetween}>
        <AppText style={styles.filterTitle}>Kỳ thống kê</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Tùy chỉnh kỳ thống kê" accessibilityState={{ expanded: filtersExpanded }} onPress={() => setFiltersExpanded(value => !value)} style={styles.filterToggle}>
          <SlidersHorizontal size={14} color={theme.brand} /><AppText style={styles.filterToggleText}>Tùy chỉnh</AppText>{filtersExpanded ? <ChevronUp size={14} color={theme.brand} /> : <ChevronDown size={14} color={theme.brand} />}
        </Pressable>
      </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{presetLabels.map(p => { const dates = datePreset(p.key); const active = dates.fromDate === filters.fromDate && dates.toDate === filters.toDate; return <Pressable key={p.key} accessibilityRole="button" accessibilityLabel={p.label} accessibilityState={{ selected: active }} onPress={() => update(dates)} style={[styles.chip, active && styles.activeChip]}><AppText style={[styles.chipText, active && styles.activeChipText]}>{p.label}</AppText></Pressable>; })}</ScrollView>
        {filtersExpanded ? <View style={styles.advancedFilters}>
        <View style={styles.dateRow}><View style={styles.flex}><AppText style={styles.label}>Từ ngày</AppText><TextInput accessibilityLabel="Từ ngày" placeholder="YYYY-MM-DD" placeholderTextColor={theme.faint} value={draft.fromDate} onChangeText={text => setDraft(d => ({ ...d, fromDate: text }))} maxLength={10} autoCapitalize="none" style={styles.input} /></View><View style={styles.flex}><AppText style={styles.label}>Đến ngày</AppText><TextInput accessibilityLabel="Đến ngày" placeholder="YYYY-MM-DD" placeholderTextColor={theme.faint} value={draft.toDate} onChangeText={text => setDraft(d => ({ ...d, toDate: text }))} maxLength={10} autoCapitalize="none" style={styles.input} /></View></View>
        <View style={styles.groupRow}><AppText style={styles.label}>Nhóm biểu đồ</AppText><View style={styles.chips}>{([['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={"Nhóm theo " + label.toLowerCase()} accessibilityState={{ selected: draft.granularity === key }} onPress={() => setDraft(value => ({ ...value, granularity: key }))} style={[styles.chip, draft.granularity === key && styles.activeChip]}><AppText style={[styles.chipText, draft.granularity === key && styles.activeChipText]}>{label}</AppText></Pressable>)}</View></View>
        {formError ? <AppText accessibilityRole="alert" style={styles.error}>{formError}</AppText> : null}
        {action("Áp dụng", apply, true)}
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Chọn xe thống kê" disabled={!data || loading} onPress={() => setPickerOpen(true)} style={styles.select}><CarFront size={16} color={theme.brand} /><AppText numberOfLines={1} style={[styles.body, styles.flex]}>{selected ? selected.licensePlate + " · " + selected.name : filters.vehicleId ? "Xe #" + filters.vehicleId : "Toàn bộ đội xe"}</AppText><ChevronDown size={17} color={theme.muted} /></Pressable>
        <View style={styles.rowBetween}><AppText style={styles.hint}>{shortDate(filters.fromDate)} – {shortDate(filters.toDate)}</AppText><AppText style={styles.hint}>Giờ Việt Nam</AppText></View>
        {filters.vehicleId ? action("Xem toàn bộ đội xe", () => update({ vehicleId: undefined })) : null}
      </View>
      {exportError ? <AppText accessibilityRole="alert" style={styles.errorBox}>{exportError}</AppText> : null}
      {loading ? <View style={styles.empty}><ActivityIndicator color={theme.brand} /><AppText style={styles.description}>Đang tổng hợp thống kê…</AppText></View> : error ? <View style={styles.panel}><AppText accessibilityRole="alert" style={styles.error}>{error}</AppText>{action("Thử lại", () => setReload(n => n + 1))}{action("Xóa bộ lọc", () => setFilters(defaultFilters()))}</View> : data ? <>
        <AppText style={styles.hint}>So với kỳ trước: {shortDate(data.comparisonPeriod.fromDate)} – {shortDate(data.comparisonPeriod.toDate)}</AppText>
        <View style={styles.income}><View style={styles.row}><View style={styles.heroIcon}><BarChart3 size={20} color={theme.brand} /></View><AppText style={styles.label}>Thu nhập qua ví</AppText></View><AppText display style={styles.incomeValue}>{money(data.summary.walletIncome)}</AppText><AppText style={styles.body}>{comparison(data.summary.walletIncome, data.previousSummary.walletIncome)}</AppText><AppText style={styles.hint}>Giao dịch đã ghi nhận, không phải lợi nhuận hay tiền đã chuyển vào ngân hàng.</AppText></View>
        <View style={styles.metricGrid}><Metric label="Đơn hợp lệ" value={number(data.summary.confirmedBookings)} hint={`${data.summary.bookingsCreated} yêu cầu mới`} theme={theme} /><Metric label="Chuyến hoàn tất" value={number(data.summary.completedTrips)} hint="Theo ngày hoàn tất" theme={theme} /><Metric label="Ngày có lịch thuê" value={percent(data.summary.utilizationRate)} hint={`${data.summary.bookedDays}/${data.summary.fleetDays} ngày đội xe`} theme={theme} /><Metric label="Tỷ lệ hủy" value={percent(data.summary.cancellationRate)} hint={`${data.summary.cancelledBookings} hủy · ${data.summary.rejectedBookings} từ chối`} theme={theme} /></View>
        <View style={styles.panel}><View style={styles.row}><Star size={18} color={theme.brand} /><AppText style={styles.title}>Đánh giá xe</AppText><AppText style={[styles.body, { marginLeft: 'auto' }]}>{data.summary.averageRating === null ? "Chưa có" : number(data.summary.averageRating) + " / 5"}</AppText></View><AppText style={styles.hint}>{data.summary.reviewCount} đánh giá công khai trong kỳ</AppText><View style={styles.divider} />{[["Giá trị chuyến hoàn tất", data.summary.completedTripValue], ["Thu nhập booking", data.summary.bookingEarnings], ["Tài trợ voucher đã nhận", data.summary.sponsorIncome], ["Điều chỉnh thu nhập", data.summary.incomeReversals]].map(([label, value]) => <View key={label} style={styles.rowBetween}><AppText style={[styles.hint, styles.flex]}>{label}</AppText><AppText style={styles.body}>{money(Number(value))}</AppText></View>)}</View>
        <View style={styles.panel}><AppText display style={styles.title}>Tranh chấp liên quan đến xe</AppText><AppText style={styles.hint}>Hồ sơ tạo trong kỳ; trạng thái là hiện tại của nhóm hồ sơ này.</AppText><View style={styles.vehicleGrid}><Small label="Tạo trong kỳ" value={number(data.summary.disputesCreated ?? 0)} theme={theme} /><Small label="Đang xử lý" value={number(data.summary.openDisputes ?? 0)} theme={theme} /><Small label="Đã xử lý" value={number(data.summary.resolvedDisputes ?? 0)} theme={theme} /><Small label="Lũy kế đến cuối kỳ" value={number(data.summary.lifetimeDisputes ?? 0)} theme={theme} /></View>{!filters.vehicleId && <AppText style={styles.hint}>Chọn xe để xem từng hồ sơ và lịch sử đặt xe.</AppText>}</View>
        {filters.vehicleId && <OwnerVehicleDetails key={user.userId} data={data} userId={user.userId} onBookingPage={bookingPage => update({ bookingPage })} onDisputePage={disputePage => update({ disputePage })} />}
        <Trend points={data.trend} theme={theme} />
        <Ranking title="Xe được đặt nhiều nhất" hint="Theo đơn hợp lệ thuộc nhóm yêu cầu mới trong kỳ." items={data.topBookedVehicles} metric="bookings" onSelect={chooseVehicle} theme={theme} />
        <Ranking title="Xe có thu nhập cao nhất" hint="Theo giao dịch thực ghi nhận qua ví trong kỳ." items={data.topIncomeVehicles} metric="income" onSelect={chooseVehicle} theme={theme} />
        <View style={styles.panel}><AppText display style={styles.title}>Hiệu quả từng xe</AppText><AppText style={styles.hint}>{data.vehicles.totalCount} xe · Bao gồm xe chưa có đơn</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{([['income', 'Thu nhập'], ['bookings', 'Đơn hợp lệ'], ['disputes', 'Tranh chấp'], ['utilization', 'Lịch thuê']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={"Sắp xếp theo " + label.toLowerCase()} accessibilityState={{ selected: filters.sort === key }} onPress={() => update({ sort: key })} style={[styles.chip, filters.sort === key && styles.activeChip]}><AppText style={[styles.chipText, filters.sort === key && styles.activeChipText]}>{label}</AppText></Pressable>)}</ScrollView>
          {data.vehicles.items.length === 0 ? <View style={styles.empty}><CarFront size={30} color={theme.brand} /><AppText style={styles.description}>Không có xe trong trang hoặc khoảng thời gian này.</AppText></View> : data.vehicles.items.map(v => <View key={v.vehicleId} style={styles.vehicleCard}><View style={styles.row}><View style={styles.heroIcon}><CarFront size={18} color={theme.brand} /></View><View style={styles.flex}><AppText style={styles.vehicleName}>{v.name}</AppText><AppText style={styles.hint}>{v.licensePlate}</AppText></View></View><View style={styles.vehicleGrid}><Small label="Thu nhập qua ví" value={money(v.walletIncome)} theme={theme} /><Small label="Đơn hợp lệ / Yêu cầu" value={`${v.confirmedBookings} / ${v.bookingsCreated}`} theme={theme} /><Small label="Lịch thuê" value={`${v.bookedDays}/${v.fleetDays} ngày · ${percent(v.utilizationRate)}`} theme={theme} /><Small label="Hoàn tất / Hủy" value={`${v.completedTrips} / ${v.cancelledBookings}`} theme={theme} /><Small label="Đánh giá" value={v.averageRating === null ? "Chưa có" : `${number(v.averageRating)} / 5 (${v.reviewCount})`} theme={theme} /><Small label="Tranh chấp trong kỳ" value={`${v.disputesCreated ?? 0} hồ sơ / ${v.openDisputes ?? 0} đang xử lý`} theme={theme} /></View>{action("Xem thống kê chi tiết", () => chooseVehicle(v.vehicleId))}</View>)}
          <AppText style={[styles.hint, { textAlign: 'center' }]}>Trang {data.vehicles.page} / {Math.max(1, data.vehicles.totalPages)}</AppText><View style={styles.rowBetween}>{action("Trang trước", () => update({ page: filters.page - 1 }), false, filters.page <= 1)}{action("Trang sau", () => update({ page: filters.page + 1 }), false, filters.page >= data.vehicles.totalPages)}</View>
        </View>
        <View style={styles.panel}><View style={styles.row}><CalendarCheck size={18} color={theme.brand} /><AppText style={styles.title}>Gợi ý từ số liệu</AppText></View><AppText style={styles.description}>{data.summary.vehicles === 0 ? "Bạn chưa có xe trong kỳ đã chọn. Thêm xe và hoàn tất duyệt đăng để bắt đầu nhận đơn." : data.summary.vehiclesWithoutBookings > 0 ? `${data.summary.vehiclesWithoutBookings}/${data.summary.vehicles} xe chưa có đơn hợp lệ được tạo trong kỳ. Bạn có thể xem lại lịch trống, giá thuê và nội dung tin đăng.` : "Các xe đều có đơn hợp lệ trong kỳ. Tiếp tục theo dõi thu nhập và tỷ lệ hủy để đánh giá hiệu quả."}</AppText></View>
        {data.completedWithoutDateCount > 0 ? <AppText style={styles.notice}>Có {data.completedWithoutDateCount} chuyến hoàn tất thiếu thời điểm ghi nhận trong dữ liệu cũ. Chưa đưa các chuyến này vào thống kê theo ngày.</AppText> : null}
        <View style={styles.panel}><Pressable accessibilityRole="button" accessibilityLabel="Cách tính số liệu và lưu ý" accessibilityState={{ expanded: definitionsOpen }} onPress={() => setDefinitionsOpen(x => !x)} style={styles.rowBetween}><CircleHelp size={18} color={theme.brand} /><AppText style={[styles.title, styles.flex]}>Cách tính số liệu & lưu ý</AppText><ChevronDown size={17} color={theme.muted} /></Pressable>{definitionsOpen ? data.definitions.map(d => <View key={d.key} style={styles.definition}><AppText style={styles.vehicleName}>{d.label}</AppText><AppText style={styles.description}>{d.description}</AppText></View>) : null}</View>
        {action(exporting ? "Đang xuất Excel…" : "Xuất Excel", () => { void download(); }, true, exporting, exporting ? <ActivityIndicator color={theme.onBrand} /> : <Download size={17} color={theme.onBrand} />)}
        <AppText style={[styles.hint, { textAlign: 'center' }]}>Cập nhật {new Date(data.generatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</AppText>
      </> : null}
    </ScrollView>
    <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}><View style={styles.modalBackdrop}><Pressable accessibilityLabel="Đóng bộ lọc xe" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} /><View style={styles.sheet}><View style={styles.rowBetween}><AppText display style={styles.title}>Chọn xe thống kê</AppText><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setPickerOpen(false)} style={styles.iconButton}><X size={22} color={theme.muted} /></Pressable></View><TextInput accessibilityLabel="Tìm xe" value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Biển số hoặc tên xe" placeholderTextColor={theme.faint} style={styles.input} /><ScrollView keyboardShouldPersistTaps="handled">{action("Toàn bộ đội xe", () => chooseVehicle())}{data?.vehicleOptions.filter(v => (v.name + " " + v.licensePlate).toLowerCase().includes(vehicleSearch.trim().toLowerCase())).map(v => <Pressable key={v.vehicleId} accessibilityRole="button" accessibilityLabel={`Chọn ${v.licensePlate}`} onPress={() => chooseVehicle(v.vehicleId)} style={styles.vehicleOption}><AppText style={styles.vehicleName}>{v.name}</AppText><AppText style={styles.hint}>{v.licensePlate}</AppText></Pressable>)}</ScrollView></View></View></Modal>
  </View>;
}

function Metric({ label, value, hint, theme }: { label: string; value: string; hint: string; theme: Theme }) {
  const styles = createStyles(theme);
  return <View accessibilityLabel={label} style={styles.metric}><AppText style={styles.label}>{label}</AppText><AppText display style={styles.metricValue}>{value}</AppText><AppText style={styles.hint}>{hint}</AppText></View>;
}
function Small({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  const styles = createStyles(theme); return <View style={styles.small}><AppText style={styles.hint}>{label}</AppText><AppText style={styles.body}>{value}</AppText></View>;
}
function Ranking({ title, hint, items, metric, onSelect, theme }: { title: string; hint: string; items: VehicleAnalytics[]; metric: "income" | "bookings"; onSelect: (id: number) => void; theme: Theme }) {
  const styles = createStyles(theme); const max = Math.max(1, ...items.map(v => metric === "income" ? v.walletIncome : v.confirmedBookings));
  return <View style={styles.panel}><View style={styles.row}><Trophy size={18} color={theme.brand} /><AppText display style={[styles.title, styles.flex]}>{title}</AppText></View><AppText style={styles.hint}>{hint}</AppText>{!items.length ? <AppText style={styles.emptyText}>Chưa có dữ liệu để xếp hạng.</AppText> : items.map((v, i) => <Pressable key={v.vehicleId} accessibilityRole="button" accessibilityLabel={`${title}: ${v.licensePlate}`} onPress={() => onSelect(v.vehicleId)} style={styles.rank}><View style={styles.rankIndex}><AppText style={styles.buttonText}>{i + 1}</AppText></View><View style={styles.flex}><View style={styles.rowBetween}><View style={styles.flex}><AppText style={styles.vehicleName}>{v.name}</AppText><AppText style={styles.hint}>{v.licensePlate}</AppText></View><AppText style={styles.rankValue}>{metric === "income" ? money(v.walletIncome) : `${v.confirmedBookings} đơn`}</AppText></View><View style={styles.track}><View style={[styles.bar, { width: `${Math.min(100, (metric === "income" ? v.walletIncome : v.confirmedBookings) / max * 100)}%` }]} /></View></View></Pressable>)}<AppText style={styles.hint}>Chọn xe để xem thống kê riêng.</AppText></View>;
}
function Trend({ points, theme }: { points: OwnerTrendPoint[]; theme: Theme }) {
  const styles = createStyles(theme); const [metric, setMetric] = useState<"walletIncome" | "confirmedBookings">("walletIncome");
  const [active, setActive] = useState<string | null>(null);
  const min = Math.min(0, ...points.map(p => p[metric])); const max = Math.max(1, ...points.map(p => p[metric]));
  const zero = max / (max - min) * 110;
  const selected = points.find(p => p.period === active);
  const format = (value: number) => metric === "walletIncome" ? money(value) : number(value) + " đơn";
  return <View style={styles.panel}><AppText display style={styles.title}>Xu hướng hoạt động</AppText><View style={styles.chips}>{([['walletIncome', 'Thu nhập qua ví'], ['confirmedBookings', 'Đơn hợp lệ']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={"Biểu đồ " + label.toLowerCase()} onPress={() => { setMetric(key); setActive(null); }} style={[styles.chip, metric === key && styles.activeChip]}><AppText style={[styles.chipText, metric === key && styles.activeChipText]}>{label}</AppText></Pressable>)}</View><AppText style={styles.hint}>{selected?.label ?? "Tổng trong kỳ"}</AppText><AppText style={styles.chartValue}>{format(selected ? selected[metric] : points.reduce((n, p) => n + p[metric], 0))}</AppText><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.chartColumns}>{points.map(p => { const h = Math.abs(p[metric]) / (max - min) * 110; return <Pressable key={p.period} accessibilityRole="button" accessibilityLabel={`${p.label}: ${format(p[metric])}`} accessibilityState={{ selected: p.period === active }} onPress={() => setActive(p.period)} style={styles.chartColumn}><View style={styles.chartArea}><View style={[styles.baseline, { top: zero }]} /><View style={[styles.chartBar, { height: h, top: p[metric] >= 0 ? zero - h : zero, backgroundColor: p[metric] < 0 ? theme.danger : theme.brand, opacity: p.period === active ? 1 : 0.6 }]} /></View><AppText numberOfLines={2} style={styles.chartLabel}>{p.label}</AppText></Pressable>; })}</ScrollView><AppText style={styles.hint}>Chạm cột để xem số liệu. Vuốt ngang để xem thêm kỳ.</AppText></View>;
}

const createStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: 12, backgroundColor: t.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  toolbar: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8 },
  content: { padding: 14, gap: 12, paddingBottom: 36 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 }, rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, flex: { flex: 1, minWidth: 0 },
  hero: { padding: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.brandSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: t.brandBorder },
  heroIcon: { padding: 8, borderRadius: 10, backgroundColor: t.brandSoft },
  heroTitle: { color: t.text, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  title: { color: t.text, fontSize: 16, fontWeight: "700" }, description: { color: t.muted, fontSize: 13, lineHeight: 22, marginTop: 5 }, hint: { color: t.muted, fontSize: 11, lineHeight: 18 },
  label: { color: t.muted, fontSize: 12, lineHeight: 19 }, body: { color: t.text, fontSize: 13, fontWeight: "600", lineHeight: 22 }, panel: { backgroundColor: t.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: t.border, gap: 10 },
  filterPanel: { gap: 8 }, filterTitle: { color: t.text, fontSize: 13, fontWeight: "600" },
  filterToggle: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: t.brandSoft },
  filterToggleText: { color: t.brand, fontSize: 11, fontWeight: "600" },
  advancedFilters: { gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  button: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, borderWidth: 1, borderColor: t.brandBorder, backgroundColor: t.brandSoft, paddingVertical: 11, paddingHorizontal: 16 },
  primaryButton: { backgroundColor: t.brand, borderColor: t.brand }, buttonText: { color: t.brand, fontSize: 12, fontWeight: "700" }, primaryText: { color: t.onBrand }, disabled: { opacity: 0.45 }, iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: 6, paddingVertical: 2 }, chip: { minHeight: 34, alignItems: "center", justifyContent: "center", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: t.surfaceAlt }, activeChip: { backgroundColor: t.brand }, chipText: { color: t.muted, fontSize: 11, fontWeight: "600" }, activeChipText: { color: t.onBrand },
  dateRow: { flexDirection: "row", gap: 10 }, input: { borderWidth: 1, borderColor: t.border, borderRadius: 11, backgroundColor: t.input, color: t.text, fontSize: 13, paddingHorizontal: 12, minHeight: 46, marginTop: 6 }, select: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: t.border, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  income: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.brandBorder, padding: 16, gap: 6 }, incomeValue: { color: t.brand, fontSize: 25, lineHeight: 33, fontWeight: "600" }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { width: "47%", flexGrow: 1, padding: 13, borderRadius: 14, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, gap: 5 }, metricValue: { fontSize: 22, color: t.text, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: 4 }, vehicleCard: { padding: 15, borderRadius: 14, borderWidth: 1, borderColor: t.border, gap: 12 }, vehicleName: { fontSize: 13, fontWeight: "700", color: t.text, lineHeight: 21 }, vehicleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, small: { width: "47%", gap: 2 },
  rank: { flexDirection: "row", gap: 10, paddingVertical: 9, alignItems: "center" }, rankIndex: { height: 29, width: 29, backgroundColor: t.brandSoft, borderRadius: 9, alignItems: "center", justifyContent: "center" }, rankValue: { maxWidth: "45%", fontSize: 12, fontWeight: "700", color: t.brand }, track: { height: 5, backgroundColor: t.surfaceAlt, borderRadius: 4, overflow: "hidden", marginTop: 7 }, bar: { height: 5, backgroundColor: t.brand, borderRadius: 4 },
  empty: { paddingVertical: 28, alignItems: "center", gap: 12 }, emptyText: { paddingVertical: 24, textAlign: "center", color: t.muted, fontSize: 13 }, error: { color: t.danger, fontSize: 12, lineHeight: 20 }, errorBox: { color: t.danger, backgroundColor: t.dangerSoft, padding: 15, borderRadius: 12, fontSize: 12, lineHeight: 20 }, notice: { color: t.brand, backgroundColor: t.brandSoft, borderRadius: 14, padding: 16, fontSize: 12, lineHeight: 21 },
  definition: { gap: 4, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }, chartValue: { color: t.brand, fontWeight: "800", fontSize: 20 }, chartColumns: { gap: 8, paddingVertical: 8, minWidth: "100%" }, chartColumn: { width: 56, flexGrow: 1, alignItems: "center" }, chartArea: { width: "100%", height: 112, position: "relative" }, chartBar: { position: "absolute", width: 25, left: "25%", borderRadius: 5 }, baseline: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: t.border }, chartLabel: { fontSize: 9, color: t.muted, textAlign: "center", marginTop: 8, minHeight: 28 },
  modalBackdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" }, sheet: { backgroundColor: t.surface, maxHeight: "75%", padding: 22, paddingBottom: 35, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }, vehicleOption: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
});
