import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Text, TextInput, Pressable, useAssistantLocale } from "../assistantLocale";
import { assistantDate, rentalParts, rentalInstant } from "../assistantLanguage";
import { resolveBookingPeriod, type RentalPeriod } from "../assistantBookingPeriod";
import AddressAutocomplete from "@/features/locations/components/AddressAutocomplete";

import { assistantFailure } from "../assistantService";
import { getConversationState, getDraft, patchDraft, prepareDraft, type BookingDraft, type DraftSlots, type ResourceCard } from "../assistantService";
import { BookingPaymentCard, ConfirmationCard } from "./AssistantBooking";

const steps = ["Ngày thuê", "Chọn xe", "Khuyến mãi", "Nhận xe", "Xác nhận"];

export default function BookingFunnel({ conversationId, vehicles, revision, initialPeriod = {}, onClose, onViewBooking }: {
  conversationId: string; vehicles: ResourceCard[]; revision: number; initialPeriod?: RentalPeriod; onClose: () => void; onViewBooking?: (id: number) => void;
}) {
  const locale = useAssistantLocale();
  const formatDateTime = (value: string) => assistantDate(value, locale);
  const { theme } = useTheme();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [slots, setSlots] = useState<DraftSlots>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dates, setDates] = useState({ startAt: rentalParts(null), endAt: rentalParts(null) });
  const savedVersion = useRef(-1);
  const periodHydrated = useRef(false);
  const lock = useRef(false);
  const dirty = useRef(false);
  const openBooking = onViewBooking ? (id: number) => { onClose(); onViewBooking(id); } : undefined;
  useEffect(() => {
    const abort = new AbortController();
    getDraft(conversationId, abort.signal).then(async current => {
      const state = await getConversationState(conversationId, abort.signal).catch(() => null);
      if (abort.signal.aborted || dirty.current || lock.current || (current?.version ?? 0) < savedVersion.current) return;
      savedVersion.current = current?.version ?? 0;
      setDraft(previous => previous?.version === current?.version && previous?.confirmToken ? previous : current);
      const period = resolveBookingPeriod(current?.slots, state?.activeFilters, !state || !periodHydrated.current ? initialPeriod : {}, state?.slotEvidence);
      const fields = { startAt: rentalParts(period.startAt), endAt: rentalParts(period.endAt) };
      setDates(fields);
      periodHydrated.current = true;
      setSlots({ ...current?.slots, startAt: rentalInstant(fields.startAt), endAt: rentalInstant(fields.endAt), vehicleId: current?.slots.vehicleId ?? state?.focusVehicleId });
      setLoaded(true);
    }).catch(err => { if (!abort.signal.aborted) setError(assistantFailure(err, "Chưa tải được thông tin đặt xe.", locale)); });
    return () => abort.abort();
  }, [conversationId, revision]);
  function edit(patch: Partial<DraftSlots>) { dirty.current = true; setSlots(value => ({ ...value, ...patch })); }
  function editDate(key: "startAt" | "endAt", part: "date" | "time", value: string) {
    const next = { ...dates, [key]: { ...dates[key], [part]: value } };
    setDates(next); edit({ [key]: rentalInstant(next[key]) });
  }
  function diff(base: BookingDraft | null, pending: DraftSlots) {
    const changed = Object.fromEntries(Object.entries(pending).filter(([key, value]) => (["startAt", "endAt"].includes(key) && typeof value === "string" && typeof base?.slots[key as keyof DraftSlots] === "string" ? Date.parse(value) !== Date.parse(base.slots[key as "startAt" | "endAt"]!) : value !== base?.slots[key as keyof DraftSlots])));
    for (const [address, latitude, longitude] of [["pickupAddress", "pickupLatitude", "pickupLongitude"], ["returnAddress", "returnLatitude", "returnLongitude"]] as const)
      if ([address, latitude, longitude].some(key => key in changed)) { changed[latitude] = pending[latitude] ?? null; changed[longitude] = pending[longitude] ?? null; }
    return changed;
  }
  async function save(base: BookingDraft | null, pending: DraftSlots, mayRetry: boolean) {
    const changed = diff(base, pending);
    try {
      let saved = Object.keys(changed).length || !base ? await patchDraft(conversationId, base?.version ?? 0, changed) : base;
      if (step === 3) saved = await prepareDraft(conversationId, saved.version);
      savedVersion.current = saved.version; setDraft(saved); setSlots(saved.slots); dirty.current = false; setStep(value => value + 1);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const latest = await getDraft(conversationId).catch(() => null);
      // Keep the user's edits on top of a newer server snapshot instead of discarding them.
      const merge = (snapshot: BookingDraft) => {
        const merged = { ...snapshot.slots, ...pending };
        savedVersion.current = snapshot.version; setDraft(snapshot); setSlots(merged);
        setDates({ startAt: rentalParts(merged.startAt), endAt: rentalParts(merged.endAt) }); dirty.current = false;
        return merged;
      };
      if (mayRetry && (status === 409 || status === 503) && latest) return save(latest, merge(latest), false);
      setError(assistantFailure(err, "Thông tin đã thay đổi hoặc chưa hợp lệ. Vui lòng kiểm tra lại.", locale, true));
      if (latest && latest.version > savedVersion.current) merge(latest);
    }
  }
  async function next() {
    if (lock.current) return;
    const start = Date.parse(slots.startAt ?? ""), end = Date.parse(slots.endAt ?? "");
    if (step === 0 && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now())) { setError("Chọn ngày nhận trong tương lai và ngày trả sau ngày nhận."); return; }
    if (step === 1 && !slots.vehicleId) { setError("Bạn chọn một xe để tiếp tục nhé."); return; }
    if (step === 3 && (!slots.pickupMode || (slots.pickupMode === "delivery" && !slots.pickupAddress?.trim()))) { setError("Chọn cách nhận xe và nhập địa chỉ nếu cần giao xe."); return; }
    if (step === 3 && slots.pickupMode === "delivery" && (slots.pickupLatitude == null || slots.pickupLongitude == null)) { setError("Chọn địa chỉ giao từ danh sách gợi ý để tính phí theo khoảng cách."); return; }
    if (step === 3 && slots.returnAddress?.trim() && (slots.returnLatitude == null || slots.returnLongitude == null)) { setError("Chọn địa chỉ trả từ danh sách gợi ý hoặc để trống để trả tại điểm nhận."); return; }
    if (step === 3 && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now())) { setError("Ngày nhận phải ở tương lai và ngày trả sau ngày nhận. Bạn cập nhật lại ngày giờ nhé."); return; }
    lock.current = true; setBusy(true); setError("");
    try { await save(draft, slots, true); } finally { lock.current = false; setBusy(false); }
  }
  const button = { padding: 14, borderRadius: 12, backgroundColor: theme.brandSoft, marginVertical: 4 };
  const text = { color: theme.text, fontSize: 14 };
  const input = { color: theme.text, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 };
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}><Text style={text}>Đặt xe nhanh</Text><Pressable onPress={onClose}><Text style={{ color: theme.brand }}>Đóng</Text></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 }}>{steps.map((label, index) => <Text key={label} style={{ color: step === index ? theme.brand : theme.muted }}>{index + 1}. {label}</Text>)}</View>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
      {!loaded ? <ActivityIndicator color={theme.brand} /> : draft?.bookingId ? <BookingPaymentCard conversationId={conversationId} bookingId={draft.bookingId} onViewBooking={openBooking} /> : <>
        {step === 0 && <><Text style={text}>Ngày nhận: {slots.startAt ? formatDateTime(slots.startAt) : "Chưa chọn"}</Text><Text style={text}>Ngày trả: {slots.endAt ? formatDateTime(slots.endAt) : "Chưa chọn"}</Text><Text style={{ color: theme.muted }}>{locale === "en" ? "Vietnam time (UTC+7). Date: YYYY-MM-DD; time: HH:mm." : "Giờ Việt Nam (UTC+7). Ngày: YYYY-MM-DD; giờ: HH:mm."}</Text>
          {(["startAt", "endAt"] as const).map(key => <View key={key} style={{ gap: 6 }}>
            <Text style={text}>{key === "startAt" ? "Ngày nhận:" : "Ngày trả:"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput accessibilityLabel={locale === "en" ? `${key === "startAt" ? "Pickup" : "Return"} date, YYYY-MM-DD` : `${key === "startAt" ? "Ngày nhận" : "Ngày trả"}, YYYY-MM-DD`} placeholder="YYYY-MM-DD" value={dates[key].date} onChangeText={value => editDate(key, "date", value)} maxLength={10} style={[input, { flex: 1 }]} />
              <TextInput accessibilityLabel={locale === "en" ? `${key === "startAt" ? "Pickup" : "Return"} time, HH:mm` : `${key === "startAt" ? "Giờ nhận" : "Giờ trả"}, HH:mm`} placeholder="HH:mm" value={dates[key].time} onChangeText={value => editDate(key, "time", value)} maxLength={5} style={[input, { flex: 1 }]} />
            </View>
          </View>)}</>}
        {step === 1 && <>{!vehicles.length && <Text style={text}>Nhờ trợ lý tìm xe trong chat; xe tìm được sẽ xuất hiện ở đây.</Text>}{vehicles.map(vehicle => <Pressable key={vehicle.id} onPress={() => edit({ vehicleId: vehicle.id })} accessibilityRole="radio" accessibilityState={{ checked: slots.vehicleId === vehicle.id }} style={[button, { borderWidth: 1, borderColor: slots.vehicleId === vehicle.id ? theme.brand : theme.border }]}><Text style={text}>{vehicle.brandName} {vehicle.modelName} · {vehicle.areaName}</Text></Pressable>)}{!!slots.vehicleId && !vehicles.some(v => v.id === slots.vehicleId) && <Text style={text}>Đã chọn xe #{slots.vehicleId}</Text>}</>}
        {step === 2 && <><Text style={text}>Mã khuyến mãi (nếu có)</Text><TextInput accessibilityLabel="Mã khuyến mãi" value={slots.promoCode ?? ""} onChangeText={value => edit({ promoCode: value.toUpperCase() || null })} maxLength={50} autoCapitalize="characters" style={input} /><Text style={{ color: theme.muted }}>Mã sẽ được kiểm tra khi báo giá.</Text></>}
        {step === 3 && <><Text style={text}>Cách nhận xe</Text>{(["self_pickup", "delivery"] as const).map(mode => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: slots.pickupMode === mode }} style={button} onPress={() => { if (slots.pickupMode !== mode) edit({ pickupMode: mode, pickupAddress: null, pickupLatitude: null, pickupLongitude: null }); }}><Text style={text}>{slots.pickupMode === mode ? "✓ " : ""}{mode === "self_pickup" ? "Tự đến nhận tại chủ xe" : "Giao xe tận nơi — tính phí theo khoảng cách"}</Text></Pressable>)}{slots.pickupMode === "delivery" && <>
          <AddressAutocomplete label={locale === "en" ? "Delivery address" : "Địa chỉ giao xe"} placeholder={locale === "en" ? "House number, street…" : "Số nhà, đường..."} locale={locale} value={slots.pickupAddress ?? ""}
            onChange={value => edit({ pickupAddress: value.slice(0, 500), pickupLatitude: null, pickupLongitude: null })}
            onManualChange={() => edit({ pickupLatitude: null, pickupLongitude: null })}
            onSelect={selected => edit({ pickupAddress: selected.address.slice(0, 500), pickupLatitude: selected.latitude, pickupLongitude: selected.longitude })} />
          <Text style={{ color: theme.muted }}>Phí giao được tính theo cấu hình booking và hiển thị trước khi xác nhận.</Text></>}
          {(slots.pickupMode === "delivery" || slots.returnAddress) && <AddressAutocomplete label={locale === "en" ? "Return address (if different)" : "Địa chỉ trả (nếu khác điểm nhận)"} placeholder={locale === "en" ? "House number, street…" : "Số nhà, đường..."} locale={locale} value={slots.returnAddress ?? ""}
            onChange={value => edit({ returnAddress: value.slice(0, 500) || null, returnLatitude: null, returnLongitude: null })}
            onManualChange={() => edit({ returnLatitude: null, returnLongitude: null })}
            onSelect={selected => edit({ returnAddress: selected.address.slice(0, 500), returnLatitude: selected.latitude, returnLongitude: selected.longitude })} />}
          <TextInput accessibilityLabel="Ghi chú" placeholder="Ghi chú" placeholderTextColor={theme.muted} value={slots.customerNote ?? ""} onChangeText={value => edit({ customerNote: value })} maxLength={500} style={input} /></>}
        {step === 4 && draft && <ConfirmationCard conversationId={conversationId} proposal={draft} onViewBooking={openBooking} />}
      </>}
    </ScrollView>
    {loaded && !draft?.bookingId && <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16 }}><Pressable disabled={!step || busy} onPress={() => setStep(value => value - 1)}><Text style={{ color: !step || busy ? theme.muted : theme.brand }}>Quay lại</Text></Pressable>{step < 4 && <Pressable disabled={busy} onPress={() => next()}><Text style={{ color: theme.brand }}>{busy ? "Đang lưu…" : "Tiếp tục"}</Text></Pressable>}</View>}
  </View>;
}
