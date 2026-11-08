import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { BookingButton, BookingField } from "@/features/booking/components/BookingControls";
import type { BookingResponse } from "@/features/booking/types";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  approveExtensionRequest,
  createExtensionRequest,
  getExtensionRequests,
  rejectExtensionRequest,
  type ExtensionRequestItem,
} from "../contractService";

export default function ExtensionRequestPanel({ booking, onBookingChanged }: {
  booking: BookingResponse;
  onBookingChanged?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.userId === booking.ownerId;
  const isCustomer = user?.userId === booking.customerId;

  const [requests, setRequests] = useState<ExtensionRequestItem[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ExtensionRequestItem | null>(null);
  const [busy, setBusy] = useState<"" | "approve" | "request" | "reject">("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await getExtensionRequests(booking.id));
    } catch {
      setRequests([]);
    }
  }, [booking.id]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  if (!isOwner && !isCustomer) return null;

  const pending = requests.find((r) => r.status === "Pending");
  const latest = requests[0];
  const canRequest = isCustomer && !pending && ["DepositPaid", "InProgress"].includes(booking.status);

  async function handleRequest() {
    const parsed = Number(days);
    if (!/^\d+$/.test(days.trim()) || !Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
      setError("Số ngày gia hạn phải từ 1 đến 90.");
      return;
    }
    setBusy("request"); setError("");
    try {
      await createExtensionRequest(booking.id, parsed, note.trim() || undefined);
      Alert.alert("Đã gửi yêu cầu", `Yêu cầu gia hạn ${parsed} ngày đã được gửi cho chủ xe.`);
      setShowRequestModal(false);
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể gửi yêu cầu gia hạn."));
    } finally {
      setBusy("");
    }
  }

  async function handleApprove(request: ExtensionRequestItem) {
    if (busy) return;
    setBusy("approve"); setError("");
    try {
      await approveExtensionRequest(request.id);
      Alert.alert("Đã duyệt gia hạn", `Đã tạo hợp đồng phiên bản mới cho ${request.additionalDays} ngày gia hạn. Hai bên cần ký lại bằng OTP.`);
      await loadRequests();
      onBookingChanged?.();
    } catch (err) {
      Alert.alert("Không thể duyệt", getApiErrorMessage(err, "Không thể duyệt yêu cầu gia hạn."));
      await loadRequests();
    } finally {
      setBusy("");
    }
  }

  async function handleReject() {
    if (!rejectTarget || !reason.trim()) return;
    setBusy("reject"); setError("");
    try {
      await rejectExtensionRequest(rejectTarget.id, reason.trim());
      Alert.alert("Đã từ chối", "Yêu cầu gia hạn đã bị từ chối.");
      setRejectTarget(null);
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể từ chối yêu cầu gia hạn."));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {isOwner && pending ? (
        <View style={[styles.banner, styles.infoBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.info }]}>
            Khách thuê yêu cầu gia hạn thêm {pending.additionalDays} ngày
          </Text>
          {pending.note ? <Text style={styles.muted}>Ghi chú: {pending.note}</Text> : null}
          <Text style={styles.muted}>Duyệt sẽ kiểm tra lịch xe và tạo hợp đồng phiên bản mới để hai bên ký lại.</Text>
          <View style={styles.bannerActions}>
            <View style={styles.flexButton}>
              <BookingButton title="Duyệt" busy={busy === "approve"} onPress={() => void handleApprove(pending)} />
            </View>
            <View style={styles.flexButton}>
              <BookingButton title="Từ chối" secondary disabled={busy !== ""} onPress={() => { setError(""); setReason(""); setRejectTarget(pending); }} />
            </View>
          </View>
        </View>
      ) : null}

      {isCustomer && pending ? (
        <View style={[styles.banner, styles.infoBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.info }]}>
            Yêu cầu gia hạn thêm {pending.additionalDays} ngày đang chờ chủ xe duyệt
          </Text>
          {pending.note ? <Text style={styles.muted}>Ghi chú: {pending.note}</Text> : null}
        </View>
      ) : null}

      {isOwner && !pending && latest && latest.status === "Approved" ? (
        <View style={[styles.banner, styles.successBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.success }]}>
            Đã duyệt yêu cầu gia hạn {latest.additionalDays} ngày. Hợp đồng phiên bản mới đang chờ hai bên ký lại.
          </Text>
        </View>
      ) : null}

      {isCustomer && !pending && latest && latest.status === "Rejected" ? (
        <View style={[styles.banner, styles.dangerBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.danger }]}>
            Yêu cầu gia hạn {latest.additionalDays} ngày đã bị chủ xe từ chối
          </Text>
          {latest.rejectReason ? <Text style={styles.muted}>Lý do: {latest.rejectReason}</Text> : null}
        </View>
      ) : null}

      {canRequest ? (
        <BookingButton title="Yêu cầu gia hạn hợp đồng" onPress={() => { setError(""); setDays(""); setNote(""); setShowRequestModal(true); }} />
      ) : null}

      <Modal visible={showRequestModal} transparent animationType="fade" onRequestClose={() => { if (!busy) setShowRequestModal(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Yêu cầu gia hạn hợp đồng</Text>
            <Text style={styles.muted}>
              Gửi yêu cầu gia hạn cho chủ xe. Nếu chủ xe duyệt, hệ thống sẽ kiểm tra lịch xe và tạo phiên bản hợp đồng mới để hai bên ký lại bằng OTP.
            </Text>
            <BookingField label="Số ngày muốn gia hạn" numeric value={days} onChangeText={setDays} editable={!busy} />
            <BookingField label="Ghi chú cho chủ xe (không bắt buộc)" value={note} onChangeText={setNote} multiline editable={!busy} />
            {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowRequestModal(false)} disabled={busy !== ""} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Hủy</Text>
              </Pressable>
              <Pressable onPress={() => void handleRequest()} disabled={busy !== "" || !days} style={[styles.primaryButton, (busy !== "" || !days) && styles.disabled]}>
                <Text style={styles.primaryText}>Gửi yêu cầu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setRejectTarget(null); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Từ chối yêu cầu gia hạn {rejectTarget?.additionalDays ?? 0} ngày</Text>
            <BookingField label="Lý do từ chối" value={reason} onChangeText={setReason} multiline editable={!busy} />
            {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRejectTarget(null)} disabled={busy !== ""} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Hủy</Text>
              </Pressable>
              <Pressable onPress={() => void handleReject()} disabled={busy !== "" || !reason.trim()} style={[styles.primaryButton, styles.dangerButton, (busy !== "" || !reason.trim()) && styles.disabled]}>
                <Text style={styles.primaryText}>Xác nhận từ chối</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
    infoBanner: { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder },
    successBanner: { backgroundColor: theme.successSoft, borderColor: theme.success },
    dangerBanner: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder },
    bannerTitle: { fontSize: 14, fontWeight: "700" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    bannerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    flexButton: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    modalTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
    ghostButton: { borderRadius: 8, backgroundColor: theme.surfaceAlt, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
    ghostText: { color: theme.text, fontSize: 13, fontWeight: "700" },
    primaryButton: { borderRadius: 8, backgroundColor: theme.brand, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
    dangerButton: { backgroundColor: theme.danger },
    primaryText: { color: theme.onBrand, fontSize: 13, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });
