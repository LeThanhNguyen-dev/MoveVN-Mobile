import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import type { UploadFileInput } from "@/types/upload";
import { getMyBookings, getOwnerBookings } from "@/features/booking/bookingService";
import type { BookingResponse } from "@/features/booking/types";
import { problemLabels } from "@/features/disputes/components/disputeLabels";
import { createDispute, uploadDisputeEvidenceImages } from "@/features/disputes/disputeService";
import TrafficFineCreateFields, {
  emptyTrafficFineForm,
  toCreateTrafficFineRequest,
  validateTrafficFineForm,
  type TrafficFineForm,
} from "@/features/disputes/components/TrafficFineCreateFields";

const MAX_EVIDENCE_IMAGES = 6;
const MAX_EVIDENCE_IMAGE_SIZE = 5 * 1024 * 1024;
const REPORT_TYPES = ["Damage", "Payment", "LateReturn", "Accident", "TrafficFine", "Other"];

type EvidenceAsset = { id: string; uri: string; name: string; mime: string; size?: number | null };

export type DisputeCreatePrefill = {
  bookingId?: number;
  reportType?: string;
  description?: string;
};

// Port RN của modal tạo tranh chấp trong FrontEnd DisputePage.
export default function CreateDisputeScreen({
  role,
  initial,
  onBack,
  onCreated,
}: {
  role: "Customer" | "Owner";
  initial?: DisputeCreatePrefill | null;
  onBack: () => void;
  onCreated: (id: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [bookingId, setBookingId] = useState(initial?.bookingId ? String(initial.bookingId) : "");
  const [reportType, setReportType] = useState(initial?.reportType ?? "Other");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [paymentScope, setPaymentScope] = useState("BookingDeposit");
  const [fineForm, setFineForm] = useState<TrafficFineForm>({ ...emptyTrafficFineForm });
  const [ownerReceipts, setOwnerReceipts] = useState<EvidenceAsset[]>([]);
  const [evidence, setEvidence] = useState<EvidenceAsset[]>([]);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBookingsLoading(true);
    void (async () => {
      try {
        const statuses =
          reportType === "TrafficFine" ? ["Completed", "Returned", "Returning", "InProgress"] : ["Completed", "Returned", "Returning"];
        const loaded: BookingResponse[] = [];
        for (const status of statuses) {
          let page = 1;
          for (;;) {
            const result = await (role === "Owner" ? getOwnerBookings : getMyBookings)({ status: status as never, page, pageSize: 50 });
            loaded.push(...result.items);
            if (result.items.length === 0 || loaded.length >= result.totalCount) break;
            page += 1;
          }
        }
        loaded.sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
        if (!cancelled) setBookings(loaded);
      } catch {
        if (!cancelled) setBookings([]);
      } finally {
        if (!cancelled) setBookingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, reportType]);

  async function pickImages(kind: "evidence" | "receipts") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_EVIDENCE_IMAGES,
    });
    if (result.canceled) return;
    const picked: EvidenceAsset[] = result.assets
      .filter((a) => a.uri)
      .slice(0, MAX_EVIDENCE_IMAGES)
      .map((a, index) => ({
        id: `${Date.now()}-${index}`,
        uri: a.uri ?? "",
        name: a.fileName ?? "bang-chung.jpg",
        mime: a.mimeType ?? "image/jpeg",
        size: a.fileSize ?? null,
      }));
    const invalid = picked.find(
      (f) => !["image/jpeg", "image/png", "image/webp"].includes(f.mime) || (f.size != null && f.size > MAX_EVIDENCE_IMAGE_SIZE),
    );
    if (invalid) {
      setError("Chỉ nhận JPG, PNG, WebP và mỗi ảnh phải dưới 5MB.");
      return;
    }
    if (kind === "receipts") {
      setOwnerReceipts(picked);
    } else {
      setEvidence((prev) => [...prev, ...picked].slice(0, MAX_EVIDENCE_IMAGES));
    }
    setError("");
  }

  function toUploadInput(list: EvidenceAsset[]): UploadFileInput[] {
    return list.map(({ uri, name, mime }) => ({ uri, name, type: mime }));
  }

  async function submit() {
    if (!bookingId || !description.trim()) {
      setError("Chọn booking và nhập mô tả sự việc.");
      return;
    }
    if (reportType === "TrafficFine") {
      const fineError = validateTrafficFineForm(fineForm, ownerReceipts.length);
      if (fineError) {
        setError(fineError);
        return;
      }
    }
    Alert.alert(
      "Trước khi tạo tranh chấp",
      reportType === "TrafficFine"
        ? "Kiểm tra thông báo, biển số, thời điểm vi phạm và ảnh chứng từ. Hồ sơ được gửi để xác minh."
        : "Vui lòng liên hệ trực tiếp với bên kia để giải quyết vấn đề. Nếu không thể thống nhất, hãy tiếp tục tạo tranh chấp trên hệ thống.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Tiếp tục tạo",
          onPress: () => void doCreate(),
        },
      ],
    );
  }

  async function doCreate() {
    setSubmitting(true);
    setError("");
    try {
      const uploaded =
        evidence.length > 0 ? await uploadDisputeEvidenceImages(toUploadInput(evidence)) : { urls: [], tokens: [] };
      const ownerReceipt =
        reportType === "TrafficFine" && fineForm.paymentMode === "ReimburseOwner"
          ? await uploadDisputeEvidenceImages(toUploadInput(ownerReceipts))
          : undefined;
      const dispute = await createDispute({
        bookingId: Number(bookingId),
        reportType,
        paymentScope: reportType === "Payment" ? paymentScope : null,
        description: description.trim(),
        evidenceUrls: uploaded.urls.join("\n") || null,
        evidenceUploadTokens: uploaded.tokens,
        trafficFine: reportType === "TrafficFine" ? toCreateTrafficFineRequest(fineForm, ownerReceipt) : undefined,
      });
      onCreated(dispute.id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tạo tranh chấp."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Tạo tranh chấp mới</Text>

      <Text style={styles.label}>Booking đã hoàn tất / đã trả xe</Text>
      {bookingsLoading ? (
        <ActivityIndicator color={theme.brand} />
      ) : (
        <View style={styles.bookingList}>
          {bookings.map((booking) => (
            <Pressable
              key={booking.id}
              onPress={() => setBookingId(String(booking.id))}
              style={[styles.bookingRow, bookingId === String(booking.id) && styles.bookingRowActive]}
            >
              <Text style={[styles.bookingCode, bookingId === String(booking.id) && styles.bookingCodeActive]}>
                {booking.bookingCode}
              </Text>
              <Text style={styles.muted}>{booking.status}</Text>
            </Pressable>
          ))}
          {bookings.length === 0 ? <Text style={styles.muted}>Không có booking phù hợp.</Text> : null}
        </View>
      )}

      <Text style={styles.label}>Loại vấn đề</Text>
      <View style={styles.chips}>
        {REPORT_TYPES.map((type) => (
          <Pressable key={type} onPress={() => setReportType(type)} style={[styles.chip, reportType === type && styles.chipActive]}>
            <Text style={[styles.chipText, reportType === type && styles.chipTextActive]}>{problemLabels[type] ?? type}</Text>
          </Pressable>
        ))}
      </View>
      {reportType === "Damage" ? <Text style={styles.warn}>Cần biên bản trả xe và gửi trong 48 giờ kể từ lúc trả xe.</Text> : null}
      {reportType === "Accident" ? <Text style={styles.muted}>Không giới hạn 48 giờ. Không phát sinh bồi thường qua nền tảng.</Text> : null}
      {reportType === "TrafficFine" ? (
        <TrafficFineCreateFields
          value={fineForm}
          onChange={setFineForm}
          owner={role === "Owner"}
          receipts={ownerReceipts.map((r) => ({ uri: r.uri, name: r.name, mime: r.mime, size: r.size }))}
          onReceipts={(files) => setOwnerReceipts(files.map((f, i) => ({ id: `${Date.now()}-r-${i}`, ...f })))}
        />
      ) : null}
      {reportType === "Payment" ? (
        <View style={styles.chips}>
          {(["BookingDeposit", "PlatformCommission"] as const).map((scope) => (
            <Pressable key={scope} onPress={() => setPaymentScope(scope)} style={[styles.chip, paymentScope === scope && styles.chipActive]}>
              <Text style={[styles.chipText, paymentScope === scope && styles.chipTextActive]}>
                {scope === "BookingDeposit" ? "Tiền cọc booking" : "Phí nền tảng"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.label}>Mô tả sự việc</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Mô tả chi tiết sự việc..."
        placeholderTextColor={theme.placeholder}
        multiline
        style={[styles.input, styles.multiline]}
      />

      <Text style={styles.label}>Ảnh bằng chứng ({evidence.length}/{MAX_EVIDENCE_IMAGES})</Text>
      <Pressable onPress={() => void pickImages("evidence")} style={styles.pickButton}>
        <Text style={styles.pickText}>Chọn ảnh từ thư viện</Text>
      </Pressable>
      {evidence.map((item) => (
        <View key={item.id} style={styles.fileRow}>
          <Text numberOfLines={1} style={styles.fileName}>
            {item.name}
          </Text>
          <Pressable onPress={() => setEvidence((prev) => prev.filter((f) => f.id !== item.id))}>
            <Text style={styles.removeText}>Xóa</Text>
          </Pressable>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={onBack} style={styles.ghostButton}>
          <Text style={styles.ghostText}>Hủy</Text>
        </Pressable>
        <Pressable
          disabled={submitting || !bookingId || !description.trim()}
          onPress={() => void submit()}
          style={[styles.primaryButton, (submitting || !bookingId || !description.trim()) && styles.disabled]}
        >
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Gửi tranh chấp</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { padding: 16, gap: 10, paddingBottom: 32 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800" },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 6 },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    multiline: { minHeight: 90, textAlignVertical: "top" },
    muted: { color: theme.muted, fontSize: 13 },
    warn: { color: "#92400e", fontSize: 12, fontWeight: "600" },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    bookingList: { gap: 6, maxHeight: 220 },
    bookingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    bookingRowActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    bookingCode: { color: theme.text, fontSize: 14, fontWeight: "800" },
    bookingCodeActive: { color: theme.brand },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: theme.brand },
    pickButton: { borderRadius: 10, backgroundColor: theme.surfaceAlt, paddingVertical: 11, alignItems: "center" },
    pickText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    fileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    fileName: { color: theme.text, fontSize: 12, flex: 1 },
    removeText: { color: theme.danger, fontSize: 12, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 8, marginTop: 8 },
    ghostButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingVertical: 13, alignItems: "center" },
    ghostText: { color: theme.muted, fontSize: 14, fontWeight: "800" },
    primaryButton: { flex: 2, borderRadius: 12, backgroundColor: theme.brand, paddingVertical: 13, alignItems: "center" },
    primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    disabled: { opacity: 0.4 },
  });
