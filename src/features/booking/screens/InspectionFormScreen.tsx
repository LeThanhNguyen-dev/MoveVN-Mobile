import CheckoutSurchargePicker from "../components/CheckoutSurchargePicker";
import InspectionPhoto from "../components/InspectionPhoto";
import { appendSurcharges, validateSurchargeSelection } from "../checkoutSurcharges";
import type { CheckoutSurchargeSelection } from "../types";
import { checkoutStartDate } from "../bookingDisplay";
import MileageFeePreview from "../components/MileageFeePreview";
import { returnTimeISO, validateCheckoutKm, vietnamInput } from "../checkoutRules";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { createCheckInReport, createCheckOutReport } from "../bookingService";
import { createInspectionForm } from "../inspectionForm";
import { formatVietnamDateTime, inspectionLabel, MAX_INSPECTION_PHOTOS, validateInspectionFields, type InspectionType } from "../bookingDisplay";
import { deleteInspectionPhoto, type CapturedInspectionPhoto } from "../inspectionPhoto";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingButton, BookingCard, BookingField, BookingHeader } from "../components/BookingControls";
import InspectionCameraModal from "../components/InspectionCameraModal";

export default function InspectionFormScreen({ booking, reports = [], type, onBack, onSaved }: {
  booking: BookingResponse; reports?: InspectionReportResponse[]; type: InspectionType; onBack: () => void; onSaved: (report: InspectionReportResponse) => void;
}) {
  const { theme } = useTheme();
  const [additionalSurcharges, setAdditionalSurcharges] = useState<CheckoutSurchargeSelection[]>([]);
  const [actualReturnAt, setActualReturnAt] = useState(() => type === "CheckOut" ? vietnamInput() : "");
  const [timeEdited, setTimeEdited] = useState(false);
  const previous = type === "CheckIn" ? reports.find(r => r.type === "CheckIn") : undefined;
  const [odometer, setOdometer] = useState(previous?.odometerKm?.toString() ?? "");
  const [fuelLevel, setFuelLevel] = useState(previous?.fuelLevel ?? "");
  const [damageNoted, setDamageNoted] = useState(previous?.damageNoted ?? false);
  const [damageDescription, setDamageDescription] = useState(previous?.damageDescription ?? "");
  const [photos, setPhotos] = useState<CapturedInspectionPhoto[]>([]);
  const photoFiles = useRef<CapturedInspectionPhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const [error, setError] = useState("");
  const validation = useMemo(() => validateInspectionFields(odometer, damageNoted, damageDescription, photos.length), [odometer, damageNoted, damageDescription, photos.length]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; photoFiles.current.forEach((photo) => deleteInspectionPhoto(photo.uri)); };
  }, []);

  function leave() {
    if (saveLock.current) return;
    if (photos.length || timeEdited || additionalSurcharges.length || odometer || fuelLevel || damageNoted || damageDescription) {
      Alert.alert("Bỏ biên bản đang nhập?", "Ảnh chụp và nội dung chưa gửi sẽ bị xóa.", [
        { text: "Tiếp tục nhập", style: "cancel" }, { text: "Bỏ biên bản", style: "destructive", onPress: onBack },
      ]);
    } else onBack();
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (cameraOpen) return false; leave(); return true; });
    return () => subscription.remove();
  });

  function addPhoto(photo: CapturedInspectionPhoto) {
    if (!alive.current || photoFiles.current.length >= MAX_INSPECTION_PHOTOS) { deleteInspectionPhoto(photo.uri); return; }
    photoFiles.current = [...photoFiles.current, photo]; setPhotos(photoFiles.current); setError("");
  }
  function removePhoto(photo: CapturedInspectionPhoto) {
    deleteInspectionPhoto(photo.uri);
    if (photo.uri.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(photo.uri);
      } catch {
        // URL xem trước có thể đã được thu hồi.
      }
    }
    photoFiles.current = photoFiles.current.filter((item) => item.id !== photo.id); setPhotos(photoFiles.current);
  }

  async function submit() {
    if (saveLock.current) return;
    if (validation) { setError(validation); return; }
    saveLock.current = true; setBusy(true); setError("");
    try {
      validateCheckoutKm(odometer, type === "CheckOut" ? reports.find(r => r.type === "CheckIn")?.odometerKm : undefined);
      const at = type === "CheckOut" ? returnTimeISO(actualReturnAt, checkoutStartDate(booking)) : undefined;
      if (type === "CheckOut") validateSurchargeSelection(booking, additionalSurcharges);
      const data = createInspectionForm({ actualReturnAt: at, odometer, fuelLevel, damageNoted, damageDescription, photos });
      if (type === "CheckIn") data.append("expectedVersion", String(previous?.version ?? 1));
      if (type === "CheckOut") appendSurcharges(data, additionalSurcharges);
      const report = await (type === "CheckIn" ? createCheckInReport : createCheckOutReport)(booking.id, data);
      if (alive.current) onSaved(report);
    } catch (err) {
      if (alive.current) setError(getApiErrorMessage(err, err instanceof Error ? `${err.message}. Ảnh vẫn được giữ để bạn thử lại.` : "Không thể gửi biên bản. Ảnh vẫn được giữ để bạn thử lại."));
    } finally {
      saveLock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <BookingHeader title={inspectionLabel(type)} onBack={leave} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>{booking.bookingCode} · {booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
      <Text style={{ color: theme.muted, lineHeight: 22 }}>Chụp toàn cảnh xe, biển số, đồng hồ km, nhiên liệu và các vị trí hư hại. Khách sẽ xem biên bản trước khi xác nhận.</Text>
      <BookingCard>
        {type === "CheckOut" ? <BookingField label="Giờ bàn giao (Việt Nam, YYYY-MM-DD HH:mm)" value={actualReturnAt} onChangeText={value => { setActualReturnAt(value); setTimeEdited(true); }} editable={!busy} /> : null}
        {type === "CheckOut" ? <BookingButton secondary title="Lấy giờ hiện tại" disabled={busy} onPress={() => { setActualReturnAt(vietnamInput()); setTimeEdited(true); }} /> : null}
        <BookingField label="Số km trên đồng hồ" value={odometer} onChangeText={setOdometer} numeric editable={!busy} placeholder="Ví dụ: 12500" />
        {type === "CheckOut" ? <MileageFeePreview booking={booking} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} finalKm={odometer} /> : null}
        {type === "CheckOut" ? <CheckoutSurchargePicker booking={booking} value={additionalSurcharges} onChange={setAdditionalSurcharges} disabled={busy} /> : null}
        <Text style={{ color: theme.text, fontWeight: "600" }}>Mức nhiên liệu / pin</Text>
        <View style={styles.fuels}>{["25%", "50%", "75%", "100%"].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: fuelLevel === value }} disabled={busy} onPress={() => setFuelLevel(fuelLevel === value ? "" : value)}
          style={[styles.fuel, { backgroundColor: fuelLevel === value ? theme.brandSoft : theme.surfaceAlt, borderColor: fuelLevel === value ? theme.brand : theme.border }]}><Text style={{ color: theme.text }}>{value}</Text></Pressable>)}</View>
        <View style={styles.switchRow}><Text style={{ color: theme.text, flex: 1, fontWeight: "600" }}>Có hư hại / trầy xước</Text><Switch accessibilityLabel="Có hư hại hoặc trầy xước" value={damageNoted} onValueChange={setDamageNoted} disabled={busy} trackColor={{ true: theme.brand }} /></View>
        {damageNoted ? <BookingField label="Mô tả hư hại (bắt buộc)" value={damageDescription} onChangeText={setDamageDescription} editable={!busy} multiline placeholder="Vị trí, mức độ hư hại…" /> : null}
      </BookingCard>
      <BookingCard>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>Ảnh xe ({photos.length}/{MAX_INSPECTION_PHOTOS})</Text>
        <Text style={{ color: theme.muted, lineHeight: 21 }}>Chụp ảnh trực tiếp bằng camera, tối đa 12 ảnh. Kiểm tra watermark ngày giờ trên từng ảnh trước khi gửi.</Text>
        <View style={styles.photos}>{photos.map((photo, index) => <View key={photo.id} style={styles.photo}>
          <InspectionPhoto key={photo.uri} uri={photo.uri} label={`Ảnh chụp xe ${index + 1} đã có watermark`} />
          <Text style={{ color: theme.muted, fontSize: 11 }}>{formatVietnamDateTime(photo.capturedAt)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ảnh ${index + 1}`} disabled={busy} onPress={() => removePhoto(photo)} style={styles.remove}><Text style={{ color: theme.danger, fontWeight: "600" }}>Xóa / chụp lại</Text></Pressable>
        </View>)}</View>
        <BookingButton secondary title="Chụp ảnh xe" disabled={busy || photos.length >= MAX_INSPECTION_PHOTOS} onPress={() => setCameraOpen(true)} />
      </BookingCard>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
      <BookingButton title="Gửi biên bản cho khách xác nhận" busy={busy} disabled={photos.length === 0} onPress={() => void submit()} />
      <Text style={{ color: theme.muted, fontSize: 13, textAlign: "center" }}>Kiểm tra kỹ ảnh và nội dung trước khi gửi. Biên bản trả xe chỉ có thể sửa trước khi khách xác nhận; ảnh gốc được giữ nguyên.</Text>
    </ScrollView>
    {cameraOpen ? <InspectionCameraModal bookingCode={booking.bookingCode} type={type} onCaptured={addPhoto} onClose={() => setCameraOpen(false)} /> : null}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 }, switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fuels: { flexDirection: "row", gap: 8 }, fuel: { flex: 1, padding: 12, alignItems: "center", borderRadius: 8, borderWidth: 1 },
  photos: { width: "100%", gap: 12 }, photo: { width: "100%", gap: 6 }, remove: { paddingVertical: 8 },
});
