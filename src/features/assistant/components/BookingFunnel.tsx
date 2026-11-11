import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import AddressAutocomplete from "@/features/locations/components/AddressAutocomplete";
import { formatDateTime } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";
import { getConversationState, getDraft, patchDraft, prepareDraft, type BookingDraft, type DraftSlots, type ResourceCard } from "../assistantService";
import { BookingPaymentCard, ConfirmationCard } from "./AssistantBooking";

const steps = ["dates", "vehicle", "promo", "pickup", "confirm"] as const;

export default function BookingFunnel({ conversationId, vehicles, revision, onClose, onViewBooking }: {
  conversationId: string; vehicles: ResourceCard[]; revision: number; onClose: () => void; onViewBooking?: (id: number) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [slots, setSlots] = useState<DraftSlots>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const lock = useRef(false);
  const dirty = useRef(false);
  const openBooking = onViewBooking ? (id: number) => { onClose(); onViewBooking(id); } : undefined;
  useEffect(() => {
    const abort = new AbortController();
    getDraft(conversationId, abort.signal).then(async current => {
      const state = current ? null : await getConversationState(conversationId, abort.signal);
      if (abort.signal.aborted || dirty.current) return;
      setDraft(previous => previous?.version === current?.version && previous?.confirmToken ? previous : current);
      setSlots(current?.slots ?? { startAt: state?.activeFilters.startAt as string | undefined, endAt: state?.activeFilters.endAt as string | undefined, vehicleId: state?.focusVehicleId });
      setLoaded(true);
    }).catch(err => { if (!abort.signal.aborted) setError(getApiErrorMessage(err, t("mobile:assistant.funnel.loadError"))); });
    return () => abort.abort();
  }, [conversationId, revision]);
  function edit(patch: Partial<DraftSlots>) { dirty.current = true; setSlots(value => ({ ...value, ...patch })); }
  async function next() {
    if (lock.current) return;
    const start = Date.parse(slots.startAt ?? ""), end = Date.parse(slots.endAt ?? "");
    if (step === 0 && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now())) { setError(t("mobile:assistant.funnel.datesInvalid")); return; }
    if (step === 1 && !slots.vehicleId) { setError(t("mobile:assistant.funnel.vehicleMissing")); return; }
    if (step === 3 && (!slots.pickupMode || (slots.pickupMode === "delivery" && !slots.pickupAddress?.trim()))) { setError(t("mobile:assistant.funnel.pickupMissing")); return; }
    if (step === 3 && slots.pickupMode === "delivery" && (slots.pickupLatitude == null || slots.pickupLongitude == null)) { setError(t("mobile:assistant.funnel.pickupGeoMissing")); return; }
    if (step === 3 && slots.returnAddress?.trim() && (slots.returnLatitude == null || slots.returnLongitude == null)) { setError(t("mobile:assistant.funnel.returnGeoMissing")); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const changed = Object.fromEntries(Object.entries(slots).filter(([key, value]) => value !== draft?.slots[key as keyof DraftSlots]));
      for (const [address, latitude, longitude] of [["pickupAddress", "pickupLatitude", "pickupLongitude"], ["returnAddress", "returnLatitude", "returnLongitude"]] as const)
        if ([address, latitude, longitude].some(key => key in changed)) { changed[latitude] = slots[latitude] ?? null; changed[longitude] = slots[longitude] ?? null; }
      let saved = Object.keys(changed).length || !draft ? await patchDraft(conversationId, draft?.version ?? 0, changed) : draft;
      if (step === 3) saved = await prepareDraft(conversationId, saved.version);
      setDraft(saved); setSlots(saved.slots); dirty.current = false; setStep(value => value + 1);
    } catch (err) {
      setError(getApiErrorMessage(err, t("mobile:assistant.funnel.saveError")));
      const latest = await getDraft(conversationId).catch(() => null);
      if (latest) { setDraft(latest); setSlots(latest.slots); dirty.current = false; }
    } finally { lock.current = false; setBusy(false); }
  }
  const button = { padding: 14, borderRadius: 12, backgroundColor: theme.brandSoft, marginVertical: 4 };
  const text = { color: theme.text, fontSize: 14 };
  const input = { color: theme.text, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12 };
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}><Text style={text}>{t("mobile:assistant.funnel.title")}</Text><Pressable onPress={onClose}><Text style={{ color: theme.brand }}>{t("mobile:assistant.funnel.close")}</Text></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 }}>{steps.map((key, index) => <Text key={key} style={{ color: step === index ? theme.brand : theme.muted }}>{index + 1}. {t(`mobile:assistant.funnel.steps.${key}`)}</Text>)}</View>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
      {!loaded ? <ActivityIndicator color={theme.brand} /> : draft?.bookingId ? <BookingPaymentCard conversationId={conversationId} bookingId={draft.bookingId} onViewBooking={openBooking} /> : <>
        {step === 0 && <><Text style={text}>{t("mobile:assistant.funnel.startAt", { date: slots.startAt ? formatDateTime(slots.startAt) : t("mobile:assistant.funnel.notChosen") })}</Text><Text style={text}>{t("mobile:assistant.funnel.endAt", { date: slots.endAt ? formatDateTime(slots.endAt) : t("mobile:assistant.funnel.notChosen") })}</Text><Pressable style={button} onPress={() => setPeriodOpen(true)}><Text style={text}>{t("mobile:assistant.funnel.choosePeriod")}</Text></Pressable></>}
        {step === 1 && <>{!vehicles.length && <Text style={text}>{t("mobile:assistant.funnel.noVehicles")}</Text>}{vehicles.map(vehicle => <Pressable key={vehicle.id} onPress={() => edit({ vehicleId: vehicle.id })} accessibilityRole="radio" accessibilityState={{ checked: slots.vehicleId === vehicle.id }} style={[button, { borderWidth: 1, borderColor: slots.vehicleId === vehicle.id ? theme.brand : theme.border }]}><Text style={text}>{vehicle.brandName} {vehicle.modelName} · {vehicle.areaName}</Text></Pressable>)}{!!slots.vehicleId && !vehicles.some(v => v.id === slots.vehicleId) && <Text style={text}>{t("mobile:assistant.funnel.selectedVehicle", { id: slots.vehicleId })}</Text>}</>}
        {step === 2 && <><Text style={text}>{t("mobile:assistant.funnel.promoTitle")}</Text><TextInput accessibilityLabel={t("mobile:assistant.funnel.promoLabel")} value={slots.promoCode ?? ""} onChangeText={value => edit({ promoCode: value.toUpperCase() || null })} maxLength={50} autoCapitalize="characters" style={input} /><Text style={{ color: theme.muted }}>{t("mobile:assistant.funnel.promoHint")}</Text></>}
        {step === 3 && <><Text style={text}>{t("mobile:assistant.funnel.pickupTitle")}</Text>{(["self_pickup", "delivery"] as const).map(mode => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: slots.pickupMode === mode }} style={button} onPress={() => { if (slots.pickupMode !== mode) edit({ pickupMode: mode, pickupAddress: null, pickupLatitude: null, pickupLongitude: null }); }}><Text style={text}>{slots.pickupMode === mode ? "✓ " : ""}{mode === "self_pickup" ? t("mobile:assistant.funnel.pickupSelf") : t("mobile:assistant.funnel.pickupDelivery")}</Text></Pressable>)}{slots.pickupMode === "delivery" && <>
          <AddressAutocomplete label={t("mobile:assistant.funnel.deliveryAddress")} value={slots.pickupAddress ?? ""}
            onChange={value => edit({ pickupAddress: value.slice(0, 500), pickupLatitude: null, pickupLongitude: null })}
            onManualChange={() => edit({ pickupLatitude: null, pickupLongitude: null })}
            onSelect={selected => edit({ pickupAddress: selected.address.slice(0, 500), pickupLatitude: selected.latitude, pickupLongitude: selected.longitude })} />
          <Text style={{ color: theme.muted }}>{t("mobile:assistant.funnel.deliveryFeeHint")}</Text></>}
          {(slots.pickupMode === "delivery" || slots.returnAddress) && <AddressAutocomplete label={t("mobile:assistant.funnel.returnAddress")} value={slots.returnAddress ?? ""}
            onChange={value => edit({ returnAddress: value.slice(0, 500) || null, returnLatitude: null, returnLongitude: null })}
            onManualChange={() => edit({ returnLatitude: null, returnLongitude: null })}
            onSelect={selected => edit({ returnAddress: selected.address.slice(0, 500), returnLatitude: selected.latitude, returnLongitude: selected.longitude })} />}
          <TextInput accessibilityLabel={t("mobile:assistant.funnel.note")} placeholder={t("mobile:assistant.funnel.note")} placeholderTextColor={theme.muted} value={slots.customerNote ?? ""} onChangeText={value => edit({ customerNote: value })} maxLength={500} style={input} /></>}
        {step === 4 && draft && <ConfirmationCard conversationId={conversationId} proposal={draft} onViewBooking={openBooking} />}
      </>}
    </ScrollView>
    {loaded && !draft?.bookingId && <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16 }}><Pressable disabled={!step || busy} onPress={() => setStep(value => value - 1)}><Text style={{ color: !step || busy ? theme.muted : theme.brand }}>{t("mobile:assistant.funnel.back")}</Text></Pressable>{step < 4 && <Pressable disabled={busy} onPress={() => void next()}><Text style={{ color: theme.brand }}>{busy ? t("mobile:assistant.funnel.saving") : t("mobile:assistant.funnel.next")}</Text></Pressable>}</View>}
    <RentalPeriodSheet visible={periodOpen} startDate={slots.startAt ?? ""} endDate={slots.endAt ?? ""} onStartDateChange={value => edit({ startAt: value })} onEndDateChange={value => edit({ endAt: value })} onClose={() => setPeriodOpen(false)} />
  </View>;
}
