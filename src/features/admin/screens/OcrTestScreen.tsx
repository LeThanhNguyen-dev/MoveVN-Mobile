import { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Camera, CheckCircle2, CircleAlert, ImagePlus } from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { previewAdminVehicleOcr } from "@/features/admin/services/adminPostManagementService";
import { previewOwnerOcr } from "@/features/admin/services/adminUserService";
import type {
  AdminVehicleOcrPreviewResponse,
  OwnerOcrPreview,
} from "@/features/admin/types";
import type { AuthUser } from "@/features/auth/types";
import { driverLicenseStatusLabel, formatDriverLicenseFlags } from "@/features/driverLicenses/driverLicenseDisplay";
import { appendUploadFile, type UploadFileInput } from "@/types/upload";
import { prepareDocumentImage } from "@/utils/documentImage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type OcrTab = "cccd" | "gplx" | "cavet";

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

function formatConfidence(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

type OcrTestScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export default function OcrTestScreen({ user, onBack }: OcrTestScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isAdmin = user.roles.includes("Admin");
  const [tab, setTab] = useState<OcrTab>("cccd");

  const [cccdName, setCccdName] = useState("");
  const [cccdImageUri, setCccdImageUri] = useState<string | null>(null);
  const [cccdFile, setCccdFile] = useState<UploadFileInput | null>(null);
  const [cccdResult, setCccdResult] = useState<OwnerOcrPreview["nationalId"] | null>(null);

  const [gplxName, setGplxName] = useState("");
  const [gplxImageUri, setGplxImageUri] = useState<string | null>(null);
  const [gplxFile, setGplxFile] = useState<UploadFileInput | null>(null);
  const [gplxResult, setGplxResult] = useState<OwnerOcrPreview["driverLicense"] | null>(null);

  const [cavetImageUri, setCavetImageUri] = useState<string | null>(null);
  const [cavetFile, setCavetFile] = useState<UploadFileInput | null>(null);
  const [vehicleType, setVehicleType] = useState<"Car" | "Motorbike">("Car");
  const [expectedPlate, setExpectedPlate] = useState("");
  const [expectedBrand, setExpectedBrand] = useState("");
  const [expectedModel, setExpectedModel] = useState("");
  const [cavetResult, setCavetResult] = useState<AdminVehicleOcrPreviewResponse | null>(null);

  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pickImage(
    source: "camera" | "library",
    onPicked: (uri: string, file: UploadFileInput | null) => void,
  ) {
    setError("");
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera" ? "Cần quyền camera để chụp ảnh." : "Cần quyền truy cập thư viện ảnh.");
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
    onPicked(asset.uri, null);
    setProcessing(true);
    try {
      const prepared = await prepareDocumentImage(
        { uri: asset.uri, width: asset.width, height: asset.height },
        "ocr-test",
      );
      onPicked(prepared.uri, prepared.file);
    } catch {
      setError("Không xử lý được ảnh. Vui lòng thử ảnh khác.");
      onPicked(asset.uri, null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmitCccd() {
    if (!cccdFile) {
      setError("Vui lòng chọn ảnh CCCD trước khi kiểm tra.");
      return;
    }
    setBusy(true);
    setError("");
    setCccdResult(null);
    try {
      const result = await previewOwnerOcr(cccdName.trim(), cccdFile, null);
      setCccdResult(result.nationalId ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kiểm tra OCR thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitGplx() {
    if (!gplxFile) {
      setError("Vui lòng chọn ảnh GPLX trước khi kiểm tra.");
      return;
    }
    setBusy(true);
    setError("");
    setGplxResult(null);
    try {
      const result = await previewOwnerOcr(gplxName.trim(), null, gplxFile);
      setGplxResult(result.driverLicense ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kiểm tra OCR thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitCavet() {
    if (!cavetFile) {
      setError("Vui lòng chọn ảnh cavet trước khi kiểm tra.");
      return;
    }
    setBusy(true);
    setError("");
    setCavetResult(null);
    try {
      const formData = new FormData();
      appendUploadFile(formData, "cavetImage", cavetFile);
      formData.append("vehicleType", vehicleType);
      if (expectedPlate.trim()) formData.append("expectedLicensePlate", expectedPlate.trim());
      if (expectedBrand.trim()) formData.append("expectedBrand", expectedBrand.trim());
      if (expectedModel.trim()) formData.append("expectedModel", expectedModel.trim());
      setCavetResult(await previewAdminVehicleOcr(formData));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kiểm tra OCR thất bại.");
    } finally {
      setBusy(false);
    }
  }

  function handleTabChange(next: OcrTab) {
    setTab(next);
    setError("");
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Kiểm tra OCR</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          Chạy thử OCR mà không lưu gì vào hồ sơ. Staff chỉ kiểm tra được CCCD/GPLX.
        </Text>

        <View style={styles.tabs}>
          {(["cccd", "gplx"] as OcrTab[]).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => handleTabChange(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {key === "cccd" ? "CCCD" : "GPLX"}
              </Text>
            </Pressable>
          ))}
          {isAdmin ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => handleTabChange("cavet")}
              style={[styles.tab, tab === "cavet" && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === "cavet" && styles.tabTextActive]}>Cavet</Text>
            </Pressable>
          ) : null}
        </View>

        {tab === "cccd" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ảnh mặt trước CCCD</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Họ tên (tùy chọn)</Text>
              <TextInput
                editable={!busy && !processing}
                placeholder="Nguyễn Văn A"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={cccdName}
                onChangeText={setCccdName}
              />
            </View>
            <ImagePreview
              busy={busy || processing}
              imageUri={cccdImageUri}
              onPick={(source) =>
                void pickImage(source, (uri, file) => {
                  setCccdImageUri(uri);
                  setCccdFile(file);
                  setCccdResult(null);
                })
              }
              processing={processing}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SubmitButton
              busy={busy}
              disabled={!cccdFile}
              label="Chạy kiểm tra CCCD"
              onPress={() => { void handleSubmitCccd(); }}
            />
            {cccdResult ? (
              <View style={styles.resultBox}>
                <ResultBadge success={cccdResult.success} />
                <ResultLine label="Số CCCD" value={cccdResult.nationalId || "-"} />
                <ResultLine label="Họ tên" value={cccdResult.fullName || "-"} />
                <ResultLine label="Ngày sinh" value={cccdResult.dateOfBirth || "-"} />
                <ResultLine label="Địa chỉ" value={cccdResult.address || "-"} />
                <ResultLine label="Độ tin cậy" value={formatConfidence(cccdResult.confidence)} />
                <ResultLine label="Kết luận AI" value={cccdResult.recommendation || "-"} />
                <FlagsList flags={cccdResult.flags} />
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === "gplx" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ảnh mặt trước GPLX</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Họ tên (để kiểm tra khớp tên)</Text>
              <TextInput
                editable={!busy && !processing}
                placeholder="Nguyễn Văn A"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={gplxName}
                onChangeText={setGplxName}
              />
            </View>
            <ImagePreview
              busy={busy || processing}
              imageUri={gplxImageUri}
              onPick={(source) =>
                void pickImage(source, (uri, file) => {
                  setGplxImageUri(uri);
                  setGplxFile(file);
                  setGplxResult(null);
                })
              }
              processing={processing}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SubmitButton
              busy={busy}
              disabled={!gplxFile}
              label="Chạy kiểm tra GPLX"
              onPress={() => { void handleSubmitGplx(); }}
            />
            {gplxResult ? (
              <View style={styles.resultBox}>
                <ResultBadge success={gplxResult.success} />
                <ResultLine label="Số GPLX" value={gplxResult.driverLicenseNumber || "-"} />
                <ResultLine label="Hạng" value={gplxResult.licenseClass || "-"} />
                <ResultLine label="Họ tên" value={gplxResult.fullName || "-"} />
                <ResultLine label="Độ tin cậy" value={formatConfidence(gplxResult.confidence)} />
                <ResultLine label="Kết luận AI" value={gplxResult.recommendation || "-"} />
                <FlagsList flags={gplxResult.flags} />
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === "cavet" && isAdmin ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ảnh cavet xe</Text>
            <View style={styles.tabs}>
              {(["Car", "Motorbike"] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  onPress={() => setVehicleType(type)}
                  style={[styles.tab, vehicleType === type && styles.tabActive]}
                >
                  <Text style={[styles.tabText, vehicleType === type && styles.tabTextActive]}>
                    {type === "Car" ? "Ô tô" : "Xe máy"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ImagePreview
              busy={busy || processing}
              imageUri={cavetImageUri}
              onPick={(source) =>
                void pickImage(source, (uri, file) => {
                  setCavetImageUri(uri);
                  setCavetFile(file);
                  setCavetResult(null);
                })
              }
              processing={processing}
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Biển số kỳ vọng (tùy chọn)</Text>
              <TextInput
                autoCapitalize="characters"
                editable={!busy && !processing}
                placeholder="59A-12345"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={expectedPlate}
                onChangeText={setExpectedPlate}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Hãng kỳ vọng (tùy chọn)</Text>
              <TextInput
                editable={!busy && !processing}
                placeholder="Honda"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={expectedBrand}
                onChangeText={setExpectedBrand}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Model kỳ vọng (tùy chọn)</Text>
              <TextInput
                editable={!busy && !processing}
                placeholder="Air Blade"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={expectedModel}
                onChangeText={setExpectedModel}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <SubmitButton
              busy={busy}
              disabled={!cavetFile}
              label="Chạy kiểm tra cavet"
              onPress={() => { void handleSubmitCavet(); }}
            />
            {cavetResult ? (
              <View style={styles.resultBox}>
                <ResultBadge success={cavetResult.success} />
                <ResultLine label="Biển số" value={cavetResult.licensePlate || "-"} />
                <ResultLine label="Hãng" value={cavetResult.brand || "-"} />
                <ResultLine label="Model" value={cavetResult.model || "-"} />
                <ResultLine label="Số máy" value={cavetResult.engineNumber || "-"} />
                <ResultLine label="Số khung" value={cavetResult.chassisNumber || "-"} />
                <ResultLine label="Độ tin cậy" value={formatConfidence(cavetResult.confidence)} />
                <ResultLine label="Kết luận AI" value={cavetResult.recommendation || "-"} />
                {cavetResult.message ? <ResultLine label="Ghi chú" value={cavetResult.message} /> : null}
                <FlagsList flags={cavetResult.flags} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ImagePreview({
  busy,
  imageUri,
  onPick,
  processing,
}: {
  busy: boolean;
  imageUri: string | null;
  onPick: (source: "camera" | "library") => void;
  processing: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <View style={styles.previewPlaceholder}>
          <ImagePlus color={theme.faint} size={30} strokeWidth={2} />
          <Text style={styles.muted}>Chưa có ảnh nào được chọn</Text>
        </View>
      )}
      {processing ? <Text style={styles.muted}>Đang xử lý ảnh...</Text> : null}
      <View style={styles.pickRow}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onPick("camera")}
          style={[styles.pickButton, busy && styles.disabled]}
        >
          <Camera color={theme.brand} size={18} strokeWidth={2.3} />
          <Text style={styles.pickText}>Chụp ảnh</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onPick("library")}
          style={[styles.pickButton, busy && styles.disabled]}
        >
          <ImagePlus color={theme.brand} size={18} strokeWidth={2.3} />
          <Text style={styles.pickText}>Thư viện</Text>
        </Pressable>
      </View>
    </>
  );
}

function SubmitButton({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const blocked = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={blocked}
      onPress={onPress}
      style={[styles.submitButton, blocked && styles.disabled]}
    >
      <Text style={styles.submitText}>{busy ? "Đang kiểm tra..." : label}</Text>
    </Pressable>
  );
}

function ResultBadge({ success }: { success: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.badge, success ? styles.badgeOk : styles.badgeFail]}>
      {success ? (
        <CheckCircle2 color={theme.success} size={15} strokeWidth={2.5} />
      ) : (
        <CircleAlert color={theme.danger} size={15} strokeWidth={2.5} />
      )}
      <Text style={[styles.badgeText, success ? styles.badgeTextOk : styles.badgeTextFail]}>
        {success ? "Đọc thành công" : "Đọc thất bại"}
      </Text>
    </View>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function FlagsList({ flags }: { flags?: string[] | null }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const items = formatDriverLicenseFlags(flags);
  if (items.length === 0) return null;
  return (
    <View style={styles.flagBox}>
      <Text style={styles.detailLabel}>Cờ AI ({items.length})</Text>
      {items.map((flag) => (
        <Text key={flag} style={styles.flagText}>
          • {driverLicenseStatusLabel[flag] ?? flag}
        </Text>
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
    hint: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "500" },
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
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 12,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    field: { gap: 6 },
    fieldLabel: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    fieldInput: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "600",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      backgroundColor: theme.input,
    },
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
    muted: { color: theme.muted, fontSize: 13, fontWeight: "600", textAlign: "center" },
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
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    submitButton: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    submitText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
    disabled: { opacity: 0.55 },
    resultBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 4,
    },
    badgeOk: { backgroundColor: theme.successSoft },
    badgeFail: { backgroundColor: theme.dangerSoft },
    badgeText: { fontSize: 12, fontWeight: "800" },
    badgeTextOk: { color: theme.success },
    badgeTextFail: { color: theme.danger },
    detailLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 5,
    },
    detailLabel: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    detailValue: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 },
    flagBox: { gap: 3, paddingTop: 4 },
    flagText: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  });
