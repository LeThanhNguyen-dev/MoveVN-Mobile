import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  ImagePlus,
  RefreshCw,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useOwnerApplication } from "@/features/owner/hooks/useOwnerApplication";
import type { OwnerWizardStep } from "@/features/owner/types";
import MaskedDocumentValue from "@/features/pin/components/MaskedDocumentValue";
import type { UploadFileInput } from "@/types/upload";
import { prepareDocumentImage } from "@/utils/documentImage";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const stepperLabels = ["CCCD", "Ngân hàng", "Gửi duyệt"];

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

function stepIndex(step: OwnerWizardStep) {
  if (step === "upload" || step === "pending" || step === "success") return 0;
  if (step === "bank-info") return 1;
  if (step === "review-submit" || step === "manual-review") return 2;
  if (step === "owner-success") return 3;
  return -1;
}

export default function OwnerVerificationScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    application,
    wizardStep,
    setWizardStep,
    isLoading,
    error,
    setError,
    refetch,
    handleOcrVerification,
    handleBankUpdate,
    handleSubmit,
  } = useOwnerApplication();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<UploadFileInput | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolderName, setBankAccountHolderName] = useState("");
  const [bankPrefilled, setBankPrefilled] = useState(false);

  useEffect(() => {
    if (wizardStep === "bank-info" && !bankPrefilled && application) {
      setBankName(application.bankName ?? "");
      setBankAccountNumber(application.bankAccountNumber ?? "");
      setBankAccountHolderName(application.bankAccountHolderName ?? "");
      setBankPrefilled(true);
    }
  }, [wizardStep, bankPrefilled, application]);

  async function pickImage(source: "camera" | "library") {
    setError(null);
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera"
        ? "Cần quyền camera để chụp ảnh CCCD."
        : "Cần quyền truy cập thư viện ảnh để chọn ảnh CCCD.");
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
        "cccd",
      );
      setImageUri(prepared.uri);
      setImageFile(prepared.file);
    } catch {
      setError("Không xử lý được ảnh. Vui lòng thử ảnh khác.");
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpload() {
    if (!imageFile) {
      setError("Vui lòng chọn ảnh mặt trước CCCD.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await handleOcrVerification(imageFile);
      setImageUri(null);
      setImageFile(null);
    } catch {
      // handleOcrVerification đã set error trong hook.
    } finally {
      setBusy(false);
    }
  }

  async function handleBankSubmit() {
    const name = bankName.trim();
    const number = bankAccountNumber.trim();
    const holder = bankAccountHolderName.trim();
    if (!name || !number || !holder) {
      setError("Vui lòng nhập đầy đủ tên ngân hàng, số tài khoản và chủ tài khoản.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await handleBankUpdate(name, number, holder);
    } catch {
      // handleBankUpdate đã set error trong hook.
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalSubmit() {
    setBusy(true);
    setError(null);
    try {
      await handleSubmit();
    } catch {
      // handleSubmit đã set error trong hook.
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setError(null);
    await refetch();
  }

  const currentStep = stepIndex(wizardStep);

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Hồ sơ chủ xe</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {currentStep >= 0 ? <Stepper current={currentStep} /> : null}

        {isLoading && wizardStep === "check-status" ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.brand} size="large" />
            <Text style={styles.muted}>Đang tải hồ sơ...</Text>
          </View>
        ) : null}

        {wizardStep === "already-owner" ? (
          <View style={styles.card}>
            <View style={styles.successBox}>
              <BadgeCheck color={theme.success} size={20} strokeWidth={2.3} />
              <Text style={styles.successText}>Bạn đã là chủ xe trên MoveVN.</Text>
            </View>
          </View>
        ) : null}

        {wizardStep === "upload" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bước 1 — Chụp mặt trước CCCD</Text>
            <Text style={styles.hint}>Ảnh rõ nét, đủ sáng, dung lượng tối đa 5MB (JPG/PNG/WebP).</Text>
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
            <Pressable
              accessibilityRole="button"
              disabled={busy || processing || !imageFile}
              onPress={() => { void handleUpload(); }}
              style={[styles.submitButton, (busy || processing || !imageFile) && styles.disabled]}
            >
              <Text style={styles.submitText}>{busy ? "Đang xác minh..." : "Gửi xác minh CCCD"}</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "pending" ? (
          <View style={styles.card}>
            <View style={styles.infoBox}>
              <Clock color={theme.brand} size={20} strokeWidth={2.3} />
              <Text style={styles.infoText}>
                Ảnh CCCD của bạn đang chờ nhân viên kiểm tra. Vui lòng quay lại sau.
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { void handleRefresh(); }} style={styles.outlineButton}>
              <RefreshCw color={theme.brand} size={18} strokeWidth={2.3} />
              <Text style={styles.pickText}>Kiểm tra lại</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "success" ? (
          <View style={styles.card}>
            <View style={styles.successBox}>
              <CheckCircle2 color={theme.success} size={20} strokeWidth={2.3} />
              <Text style={styles.successText}>AI đã xác thực CCCD thành công.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setBankPrefilled(false);
                setWizardStep("bank-info");
                void refetch();
              }}
              style={styles.submitButton}
            >
              <Text style={styles.submitText}>Tiếp tục nhập thông tin ngân hàng</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "bank-info" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bước 2 — Thông tin ngân hàng</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tên ngân hàng</Text>
              <TextInput
                editable={!busy}
                maxLength={200}
                placeholder="Vietcombank"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Số tài khoản</Text>
              <TextInput
                editable={!busy}
                keyboardType="number-pad"
                maxLength={50}
                placeholder="1234567890"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Chủ tài khoản</Text>
              <TextInput
                autoCapitalize="characters"
                editable={!busy}
                maxLength={200}
                placeholder="NGUYEN VAN A"
                placeholderTextColor={theme.placeholder}
                style={styles.fieldInput}
                value={bankAccountHolderName}
                onChangeText={setBankAccountHolderName}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { void handleBankSubmit(); }}
              style={[styles.submitButton, busy && styles.disabled]}
            >
              <Text style={styles.submitText}>{busy ? "Đang lưu..." : "Lưu thông tin"}</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "review-submit" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bước 3 — Kiểm tra và gửi hồ sơ</Text>
            <View style={styles.summaryBox}>
              <DetailLine label="CCCD" value={application?.nationalIdVerified ? "Đã xác minh" : "Chưa xác minh"} />
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Số CCCD</Text>
                <MaskedDocumentValue
                  canReveal={application?.nationalIdVerified ?? false}
                  documentType="CCCD"
                  maskedValue={application?.nationalIdNumber ?? null}
                  revealDisabledHint="Giấy tờ chưa được xác thực để hiển thị."
                />
              </View>
              <DetailLine label="Ngân hàng" value={application?.bankName || "-"} />
              <DetailLine label="Số tài khoản" value={application?.bankAccountNumber || "-"} />
              <DetailLine label="Chủ tài khoản" value={application?.bankAccountHolderName || "-"} />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { void handleFinalSubmit(); }}
              style={[styles.submitButton, busy && styles.disabled]}
            >
              <Text style={styles.submitText}>{busy ? "Đang gửi..." : "Gửi hồ sơ"}</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "manual-review" ? (
          <View style={styles.card}>
            <View style={styles.infoBox}>
              <Clock color={theme.brand} size={20} strokeWidth={2.3} />
              <Text style={styles.infoText}>Hồ sơ của bạn đang chờ nhân viên kiểm tra. Vui lòng quay lại sau.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { void handleRefresh(); }} style={styles.outlineButton}>
              <RefreshCw color={theme.brand} size={18} strokeWidth={2.3} />
              <Text style={styles.pickText}>Kiểm tra lại</Text>
            </Pressable>
          </View>
        ) : null}

        {wizardStep === "owner-success" ? (
          <View style={styles.card}>
            <View style={styles.successBox}>
              <BadgeCheck color={theme.success} size={22} strokeWidth={2.3} />
              <Text style={styles.successText}>Chúc mừng! Bạn đã trở thành chủ xe trên MoveVN.</Text>
            </View>
            <Text style={styles.hint}>Phiên đăng nhập đã được làm mới với vai trò mới. Quay lại để tải lại thông tin.</Text>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.submitButton}>
              <Text style={styles.submitText}>Về tài khoản</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !application
        && wizardStep !== "already-owner" && wizardStep !== "owner-success" ? (
          <View style={styles.card}>
            <View style={styles.warnBox}>
              <AlertTriangle color={theme.danger} size={18} strokeWidth={2.3} />
              <Text style={styles.warnText}>
                {error ?? "Chưa tải được hồ sơ. Bạn cần tài khoản Customer đã xác minh email."}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { void handleRefresh(); }} style={styles.outlineButton}>
              <RefreshCw color={theme.brand} size={18} strokeWidth={2.3} />
              <Text style={styles.pickText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stepper({ current }: { current: number }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.stepper}>
      {stepperLabels.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                done && styles.stepDotDone,
                active && styles.stepDotActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (done || active) && styles.stepNumberActive,
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
          </View>
        );
      })}
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
  topBarSpacer: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
  center: { alignItems: "center", gap: 12, paddingVertical: 48 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  hint: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  muted: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  stepper: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  stepItem: { alignItems: "center", gap: 6, flex: 1 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { borderColor: theme.success, backgroundColor: theme.successSoft },
  stepDotActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
  stepNumber: { color: theme.faint, fontSize: 13, fontWeight: "800" },
  stepNumberActive: { color: theme.brand },
  stepLabel: { color: theme.faint, fontSize: 11, fontWeight: "700", textAlign: "center" },
  stepLabelActive: { color: theme.brand },
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
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  detailLabel: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  detailValue: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 },
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
});
