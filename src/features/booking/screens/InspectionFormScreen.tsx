import CheckoutSurchargePicker from "../components/CheckoutSurchargePicker";
import InspectionPhoto from "../components/InspectionPhoto";
import { appendSurcharges, validateSurchargeSelection } from "../checkoutSurcharges";
import type { CheckoutSurchargeSelection } from "../types";
import { checkoutStartDate } from "../bookingDisplay";
import MileageFeePreview from "../components/MileageFeePreview";
import { returnTimeISO, validateCheckoutKm, vietnamInput } from "../checkoutRules";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
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
  const { t } = useTranslation();
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
      showAppAlert(t("mobile:inspection.form.discardTitle"), t("mobile:inspection.form.discardMessage"), [
        { text: t("mobile:inspection.form.discardKeep"), style: "cancel" }, { text: t("mobile:inspection.form.discardConfirm"), style: "destructive", onPress: onBack },
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
      if (alive.current) setError(getApiErrorMessage(err, err instanceof Error ? t("mobile:inspection.form.submitErrorWithMessage", { message: err.message }) : t("mobile:inspection.form.submitError")));
    } finally {
      saveLock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <DetailHeader
      kicker={t(type === "CheckIn" ? "mobile:inspection.form.headerCheckIn" : "mobile:inspection.form.headerCheckOut")}
      title={inspectionLabel(type)}
      onBack={leave}
    />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <DetailCard>
        <View style={styles.heroHead}>
          <View style={styles.heroBody}>
            <Text style={styles.kicker}>{t(type === "CheckIn" ? "mobile:inspection.form.headerCheckIn" : "mobile:inspection.form.headerCheckOut")}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{booking.bookingCode} · {booking.vehicleName || t("mobile:inspection.form.vehicleFallback", { id: booking.vehicleId })}</Text>
          </View>
          <DetailPill label={t("mobile:inspection.form.photoCountPill", { selected: photos.length, total: MAX_INSPECTION_PHOTOS })} tone={photos.length > 0 ? "mint" : "neutral"} />
        </View>
        <Text style={styles.intro}>{t("mobile:inspection.form.intro")}</Text>
      </DetailCard>

      <DetailCard>
        <DetailSectionHeader
          title={t("mobile:inspection.form.sectionTitle")}
          subtitle={t(type === "CheckIn" ? "mobile:inspection.form.sectionSubtitleCheckIn" : "mobile:inspection.form.sectionSubtitleCheckOut")}
        />
        {type === "CheckOut" ? <BookingField label={t("mobile:inspection.form.handoverTimeLabel")} value={actualReturnAt} onChangeText={value => { setActualReturnAt(value); setTimeEdited(true); }} editable={!busy} /> : null}
        {type === "CheckOut" ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setActualReturnAt(vietnamInput()); setTimeEdited(true); }} style={styles.timeButton}>
          <Text style={styles.timeButtonText}>{t("booking:inspection.useCurrentTime")}</Text>
        </Pressable> : null}
        <BookingField label={t("mobile:inspection.form.odometerLabel")} value={odometer} onChangeText={setOdometer} numeric editable={!busy} placeholder={t("mobile:inspection.form.odometerPlaceholder")} />
        {type === "CheckOut" ? <MileageFeePreview booking={booking} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} finalKm={odometer} /> : null}
        {type === "CheckOut" ? <CheckoutSurchargePicker booking={booking} value={additionalSurcharges} onChange={setAdditionalSurcharges} disabled={busy} /> : null}
        <Text style={styles.fieldLabel}>{t("mobile:inspection.form.fuelLabel")}</Text>
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
          <Text style={styles.switchLabel}>{t("mobile:inspection.form.damageLabel")}</Text>
          <Switch accessibilityLabel={t("mobile:inspection.form.damageAria")} value={damageNoted} onValueChange={setDamageNoted} disabled={busy} trackColor={{ true: theme.brand }} />
        </View>
        {damageNoted ? <BookingField label={t("mobile:inspection.form.damageDescriptionLabel")} value={damageDescription} onChangeText={setDamageDescription} editable={!busy} multiline placeholder={t("mobile:inspection.form.damageDescriptionPlaceholder")} /> : null}
      </DetailCard>

      <DetailCard>
        <DetailSectionHeader title={t("mobile:inspection.form.photosSectionTitle", { selected: photos.length, total: MAX_INSPECTION_PHOTOS })} subtitle={t("mobile:inspection.form.photosSectionSubtitle")} />
        <Text style={styles.intro}>{t("mobile:inspection.form.photosIntro")}</Text>
        <View style={styles.photos}>
          {photos.map((photo, index) => <View key={photo.id} style={styles.photo}>
            <InspectionPhoto key={photo.uri} uri={photo.uri} label={t("mobile:inspection.form.photoAlt", { index: index + 1 })} />
            <Text style={styles.photoTime}>{formatVietnamDateTime(photo.capturedAt)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:inspection.form.removePhotoAria", { index: index + 1 })} disabled={busy} onPress={() => removePhoto(photo)} style={styles.remove}>
              <Text style={styles.removeText}>{t("mobile:inspection.form.removePhoto")}</Text>
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
          <Text style={styles.captureText}>{t("booking:inspection.camera.button")}</Text>
        </Pressable>
      </DetailCard>

      {error ? <DetailNotice title={t("mobile:inspection.form.errorTitle")} tone="danger">{error}</DetailNotice> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || photos.length === 0, busy }}
        disabled={busy || photos.length === 0}
        onPress={() => void submit()}
        style={[styles.submitButton, (busy || photos.length === 0) && styles.disabled]}
      >
        <Text style={styles.submitText}>{busy ? t("mobile:inspection.form.submitting") : t("mobile:inspection.form.submit")}</Text>
      </Pressable>
      <Text style={styles.footer}>{t("mobile:inspection.form.footer")}</Text>
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
    heroTitle: { color: theme.text, fontFamily: font.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
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
    captureText: { color: theme.brand, fontFamily: font.bold, fontSize: 12 },
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
