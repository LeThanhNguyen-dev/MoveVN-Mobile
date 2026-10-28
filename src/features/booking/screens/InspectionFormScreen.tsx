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
import type { Theme } from "@/theme/tokens";
import { getApiErrorMessage } from "@/services/apiClient";
import { createCheckInReport, createCheckOutReport } from "../bookingService";
import { createInspectionForm } from "../inspectionForm";
import { formatVietnamDateTime, inspectionLabel, MAX_INSPECTION_PHOTOS, validateInspectionFields, type InspectionType } from "../bookingDisplay";
import { deleteInspectionPhoto, type CapturedInspectionPhoto } from "../inspectionPhoto";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingField } from "../components/BookingControls";
import InspectionCameraModal from "../components/InspectionCameraModal";
import { DetailCard, DetailHeader, DetailNotice, DetailPill, DetailSectionHeader } from "../components/detail/BookingDetailUI";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";

export default function InspectionFormScreen({ booking, reports = [], type, onBack, onSaved }: {
  booking: BookingResponse; reports?: InspectionReportResponse[]; type: InspectionType; onBack: () => void; onSaved: (report: InspectionReportResponse) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
    <DetailHeader
      kicker={type === "CheckIn" ? "Biên bản nhận xe" : "Biên bản trả xe"}
      title={inspectionLabel(type)}
      onBack={leave}
    />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <DetailCard>
        <View style={styles.heroHead}>
          <View style={styles.heroBody}>
            <Text style={styles.kicker}>{type === "CheckIn" ? "Biên bản nhận xe" : "Biên bản trả xe"}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{booking.bookingCode} · {booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
          </View>
          <DetailPill label={`${photos.length}/${MAX_INSPECTION_PHOTOS} ảnh`} tone={photos.length > 0 ? "mint" : "neutral"} />
        </View>
        <Text style={styles.intro}>Chụp toàn cảnh xe, biển số, đồng hồ km, nhiên liệu và các vị trí hư hại. Khách sẽ xem biên bản trước khi xác nhận.</Text>
      </DetailCard>

      <DetailCard>
        <DetailSectionHeader
          title="Thông tin bàn giao"
          subtitle={type === "CheckIn" ? "Ghi nhận tình trạng xe lúc giao cho khách" : "Ghi nhận tình trạng xe lúc khách trả"}
        />
        {type === "CheckOut" ? <BookingField label="Giờ bàn giao (Việt Nam, YYYY-MM-DD HH:mm)" value={actualReturnAt} onChangeText={value => { setActualReturnAt(value); setTimeEdited(true); }} editable={!busy} /> : null}
        {type === "CheckOut" ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setActualReturnAt(vietnamInput()); setTimeEdited(true); }} style={styles.timeButton}>
          <Text style={styles.timeButtonText}>Lấy giờ hiện tại</Text>
        </Pressable> : null}
        <BookingField label="Số km trên đồng hồ" value={odometer} onChangeText={setOdometer} numeric editable={!busy} placeholder="Ví dụ: 12500" />
        {type === "CheckOut" ? <MileageFeePreview booking={booking} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} finalKm={odometer} /> : null}
        {type === "CheckOut" ? <CheckoutSurchargePicker booking={booking} value={additionalSurcharges} onChange={setAdditionalSurcharges} disabled={busy} /> : null}
        <Text style={styles.fieldLabel}>Mức nhiên liệu / pin</Text>
        <View style={styles.fuels}>
          {["25%", "50%", "75%", "100%"].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: fuelLevel === value }}
              disabled={busy}
              onPress={() => setFuelLevel(fuelLevel === value ? "" : value)}
              style={[styles.fuel, {
                backgroundColor: fuelLevel === value ? theme.brandSoft : theme.surfaceAlt,
                borderColor: fuelLevel === value ? theme.brand : theme.border,
              }]}
            >
              <Text style={[styles.fuelText, { color: fuelLevel === value ? theme.brand : theme.muted }]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Có hư hại / trầy xước</Text>
          <Switch accessibilityLabel="Có hư hại hoặc trầy xước" value={damageNoted} onValueChange={setDamageNoted} disabled={busy} trackColor={{ true: theme.brand }} />
        </View>
        {damageNoted ? <BookingField label="Mô tả hư hại (bắt buộc)" value={damageDescription} onChangeText={setDamageDescription} editable={!busy} multiline placeholder="Vị trí, mức độ hư hại…" /> : null}
      </DetailCard>

      <DetailCard>
        <DetailSectionHeader title={`Ảnh xe (${photos.length}/${MAX_INSPECTION_PHOTOS})`} subtitle="Bắt buộc ít nhất 1 ảnh có watermark" />
        <Text style={styles.intro}>Chụp ảnh trực tiếp bằng camera, tối đa 12 ảnh. Kiểm tra watermark ngày giờ trên từng ảnh trước khi gửi.</Text>
        <View style={styles.photos}>
          {photos.map((photo, index) => <View key={photo.id} style={styles.photo}>
            <InspectionPhoto key={photo.uri} uri={photo.uri} label={`Ảnh chụp xe ${index + 1} đã có watermark`} />
            <Text style={styles.photoTime}>{formatVietnamDateTime(photo.capturedAt)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ảnh ${index + 1}`} disabled={busy} onPress={() => removePhoto(photo)} style={styles.remove}>
              <Text style={styles.removeText}>Xóa / chụp lại</Text>
            </Pressable>
          </View>)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || photos.length >= MAX_INSPECTION_PHOTOS }}
          disabled={busy || photos.length >= MAX_INSPECTION_PHOTOS}
          onPress={() => setCameraOpen(true)}
          style={[styles.captureButton, (busy || photos.length >= MAX_INSPECTION_PHOTOS) && styles.disabled]}
        >
          <Text style={styles.captureText}>Chụp ảnh xe</Text>
        </Pressable>
      </DetailCard>

      {error ? <DetailNotice title="Chưa gửi được biên bản" tone="danger">{error}</DetailNotice> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || photos.length === 0, busy }}
        disabled={busy || photos.length === 0}
        onPress={() => void submit()}
        style={[styles.submitButton, (busy || photos.length === 0) && styles.disabled]}
      >
        <Text style={styles.submitText}>{busy ? "Đang gửi biên bản..." : "Gửi biên bản cho khách xác nhận"}</Text>
      </Pressable>
      <Text style={styles.footer}>Kiểm tra kỹ ảnh và nội dung trước khi gửi. Biên bản trả xe chỉ có thể sửa trước khi khách xác nhận; ảnh gốc được giữ nguyên.</Text>
    </ScrollView>
    {cameraOpen ? <InspectionCameraModal bookingCode={booking.bookingCode} type={type} onCaptured={addPhoto} onClose={() => setCameraOpen(false)} /> : null}
  </KeyboardAvoidingView>;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 36, gap: 12 },
    heroHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    heroBody: { flex: 1, minWidth: 0, gap: 3 },
    kicker: {
      color: theme.faint,
      fontFamily: font.bold,
      fontSize: 8.5,
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    heroTitle: { color: theme.text, fontFamily: font.display, fontSize: 17.5, lineHeight: 22, letterSpacing: -0.3 },
    intro: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 },
    timeButton: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    timeButtonText: { color: theme.brand, fontFamily: font.bold, fontSize: 11.5 },
    fieldLabel: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5 },
    fuels: { flexDirection: "row", gap: 8 },
    fuel: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: 14, borderWidth: 1 },
    fuelText: { fontFamily: font.bold, fontSize: 11.5 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    switchLabel: { color: theme.text, flex: 1, fontFamily: font.semibold, fontSize: 11.5 },
    photos: { width: "100%", gap: 12 },
    photo: { width: "100%", gap: 6 },
    photoTime: { color: theme.muted, fontFamily: font.regular, fontSize: 10 },
    remove: { paddingVertical: 6 },
    removeText: { color: theme.danger, fontFamily: font.semibold, fontSize: 11 },
    captureButton: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    captureText: { color: theme.brand, fontFamily: font.bold, fontSize: 12.5 },
    submitButton: {
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    submitText: { color: theme.onBrand, fontFamily: font.bold, fontSize: 13, textAlign: "center" },
    disabled: { opacity: 0.5 },
    footer: { color: theme.faint, fontFamily: font.regular, fontSize: 10, lineHeight: 15, textAlign: "center" },
  });
