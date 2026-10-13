import { useCallback, useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Clock, ImagePlus, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  driverLicenseStatusLabel,
  formatDriverLicenseFlags,
} from "@/features/driverLicenses/driverLicenseDisplay";
import MaskedDocumentValue from "@/features/pin/components/MaskedDocumentValue";
import {
  getMyDriverLicense,
  submitDriverLicenseVerification,
} from "@/features/driverLicenses/services/driverLicenseService";
import type {
  CustomerDriverLicense,
  DriverLicenseStatusResponse,
  DriverLicenseSubmitResponse,
  DriverLicenseVehicleType,
} from "@/features/driverLicenses/types";
import type { UploadFileInput } from "@/types/upload";
import { prepareDocumentImage } from "@/utils/documentImage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const vehicleTypeLabels: Record<DriverLicenseVehicleType, string> = {
  Car: "Ô tô",
  Motorbike: "Xe máy",
};

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

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

function formatCooldown(entry?: CustomerDriverLicense | null) {
  if (!entry || entry.isAllowedToUpdate !== false) return null;
  const seconds = entry.remainingCooldownSeconds ?? null;
  if (seconds != null && seconds > 0) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    const parts = [
      days > 0 ? `${days} ngày` : null,
      hours > 0 ? `${hours} giờ` : null,
      days === 0 && minutes > 0 ? `${minutes} phút` : null,
    ].filter(Boolean);
    return `Bạn có thể nộp lại sau ${parts.join(" ") || "ít phút nữa"}.`;
  }
  const nextAt = entry.nextAllowedSubmitAt ?? entry.canUpdateAfter;
  if (nextAt) return `Bạn có thể nộp lại sau ${formatDateTime(nextAt)}.`;
  return "GPLX cho loại xe này đang trong thời gian chờ cập nhật lại.";
}

export default function DriverLicenseScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [status, setStatus] = useState<DriverLicenseStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [vehicleType, setVehicleType] = useState<DriverLicenseVehicleType>("Car");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<UploadFileInput | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastResult, setLastResult] = useState<DriverLicenseSubmitResponse | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError("");
    try {
      setStatus(await getMyDriverLicense());
    } catch (failure) {
      setStatusError(failure instanceof Error ? failure.message : "Không tải được trạng thái GPLX.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Isolation theo tab: mỗi tab Car/Motorbike suy ra state riêng từ response
  // (backend GET me không có query vehicleType nên lọc ở client, không rò rỉ).
  const tabLicense = useMemo(
    () => status?.licenses.find((item) => item.vehicleType === vehicleType) ?? null,
    [status, vehicleType],
  );
  const tabRequest = useMemo(() => {
    const latest = status?.latestRequest ?? null;
    return latest && latest.requestedVehicleType === vehicleType ? latest : null;
  }, [status, vehicleType]);
  const tabVerified = tabLicense != null;

  const cooldownMessage = useMemo(() => formatCooldown(tabLicense), [tabLicense]);

  const showPendingNotice = tabRequest?.status === "Pending" || tabRequest?.status === "Processing";
  const latestDecision = !showPendingNotice
    ? tabRequest?.decisionReason || tabRequest?.rejectionReason || null
    : null;

  function handleTabChange(next: DriverLicenseVehicleType) {
    if (next === vehicleType) return;
    // Reset state hiển thị của tab cũ để 2 tab hoàn toàn độc lập.
    setVehicleType(next);
    setImageUri(null);
    setImageFile(null);
    setProcessing(false);
    setError("");
    setNotice("");
    setLastResult(null);
  }

  async function pickImage(source: "camera" | "library") {
    setError("");
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera"
        ? "Cần quyền camera để chụp ảnh GPLX."
        : "Cần quyền truy cập thư viện ảnh để chọn ảnh GPLX.");
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
      setError("Chỉ chấp nhận file JPG, PNG hoặc WebP.");
      return;
    }
    // Hiện ảnh gốc ngay để user thấy phản hồi, nén ở nền rồi đổi sang bản đã xử lý.
    setImageUri(asset.uri);
    setImageFile(null);
    setProcessing(true);
    try {
      const prepared = await prepareDocumentImage(
        { uri: asset.uri, width: asset.width, height: asset.height },
        "gplx",
      );
      setImageUri(prepared.uri);
      setImageFile(prepared.file);
      setLastResult(null);
    } catch {
      setError("Không xử lý được ảnh. Vui lòng thử ảnh khác.");
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    if (!imageFile) {
      setError("Vui lòng chọn ảnh GPLX trước khi gửi.");
      return;
    }
    if (cooldownMessage) {
      setError(cooldownMessage);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await submitDriverLicenseVerification(imageFile, vehicleType);
      setLastResult(result);
      if (result.status === "Verified") {
        setNotice("AI đã xác minh GPLX thành công.");
      } else if (result.status === "Pending" || result.status === "Processing") {
        setNotice("Hồ sơ của bạn đang chờ nhân viên kiểm tra.");
      } else {
        setError(result.message || "Xác thực GPLX chưa đạt. Vui lòng chụp lại ảnh rõ hơn.");
      }
      await loadStatus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Gửi ảnh GPLX thất bại. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const submitDisabled = busy || processing || !imageFile || Boolean(cooldownMessage);

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Giấy phép lái xe</Text>
        <Pressable
          accessibilityLabel="Tải lại trạng thái"
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
          <Text style={styles.cardTitle}>Trạng thái xác minh</Text>
          {loadingStatus ? (
            <Text style={styles.muted}>Đang tải trạng thái...</Text>
          ) : statusError ? (
            <Text style={styles.error}>{statusError}</Text>
          ) : status ? (
            <View style={styles.statusBox}>
              <StatusBadge status={tabVerified ? "Verified" : (tabRequest?.status ?? "None")} />
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Số GPLX ({vehicleTypeLabels[vehicleType]})</Text>
                <MaskedDocumentValue
                  canReveal={tabVerified}
                  documentType="GPLX"
                  maskedValue={tabLicense?.driverLicenseNumber ?? null}
                  revealDisabledHint="Giấy tờ chưa được xác thực để hiển thị."
                  vehicleType={vehicleType}
                />
              </View>
              <DetailLine label="Hạng GPLX" value={tabLicense?.licenseClass || "-"} />
              <DetailLine
                label="Loại xe đã xác minh"
                value={status.verifiedVehicleTypes.length > 0 ? status.verifiedVehicleTypes.join(", ") : "-"}
              />
              <DetailLine label="Xác minh lúc" value={formatDateTime(tabLicense?.verifiedAt)} />
            </View>
          ) : null}

          {showPendingNotice ? (
            <View style={styles.infoBox}>
              <Clock color={theme.brand} size={18} strokeWidth={2.3} />
              <Text style={styles.infoText}>Hồ sơ của bạn đang chờ nhân viên kiểm tra. Vui lòng quay lại sau.</Text>
            </View>
          ) : null}

          {latestDecision ? (
            <View style={styles.warnBox}>
              <AlertTriangle color={theme.danger} size={18} strokeWidth={2.3} />
              <Text style={styles.warnText}>{latestDecision}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nộp ảnh GPLX mới</Text>
          <Text style={styles.hint}>Chụp mặt trước GPLX rõ nét, dung lượng tối đa 5MB (JPG/PNG/WebP).</Text>

          <View style={styles.tabs}>
            {(Object.keys(vehicleTypeLabels) as DriverLicenseVehicleType[]).map((type) => (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => handleTabChange(type)}
                style={[styles.tab, vehicleType === type && styles.tabActive]}
              >
                <Text style={[styles.tabText, vehicleType === type && styles.tabTextActive]}>
                  {vehicleTypeLabels[type]}
                </Text>
              </Pressable>
            ))}
          </View>

          {cooldownMessage ? (
            <View style={styles.warnBox}>
              <Clock color={theme.danger} size={18} strokeWidth={2.3} />
              <Text style={styles.warnText}>{cooldownMessage}</Text>
            </View>
          ) : null}

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <ImagePlus color={theme.faint} size={30} strokeWidth={2} />
              <Text style={styles.muted}>Chưa có ảnh nào được chọn</Text>
            </View>
          )}

          {processing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={theme.brand} size="small" />
              <Text style={styles.muted}>Đang xử lý ảnh...</Text>
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
              <Text style={styles.pickText}>Chụp ảnh</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || processing}
              onPress={() => { void pickImage("library"); }}
              style={[styles.pickButton, (busy || processing) && styles.disabled]}
            >
              <ImagePlus color={theme.brand} size={18} strokeWidth={2.3} />
              <Text style={styles.pickText}>Thư viện</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? (
            <View style={styles.successBox}>
              <CheckCircle2 color={theme.success} size={18} strokeWidth={2.3} />
              <Text style={styles.successText}>{notice}</Text>
            </View>
          ) : null}

          {lastResult && lastResult.flags.length > 0 ? (
            <View style={styles.flagBox}>
              {formatDriverLicenseFlags(lastResult.flags).map((flag) => (
                <Text key={flag} style={styles.flagText}>• {flag}</Text>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitDisabled}
            onPress={() => { void handleSubmit(); }}
            style={[styles.submitButton, submitDisabled && styles.disabled]}
          >
            <Text style={styles.submitText}>{busy ? "Đang gửi..." : "Gửi xác minh"}</Text>
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
      <Text
        style={[
          styles.badgeText,
          verified ? styles.badgeTextVerified : pending ? styles.badgeTextPending : styles.badgeTextUnverified,
        ]}
      >
        {driverLicenseStatusLabel[status] ?? status}
      </Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  badge: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
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
  flagBox: { gap: 3, paddingHorizontal: 2 },
  flagText: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tabActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
  tabText: { color: theme.muted, fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: theme.brand },
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
