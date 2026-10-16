import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  evidenceList,
  formatDisputeDateTime,
  formatDisputeMoney,
  trafficFineStatusLabels,
} from "@/features/disputes/components/disputeLabels";
import { getFineStatusStyle } from "@/features/disputes/components/disputeStatusStyles";
import {
  getDisputeById,
  updateTrafficFine,
  uploadDisputeEvidenceImages,
} from "@/features/disputes/disputeService";
import type { DisputeDetailResponse } from "@/features/disputes/types";
import { parseVietnamDateTime, validProofAssets } from "@/features/disputes/components/TrafficFineCreateFields";

type ProofAsset = { uri: string; name: string; mime: string; size?: number | null };

// Port RN của FrontEnd TrafficFinePanel — chỉ phần khách/chủ xe
// (xác minh/escalate của staff không có trên mobile).
export default function TrafficFinePanel({
  dispute,
  onChange,
}: {
  dispute: DisputeDetailResponse;
  onChange: (detail: DisputeDetailResponse) => void;
}) {
  const { theme, mode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = useAuthStore((state) => state.user?.userId);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<ProofAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fine = dispute.trafficFine;
  if (!fine) {
    return (
      <View style={styles.oldBox}>
        <Text style={styles.title}>Hồ sơ phạt nguội cũ</Text>
        <Text style={styles.body}>
          Hồ sơ chưa có thông tin thông báo và chứng từ thanh toán theo luồng mới. Cần lập hồ sơ phạt nguội mới có đầy đủ thông tin để theo
          dõi.
        </Text>
      </View>
    );
  }

  const terminal = dispute.status === "Resolved" || ["Resolved", "Rejected"].includes(fine.status);
  const customer = userId === dispute.customerId && !terminal;
  const owner = userId === dispute.ownerId && !terminal;
  const pending = fine.paymentProofs.find((p) => p.status === "Pending");

  async function pickFiles() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    setFiles(
      result.assets
        .filter((a) => a.uri)
        .slice(0, 6)
        .map((a) => ({ uri: a.uri ?? "", name: a.fileName ?? "chung-tu.jpg", mime: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null })),
    );
  }

  async function act(
    action: "respond" | "payment-proof" | "confirm-owner-receipt",
    extra: { acceptResponsibility?: boolean } = {},
  ) {
    if (busy) return;
    const current = fine;
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      let evidence: { urls: string[]; tokens: string[] } | undefined;
      if (action === "payment-proof") {
        if (!validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()) {
          throw new Error("Cần ngày thanh toán (YYYY-MM-DD HH:mm), mã biên lai và 1–6 ảnh JPG/PNG/WebP, mỗi ảnh tối đa 5 MB.");
        }
        evidence = await uploadDisputeEvidenceImages(
          files.map(({ uri, name, mime }) => ({ uri, name, type: mime })),
        );
      }
      const updated = await updateTrafficFine(dispute.id, action, {
        expectedVersion: current.version,
        note,
        ...extra,
        ...(evidence
          ? {
              amount: current.amount,
              paidAt: parseVietnamDateTime(paidAt) as string,
              transactionReference: reference.trim(),
              evidenceUrls: evidence.urls.join("\n"),
              evidenceUploadTokens: evidence.tokens,
            }
          : {}),
      });
      onChange(updated);
      setNote("");
      setFiles([]);
      setPaidAt("");
      setReference("");
    } catch (err) {
      setError(getApiErrorMessage(err, err instanceof Error ? err.message : "Vui lòng thử lại."));
      try {
        onChange(await getDisputeById(dispute.id));
      } catch {
        // Giữ chi tiết hiện tại khi mất mạng.
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box} accessibilityLabel="Hồ sơ phạt nguội">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Hồ sơ phạt nguội</Text>
        {(() => {
          const st = getFineStatusStyle(fine.status, mode);
          return (
            <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
              <View style={[styles.dot, { backgroundColor: st.dot }]} />
              <Text style={[styles.badgeText, { color: st.text }]}>
                {trafficFineStatusLabels[fine.status] ?? fine.status}
                {fine.isOverdue ? " · Quá hạn" : ""}
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.kv}>
        <Text style={styles.muted}>Số thông báo / biên bản</Text>
        <Text style={styles.value}>{fine.noticeNumber}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>Đơn vị thông báo</Text>
        <Text style={styles.value}>{fine.issuingAuthority}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>Biển số xe</Text>
        <Text style={styles.value}>{fine.licensePlate}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>Số tiền phạt</Text>
        <Text style={styles.value}>{formatDisputeMoney(fine.amount)}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>Thời điểm vi phạm</Text>
        <Text style={styles.value}>{formatDisputeDateTime(fine.violationAt)}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>Hạn xử lý theo thông báo</Text>
        <Text style={styles.value}>{formatDisputeDateTime(fine.dueAt)}</Text>
      </View>
      <Text style={styles.muted}>
        Khoảng thuê đối chiếu: {formatDisputeDateTime(fine.rentalStartAt)} → {formatDisputeDateTime(fine.rentalEndAt)}
      </Text>
      <Text style={styles.muted}>
        {fine.hasConfirmedRentalTimes ? "Dựa trên nhận xe và giờ trả thực tế." : "Có sử dụng giờ dự kiến/biên bản."}{" "}
        {fine.matchesRentalPeriod ? "Thời điểm vi phạm nằm trong khoảng đối chiếu." : "Thời điểm vi phạm nằm ngoài khoảng đối chiếu."}
      </Text>
      <Text style={styles.body}>
        {fine.paymentMode === "ReimburseOwner"
          ? "Khách hoàn trả đúng khoản chủ xe đã nộp phạt. Chủ xe xác nhận đã nhận đủ tiền."
          : "Khách tự nộp phạt cho cơ quan xử lý và gửi biên lai."}{" "}
        MoveVN theo dõi chứng từ; không tự trừ ví hoặc cọc booking.
      </Text>
      {fine.ownerPaidAt ? (
        <Text style={styles.body}>
          Chủ xe đã nộp phạt ngày {formatDisputeDateTime(fine.ownerPaidAt)}
          {fine.ownerPaymentEvidenceUrls
            ? ` · ${evidenceList(fine.ownerPaymentEvidenceUrls).length} ảnh biên lai`
            : ""}
        </Text>
      ) : null}
      {fine.verificationNote ? (
        <Text style={styles.body}>
          Kết quả đối chiếu: {fine.verificationNote} ({formatDisputeDateTime(fine.verifiedAt)})
        </Text>
      ) : null}
      {fine.customerRespondedAt ? (
        <Text style={styles.body}>
          Phản hồi khách: {fine.customerResponse || "Đồng ý trách nhiệm"} ({formatDisputeDateTime(fine.customerRespondedAt)})
        </Text>
      ) : null}
      {fine.rejectionReason ? <Text style={styles.warn}>Lý do từ chối hồ sơ: {fine.rejectionReason}.</Text> : null}

      {fine.paymentProofs.length > 0 ? (
        <View style={styles.proofs}>
          <Text style={styles.title}>Lịch sử chứng từ thanh toán</Text>
          {fine.paymentProofs.map((p) => (
            <View key={p.id} style={styles.proof}>
              <Text style={styles.value}>
                {formatDisputeMoney(p.amount)} · {p.transactionReference} ·{" "}
                {p.status === "Approved" ? "Đã xác minh" : p.status === "Rejected" ? "Chứng từ bị từ chối" : "Chờ xác minh"}
              </Text>
              <Text style={styles.muted}>Ngày thanh toán: {formatDisputeDateTime(p.paidAt)}</Text>
              {p.note ? <Text style={styles.body}>{p.note}</Text> : null}
              {p.ownerReceiptConfirmedAt ? (
                <Text style={styles.body}>Chủ xe xác nhận đã nhận tiền: {formatDisputeDateTime(p.ownerReceiptConfirmedAt)}</Text>
              ) : null}
              {p.reviewNote ? (
                <Text style={styles.body}>Kết quả kiểm tra: {p.reviewNote} ({formatDisputeDateTime(p.reviewedAt)})</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {customer && fine.status === "AwaitingCustomerResponse" ? (
        <View style={styles.actions}>
          <Text style={styles.body}>Đồng ý trách nhiệm chưa đồng nghĩa đã thanh toán.</Text>
          <Text style={styles.label}>Lý do (bắt buộc khi phản đối)</Text>
          <TextInput value={note} onChangeText={setNote} maxLength={2000} multiline style={[styles.input, styles.multiline]} />
          <View style={styles.actionRow}>
            <Pressable disabled={busy} onPress={() => void act("respond", { acceptResponsibility: true })} style={styles.primaryButton}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Đồng ý trách nhiệm</Text>}
            </Pressable>
            <Pressable
              disabled={busy || !note.trim()}
              onPress={() => void act("respond", { acceptResponsibility: false })}
              style={[styles.secondaryButton, (busy || !note.trim()) && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Phản đối trách nhiệm</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {customer && fine.status === "AwaitingPayment" ? (
        <View style={styles.actions}>
          <Text style={styles.title}>
            Gửi chứng từ {fine.paymentMode === "ReimburseOwner" ? "hoàn trả chủ xe" : "nộp phạt"}
          </Text>
          <Text style={styles.body}>Số tiền cần chứng minh: {formatDisputeMoney(fine.amount)}</Text>
          <Text style={styles.label}>Thời điểm thanh toán (VD: 2026-10-05 14:30)</Text>
          <TextInput value={paidAt} onChangeText={setPaidAt} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={theme.placeholder} style={styles.input} />
          <Text style={styles.label}>Mã biên lai / giao dịch</Text>
          <TextInput value={reference} onChangeText={setReference} maxLength={150} style={styles.input} />
          <Pressable onPress={() => void pickFiles()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Chọn ảnh chứng từ ({files.length}/6)</Text>
          </Pressable>
          <Pressable
            disabled={busy || !validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()}
            onPress={() => void act("payment-proof")}
            style={[styles.primaryButton, (busy || !validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()) && styles.disabled]}
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Gửi chứng từ để xác minh</Text>}
          </Pressable>
        </View>
      ) : null}

      {owner && fine.paymentMode === "ReimburseOwner" && pending && !pending.ownerReceiptConfirmedAt ? (
        <Pressable disabled={busy} onPress={() => void act("confirm-owner-receipt")} style={[styles.primaryButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Tôi xác nhận đã nhận đủ {formatDisputeMoney(fine.amount)}</Text>}
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: { gap: 8, borderWidth: 1, borderColor: "#BAE6FD", backgroundColor: theme.surface, borderRadius: 12, padding: 12 },
    oldBox: { gap: 6, borderWidth: 1, borderColor: "#FCD34D", backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: "800" },
    status: { color: "#0284C7", fontSize: 12, fontWeight: "700" },
    kv: { gap: 1 },
    muted: { color: theme.muted, fontSize: 12 },
    value: { color: theme.text, fontSize: 13, fontWeight: "600" },
    body: { color: theme.text, fontSize: 13, lineHeight: 19 },
    warn: { color: "#92400e", backgroundColor: "#FEF3C7", fontSize: 12, borderRadius: 8, padding: 8 },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    proofs: { gap: 8 },
    proof: { gap: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10 },
    actions: { gap: 8, marginTop: 4 },
    label: { color: theme.text, fontSize: 13, fontWeight: "700" },
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
    multiline: { minHeight: 70, textAlignVertical: "top" },
    actionRow: { flexDirection: "row", gap: 8 },
    primaryButton: { borderRadius: 12, backgroundColor: theme.brand, paddingVertical: 12, alignItems: "center", flex: 1 },
    primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: theme.brandBorder, paddingVertical: 12, alignItems: "center", flex: 1 },
    secondaryText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.4 },
  });
