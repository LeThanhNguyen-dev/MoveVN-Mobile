import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import type { UploadFileInput } from "@/types/upload";
import {
  evidenceList,
  formatDisputeDateTime,
  formatDisputeMoney,
  trafficFineStatusLabels,
} from "@/features/disputes/components/disputeLabels";
import {
  getDisputeById,
  updateTrafficFine,
  uploadDisputeEvidenceImages,
} from "@/features/disputes/disputeService";
import type { DisputeDetailResponse } from "@/features/disputes/types";

export type TrafficFineForm = {
  noticeNumber: string;
  issuingAuthority: string;
  licensePlate: string;
  violationAt: string;
  dueAt: string;
  amount: string;
  paymentMode: "CustomerPaysAuthority" | "ReimburseOwner";
  ownerPaidAt: string;
};

export const emptyTrafficFineForm: TrafficFineForm = {
  noticeNumber: "",
  issuingAuthority: "",
  licensePlate: "",
  violationAt: "",
  dueAt: "",
  amount: "",
  paymentMode: "CustomerPaysAuthority",
  ownerPaidAt: "",
};

/** Ngày giờ Việt Nam "YYYY-MM-DD HH:mm" → ISO. Null khi sai định dạng. */
export function parseVietnamDateTime(value: string): string | null {
  const normalized = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type ProofAsset = { uri: string; name: string; mime: string; size?: number | null };

export function validProofAssets(files: ProofAsset[]): boolean {
  return (
    files.length >= 1 &&
    files.length <= 6 &&
    files.every(
      (f) =>
        ["image/jpeg", "image/png", "image/webp"].includes(f.mime) &&
        (f.size == null || f.size <= 5 * 1024 * 1024),
    )
  );
}

export default function TrafficFineCreateFields({
  value,
  onChange,
  owner,
  receipts,
  onReceipts,
}: {
  value: TrafficFineForm;
  onChange: (v: TrafficFineForm) => void;
  owner: boolean;
  receipts: ProofAsset[];
  onReceipts: (files: ProofAsset[]) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function set<K extends keyof TrafficFineForm>(key: K, text: string) {
    onChange({ ...value, [key]: text });
  }

  async function pickReceipts() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    onReceipts(
      result.assets
        .filter((a) => a.uri)
        .slice(0, 6)
        .map((a) => ({
          uri: a.uri ?? "",
          name: a.fileName ?? "receipt.jpg",
          mime: a.mimeType ?? "image/jpeg",
          size: a.fileSize ?? null,
        })),
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>Thông tin thông báo phạt nguội</Text>
      <Text style={styles.label}>Số thông báo / biên bản</Text>
      <TextInput value={value.noticeNumber} onChangeText={(t) => set("noticeNumber", t)} maxLength={100} style={styles.input} />
      <Text style={styles.label}>Đơn vị thông báo</Text>
      <TextInput value={value.issuingAuthority} onChangeText={(t) => set("issuingAuthority", t)} maxLength={200} style={styles.input} />
      <Text style={styles.label}>Biển số xe</Text>
      <TextInput value={value.licensePlate} onChangeText={(t) => set("licensePlate", t.toUpperCase())} maxLength={32} autoCapitalize="characters" style={styles.input} />
      <Text style={styles.label}>Số tiền phạt (VND)</Text>
      <TextInput value={value.amount} onChangeText={(t) => set("amount", t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={styles.input} />
      <Text style={styles.label}>Thời điểm vi phạm (VD: 2026-10-01 14:30)</Text>
      <TextInput value={value.violationAt} onChangeText={(t) => set("violationAt", t)} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={theme.placeholder} style={styles.input} />
      <Text style={styles.label}>Hạn xử lý theo thông báo (VD: 2026-10-31)</Text>
      <TextInput
        value={value.dueAt}
        onChangeText={(t) => set("dueAt", t)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.placeholder}
        style={styles.input}
      />
      <Text style={styles.label}>Hình thức xử lý</Text>
      <View style={styles.modeRow}>
        {(["CustomerPaysAuthority", "ReimburseOwner"] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => (mode === "ReimburseOwner" && !owner ? undefined : onChange({ ...value, paymentMode: mode }))}
            style={[styles.modeChip, value.paymentMode === mode && styles.modeChipActive]}
          >
            <Text style={[styles.modeText, value.paymentMode === mode && styles.modeTextActive]}>
              {mode === "CustomerPaysAuthority" ? "Khách tự nộp" : "Hoàn trả chủ xe"}
            </Text>
          </Pressable>
        ))}
      </View>
      {value.paymentMode === "ReimburseOwner" && (
        <>
          <Text style={styles.label}>Thời điểm chủ xe đã nộp phạt (VD: 2026-10-05 09:00)</Text>
          <TextInput value={value.ownerPaidAt} onChangeText={(t) => set("ownerPaidAt", t)} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={theme.placeholder} style={styles.input} />
          <Pressable onPress={() => void pickReceipts()} style={styles.pickButton}>
            <Text style={styles.pickText}>Chọn biên lai ({receipts.length} ảnh)</Text>
          </Pressable>
        </>
      )}
      <Text style={styles.muted}>Bắt buộc đính kèm ảnh thông báo phạt ở phần bằng chứng bên dưới.</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: { gap: 8, borderWidth: 1, borderColor: "#BAE6FD", backgroundColor: "#F0F9FF", borderRadius: 12, padding: 12 },
    boxTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
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
    muted: { color: theme.muted, fontSize: 12 },
    modeRow: { flexDirection: "row", gap: 8 },
    modeChip: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    modeChipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    modeText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    modeTextActive: { color: theme.brand },
    pickButton: { borderRadius: 10, backgroundColor: theme.surfaceAlt, paddingVertical: 11, alignItems: "center" },
    pickText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });

export function validateTrafficFineForm(value: TrafficFineForm, receiptCount: number): string | null {
  if (!value.noticeNumber.trim() || !value.issuingAuthority.trim() || !value.licensePlate.trim()) {
    return "Nhập số thông báo, đơn vị thông báo và biển số xe.";
  }
  if (!parseVietnamDateTime(value.violationAt)) return "Thời điểm vi phạm sai định dạng (YYYY-MM-DD HH:mm).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.dueAt.trim()) || Number.isNaN(new Date(`${value.dueAt}T00:00:00+07:00`).getTime())) {
    return "Hạn xử lý sai định dạng (YYYY-MM-DD).";
  }
  const amount = Number(value.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) return "Số tiền phạt phải là số nguyên VND dương.";
  if (value.paymentMode === "ReimburseOwner") {
    if (!parseVietnamDateTime(value.ownerPaidAt)) return "Nhập thời điểm chủ xe đã nộp phạt.";
    if (receiptCount < 1 || receiptCount > 6) return "Cần 1–6 ảnh biên lai chủ xe đã nộp phạt.";
  }
  return null;
}

export function toCreateTrafficFineRequest(
  value: TrafficFineForm,
  ownerReceipt?: { urls: string[]; tokens: string[] },
) {
  const violationAt = parseVietnamDateTime(value.violationAt) as string;
  const dueAt = new Date(`${value.dueAt}T23:59:59+07:00`).toISOString();
  const ownerPaidAt = value.paymentMode === "ReimburseOwner" ? (parseVietnamDateTime(value.ownerPaidAt) as string) : undefined;
  return {
    noticeNumber: value.noticeNumber.trim(),
    issuingAuthority: value.issuingAuthority.trim(),
    licensePlate: value.licensePlate.trim().toUpperCase(),
    amount: Number(value.amount),
    paymentMode: value.paymentMode,
    violationAt,
    dueAt,
    ...(ownerPaidAt
      ? {
          ownerPaidAt,
          ownerPaymentEvidenceUrls: ownerReceipt?.urls.join("\n"),
          ownerPaymentEvidenceTokens: ownerReceipt?.tokens,
        }
      : {}),
  };
}
