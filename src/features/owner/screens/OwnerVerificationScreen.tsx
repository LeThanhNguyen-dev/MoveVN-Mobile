import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Clock, ImagePlus, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { driverLicenseStatusLabel } from "@/features/driverLicenses/driverLicenseDisplay";
import {
  createApplication,
  getMyApplication,
  uploadNationalId,
} from "@/features/owner/services/ownerService";
import type { OwnerApplicationDto } from "@/features/owner/types";
import MaskedDocumentValue from "@/features/pin/components/MaskedDocumentValue";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";
import { prepareDocumentImage } from "@/utils/documentImage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function getExtension(fileName?: string | null, mimeType?: string | null) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType?.startsWith("image/")) {
    const subtype = mimeType.split("/")[1]?.toLowerCase();
    if (subtype === "jpeg") return "jpg";
    return subtype;
  }
  return undefined;
}

export default function OwnerVerificationScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [application, setApplication] = useState<OwnerApplicationDto | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<UploadFileInput | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError("");
    try {
      let app: OwnerApplicationDto | null = null;
      try {
        app = await getMyApplication();
      } catch {
        app = null;
      }
      if (!app || !(app.id > 0)) {
        await createApplication();
        app = await getMyApplication();
      }
      setApplication(app);
    } catch (failure) {
      setStatusError(failure instanceof Error ? failure.message : t("mobile:ownerHome.verification.loadStatusError"));
    } finally {
      setLoadingStatus(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const verified = application?.nationalIdVerified ?? false;
  const requestStatus = application?.nationalIdRequestStatus ?? "None";
  const showPendingNotice = requestStatus === "Pending" || requestStatus === "Processing";

  async function pickImage(source: "camera" | "library") {
    setError("");
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera"
        ? t("mobile:ownerHome.verification.cameraPermission")
        : t("mobile:ownerHome.verification.libraryPermission"));
      return;
    }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    const extension = getExtension(asset.fileName, asset.mimeType);
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      setError(t("mobile:driverLicense.invalidFileType"));
      return;
    }
    // Hiện ảnh gốc ngay để user thấy phản hồi, nén ở nền rồi đổi sang bản đã xử lý.
    setImageUri(asset.uri);
    setImageFile(null);
    setProcessing(true);
    try {
      const prepared = await prepareDocumentImage(
        { uri: asset.uri, width: asset.width, height: asset.height },
        "cccd",
      );
      setImageUri(prepared.uri);
      setImageFile(prepared.file);
    } catch {
      setError(t("mobile:driverLicense.processImageError"));
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    if (!imageFile) {
      setError(t("mobile:ownerHome.verification.photoRequired"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      appendUploadFile(formData, "frontImage", imageFile);
      const result = await uploadNationalId(formData);
      if (result.status === "Verified") {
        setNotice(t("mobile:ownerHome.verification.aiVerified"));
      } else if (result.status === "Pending" || result.status === "Processing") {
        setNotice(t("mobile:ownerHome.verification.pendingNoticeShort"));
      } else {
        setError(result.message || t("mobile:ownerHome.verification.verifyFailed"));
      }
      await loadStatus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("mobile:ownerHome.verification.submitError"));
    } finally {
      setBusy(false);
    }
  }

  const submitDisabled = busy || processing || !imageFile;

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel={t("accountVerification:bank.back")} accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <AppText display style={styles.topBarTitle}>{t("mobile:ownerHome.verification.title")}</AppText>
        <Pressable
          accessibilityLabel={t("mobile:driverLicense.reloadAria")}
          accessibilityRole="button"
          disabled={loadingStatus}
          onPress={() => { void loadStatus(); }}
          style={styles.backButton}
        >
          <RefreshCw color={theme.brand} size={19} strokeWidth={2.3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>{t("mobile:driverLicense.statusTitle")}</AppText>
          {loadingStatus ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.brand} size="large" />
              <AppText style={styles.muted}>{t("mobile:driverLicense.loadingStatus")}</AppText>
            </View>
          ) : statusError || !application ? (
            <View style={styles.stack}>
              {statusError ? <AppText style={styles.error}>{statusError}</AppText> : null}
              <Pressable accessibilityRole="button" onPress={() => { void loadStatus(); }} style={styles.outlineButton}>
                <RefreshCw color={theme.brand} size={18} strokeWidth={2.3} />
                <AppText style={styles.pickText}>{t("common:retry")}</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.statusBox}>
              <StatusBadge status={verified ? "Verified" : requestStatus} />
              <View style={styles.detailLine}>
                <AppText style={styles.detailLabel}>{t("accountVerification:cccd.idNumber")}</AppText>
                <MaskedDocumentValue
                  canReveal={verified}
                  documentType="CCCD"
                  maskedValue={application.nationalIdNumber ?? null}
                  revealDisabledHint={t("mobile:driverLicense.revealDisabledHint")}
                />
              </View>
              <DetailLine label={t("mobile:ownerHome.verification.fullName")} value={application.fullName || "-"} />
            </View>
          )}

          {showPendingNotice ? (
            <View style={styles.infoBox}>
              <Clock color={theme.brand} size={18} strokeWidth={2.3} />
              <AppText style={styles.infoText}>{t("mobile:ownerHome.verification.pendingNotice")}</AppText>
            </View>
          ) : null}

          {!verified && !showPendingNotice && application
          && (requestStatus === "Rejected" || requestStatus === "Failed" || requestStatus === "NeedMoreInfo") ? (
            <View style={styles.warnBox}>
              <AlertTriangle color={theme.danger} size={18} strokeWidth={2.3} />
              <AppText style={styles.warnText}>
                {t("mobile:ownerHome.verification.retryHint", { status: driverLicenseStatusLabel[requestStatus] ?? requestStatus })}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>{t("mobile:ownerHome.verification.uploadTitle")}</AppText>
          <AppText style={styles.hint}>{t("mobile:ownerHome.verification.uploadHint")}</AppText>

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <ImagePlus color={theme.faint} size={30} strokeWidth={2} />
              <AppText style={styles.muted}>{t("mobile:driverLicense.noImageSelected")}</AppText>
            </View>
          )}

          {processing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={theme.brand} size="small" />
              <AppText style={styles.muted}>{t("mobile:driverLicense.processingImage")}</AppText>
            </View>
          ) : null}

          <View style={styles.pickRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy || processing}
              onPress={() => { void pickImage("camera"); }}
              style={[styles.pickButton, (busy || processing) && styles.disabled]}
            >
              <Camera color={theme.brand} size={18} strokeWidth={2.3} />
              <AppText style={styles.pickText}>{t("mobile:driverLicense.capture")}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || processing}
              onPress={() => { void pickImage("library"); }}
              style={[styles.pickButton, (busy || processing) && styles.disabled]}
            >
              <ImagePlus color={theme.brand} size={18} strokeWidth={2.3} />
              <AppText style={styles.pickText}>{t("mobile:driverLicense.library")}</AppText>
            </Pressable>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {notice ? (
            <View style={styles.successBox}>
              <CheckCircle2 color={theme.success} size={18} strokeWidth={2.3} />
              <AppText style={styles.successText}>{notice}</AppText>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitDisabled}
            onPress={() => { void handleSubmit(); }}
            style={[styles.submitButton, submitDisabled && styles.disabled]}
          >
            <AppText style={styles.submitText}>{busy ? t("mobile:driverLicense.submitting") : t("accountVerification:driverLicense.submit")}</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const verified = status === "Verified";
  const pending = status === "Pending" || status === "Processing";
  return (
    <View
      style={[
        styles.badge,
        verified ? styles.badgeVerified : pending ? styles.badgePending : styles.badgeUnverified,
      ]}
    >
      <AppText
        style={[
          styles.badgeText,
          verified ? styles.badgeTextVerified : pending ? styles.badgeTextPending : styles.badgeTextUnverified,
        ]}
      >
        {driverLicenseStatusLabel[status] ?? status}
      </AppText>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.detailLine}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 48,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  hint: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  muted: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  center: { alignItems: "center", gap: 12, paddingVertical: 24 },
  stack: { gap: 12 },
  error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  statusBox: { gap: 2 },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  detailLabel: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  detailValue: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  badgeVerified: { backgroundColor: theme.successSoft },
  badgePending: { backgroundColor: theme.brandSoft },
  badgeUnverified: { backgroundColor: theme.surfaceAlt },
  badgeText: { fontSize: 12, fontWeight: "800" },
  badgeTextVerified: { color: theme.success },
  badgeTextPending: { color: theme.brand },
  badgeTextUnverified: { color: theme.faint },
  infoBox: {
    flexDirection: "row",
    gap: 9,
    borderRadius: 12,
    backgroundColor: theme.brandSoft,
    padding: 12,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  warnBox: {
    flexDirection: "row",
    gap: 9,
    borderRadius: 12,
    backgroundColor: theme.dangerSoft,
    padding: 12,
    alignItems: "flex-start",
  },
  warnText: { flex: 1, color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  successBox: {
    flexDirection: "row",
    gap: 9,
    borderRadius: 12,
    backgroundColor: theme.successSoft,
    padding: 12,
    alignItems: "flex-start",
  },
  successText: { flex: 1, color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  preview: { width: "100%", height: 200, borderRadius: 12, backgroundColor: theme.surfaceAlt },
  previewPlaceholder: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickRow: { flexDirection: "row", gap: 8 },
  pickButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.brandBorder,
    backgroundColor: "transparent",
  },
  pickText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.brandBorder,
    backgroundColor: "transparent",
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: theme.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
