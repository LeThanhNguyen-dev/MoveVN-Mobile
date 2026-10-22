import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import { formatDateTime } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";
import { getConversationState, getDraft, patchDraft, prepareDraft, type BookingDraft, type DraftSlots, type ResourceCard } from "../assistantService";
import { BookingPaymentCard, ConfirmationCard } from "./AssistantBooking";

const steps = ["Ngày thuê", "Chọn xe", "Khuyến mãi", "Nhận xe", "Xác nhận"];

export default function BookingFunnel({ conversationId, vehicles, revision, onClose, onViewBooking }: {
  conversationId: string; vehicles: ResourceCard[]; revision: number; onClose: () => void; onViewBooking?: (id: number) => void;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [slots, setSlots] = useState<DraftSlots>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const lock = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    getDraft(conversationId, abort.signal).then(async current => {
      const state = current ? null : await getConversationState(conversationId, abort.signal);
      if (abort.signal.aborted || dirty.current) return;
      setDraft(previous => previous?.version === current?.version && previous?.confirmToken ? previous : current);
      setSlots(current?.slots ?? { startAt: state?.activeFilters.startAt as string | undefined, endAt: state?.activeFilters.endAt as string | undefined, vehicleId: state?.focusVehicleId });
      setLoaded(true);
    }).catch(err => { if (!abort.signal.aborted) setError(getApiErrorMessage(err, "Chưa tải được thông tin đặt xe.")); });
    return () => abort.abort();
  }, [conversationId, revision]);
  function edit(patch: Partial<DraftSlots>) { dirty.current = true; setSlots(value => ({ ...value, ...patch })); }
  async function next() {
    if (lock.current) return;
    const start = Date.parse(slots.startAt ?? ""), end = Date.parse(slots.endAt ?? "");
    if (step === 0 && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now())) { setError("Chọn ngày nhận trong tương lai và ngày trả sau ngày nhận."); return; }
    if (step === 1 && !slots.vehicleId) { setError("Bạn chọn một xe để tiếp tục nhé."); return; }
    if (step === 3 && (!slots.pickupMode || (slots.pickupMode === "delivery" && !slots.pickupAddress?.trim()))) { setError("Chọn cách nhận xe và nhập địa chỉ nếu cần giao xe."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const changed = Object.fromEntries(Object.entries(slots).filter(([key, value]) => value !== draft?.slots[key as keyof DraftSlots]));
      let saved = Object.keys(changed).length || !draft ? await patchDraft(conversationId, draft?.version ?? 0, changed) : draft;
      if (step === 3) saved = await prepareDraft(conversationId, saved.version);
      setDraft(saved); setSlots(saved.slots); dirty.current = false; setStep(value => value + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, "Thông tin đã thay đổi hoặc chưa hợp lệ. Vui lòng kiểm tra lại."));
      const latest = await getDraft(conversationId).catch(() => null);
      if (latest) { setDraft(latest); setSlots(latest.slots); dirty.current = false; }
    } finally { lock.current = false; setBusy(false); }
  }
  const button = { padding: 14, borderRadius: 12, backgroundColor: theme.brandSoft, marginVertical: 4 };
  const text = { color: theme.text, fontSize: 14 };
  const input = { color: theme.text, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 };
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}><Text style={text}>Đặt xe nhanh</Text><Pressable onPress={onClose}><Text style={{ color: theme.brand }}>Đóng</Text></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 }}>{steps.map((label, index) => <Text key={label} style={{ color: step === index ? theme.brand : theme.muted }}>{index + 1}. {label}</Text>)}</View>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
      {!loaded ? <ActivityIndicator color={theme.brand} /> : draft?.bookingId ? <BookingPaymentCard conversationId={conversationId} bookingId={draft.bookingId} onViewBooking={onViewBooking} /> : <>
        {step === 0 && <><Text style={text}>Ngày nhận: {slots.startAt ? formatDateTime(slots.startAt) : "Chưa chọn"}</Text><Text style={text}>Ngày trả: {slots.endAt ? formatDateTime(slots.endAt) : "Chưa chọn"}</Text><Pressable style={button} onPress={() => setPeriodOpen(true)}><Text style={text}>Chọn ngày và giờ thuê</Text></Pressable></>}
        {step === 1 && <>{!vehicles.length && <Text style={text}>Nhờ trợ lý tìm xe trong chat; xe tìm được sẽ xuất hiện ở đây.</Text>}{vehicles.map(vehicle => <Pressable key={vehicle.id} onPress={() => edit({ vehicleId: vehicle.id })} accessibilityRole="radio" accessibilityState={{ checked: slots.vehicleId === vehicle.id }} style={[button, { borderWidth: 1, borderColor: slots.vehicleId === vehicle.id ? theme.brand : theme.border }]}><Text style={text}>{vehicle.brandName} {vehicle.modelName} · {vehicle.areaName}</Text></Pressable>)}{!!slots.vehicleId && !vehicles.some(v => v.id === slots.vehicleId) && <Text style={text}>Đã chọn xe #{slots.vehicleId}</Text>}</>}
        {step === 2 && <><Text style={text}>Mã khuyến mãi (nếu có)</Text><TextInput accessibilityLabel="Mã khuyến mãi" value={slots.promoCode ?? ""} onChangeText={value => edit({ promoCode: value.toUpperCase() || null })} maxLength={50} autoCapitalize="characters" style={input} /><Text style={{ color: theme.muted }}>Mã sẽ được kiểm tra khi báo giá.</Text></>}
        {step === 3 && <><Text style={text}>Cách nhận xe</Text>{(["self_pickup", "delivery"] as const).map(mode => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: slots.pickupMode === mode }} style={button} onPress={() => edit({ pickupMode: mode })}><Text style={text}>{slots.pickupMode === mode ? "✓ " : ""}{mode === "self_pickup" ? "Tự đến nhận tại chủ xe" : "Giao xe — cần nhân viên báo phí"}</Text></Pressable>)}{slots.pickupMode === "delivery" && <TextInput accessibilityLabel="Địa chỉ giao xe" placeholder="Địa chỉ giao xe" placeholderTextColor={theme.muted} value={slots.pickupAddress ?? ""} onChangeText={value => edit({ pickupAddress: value })} maxLength={500} style={input} />}<TextInput accessibilityLabel="Ghi chú" placeholder="Ghi chú" placeholderTextColor={theme.muted} value={slots.customerNote ?? ""} onChangeText={value => edit({ customerNote: value })} maxLength={500} style={input} /></>}
        {step === 4 && draft && <ConfirmationCard conversationId={conversationId} proposal={draft} onViewBooking={onViewBooking} />}
      </>}
    </ScrollView>
    {loaded && !draft?.bookingId && <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16 }}><Pressable disabled={!step || busy} onPress={() => setStep(value => value - 1)}><Text style={{ color: !step || busy ? theme.muted : theme.brand }}>Quay lại</Text></Pressable>{step < 4 && <Pressable disabled={busy} onPress={() => void next()}><Text style={{ color: theme.brand }}>{busy ? "Đang lưu…" : "Tiếp tục"}</Text></Pressable>}</View>}
    <RentalPeriodSheet visible={periodOpen} startDate={slots.startAt ?? ""} endDate={slots.endAt ?? ""} onStartDateChange={value => edit({ startAt: value })} onEndDateChange={value => edit({ endAt: value })} onClose={() => setPeriodOpen(false)} />
  </View>;
}
