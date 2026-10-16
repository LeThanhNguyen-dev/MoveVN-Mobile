import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  getContractsByBooking,
  requestSignOtp,
  sendForSigning,
  tryViewWithGrant,
  verifySignOtp,
} from "@/features/contracts/contractService";
import ContractPinFlow from "@/features/contracts/components/ContractPinFlow";
import ContractDocument from "@/features/contracts/components/ContractDocument";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import {
  CONTRACT_STATUS_LABELS,
  type ContractContent,
  type ContractSummary,
} from "@/features/contracts/types";
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

function canSignContract(contract: ContractSummary, userId: number): boolean {
  if (contract.status !== "PendingSigning" && contract.status !== "Draft") return false;
  if (userId === contract.ownerId) return contract.ownerSignStatus !== "Signed";
  if (userId === contract.customerId) return contract.customerSignStatus !== "Signed";
  return false;
}

function isParty(contract: ContractSummary, userId: number): boolean {
  return userId === contract.ownerId || userId === contract.customerId;
}

export default function ContractBlock({
  bookingId,
  userId,
  canManage,
  onChanged,
}: {
  bookingId: number;
  userId: number;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [signingId, setSigningId] = useState<number | null>(null);
  const [otpModal, setOtpModal] = useState<null | { contract: ContractSummary }>(null);
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [content, setContent] = useState<ContractContent | null>(null);
  const [pinContract, setPinContract] = useState<ContractSummary | null>(null);
  const userEmail = useAuthStore((s) => s.user?.email ?? "");

  const load = useCallback(async () => {
    try {
      setContracts(await getContractsByBooking(bookingId));
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend(contract: ContractSummary) {
    if (sendingId !== null) return;
    setSendingId(contract.id);
    try {
      await sendForSigning(contract.id);
      Alert.alert("Thành công", "Hợp đồng đã được gửi để hai bên ký.");
      await load();
      onChanged?.();
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không thể gửi hợp đồng."));
      await load();
    } finally {
      setSendingId(null);
    }
  }

  async function handleView(contract: ContractSummary) {
    // Xem bằng mã PIN của app (đúng như bản web), chỉ ký mới dùng OTP mail.
    try {
      setContent(await tryViewWithGrant(contract.id));
      void load();
    } catch {
      setPinContract(contract);
    }
  }

  async function handleSign(contract: ContractSummary) {
    if (signingId !== null) return;
    setSigningId(contract.id);
    try {
      if (contract.status === "Draft") {
        await sendForSigning(contract.id);
        await load();
      }
      await requestSignOtp(contract.id);
      setOtp("");
      setOtpModal({ contract });
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không thể gửi mã OTP lúc này."));
      await load();
    } finally {
      setSigningId(null);
    }
  }

  async function handleOtpConfirm() {
    if (!otpModal || otp.trim().length < 6) {
      Alert.alert("Thiếu mã", "Vui lòng nhập đủ 6 chữ số OTP.");
      return;
    }
    setOtpBusy(true);
    try {
      await verifySignOtp(otpModal.contract.id, otp.trim());
      Alert.alert("Thành công", "Bạn đã ký hợp đồng.");
      setOtpModal(null);
      setContent(null);
      await load();
      onChanged?.();
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Mã OTP không đúng hoặc đã hết hạn."));
    } finally {
      setOtpBusy(false);
    }
  }

  const contentContract = content ? contracts.find((c) => c.id === content.id) ?? null : null;

  return (
    <View style={styles.card}>
      <AppText display style={styles.cardTitle}>Hợp đồng ({contracts.length})</AppText>
      {loading ? (
        <ActivityIndicator color={theme.brand} />
      ) : contracts.length === 0 ? (
        <AppText style={styles.muted}>Chưa có hợp đồng. Hệ thống thường tự tạo lúc duyệt booking.</AppText>
      ) : (
        contracts.map((c) => {
          const signable = canSignContract(c, userId);
          return (
            <View key={c.id} style={styles.row}>
              <View style={styles.info}>
                <AppText style={styles.version}>
                  v{c.version} · {c.contractNumber}
                </AppText>
                <AppText style={styles.muted}>
                  {CONTRACT_STATUS_LABELS[c.status] ?? c.status} ·{" "}
                  {userId === c.ownerId
                    ? c.ownerSignStatus === "Signed"
                      ? "bạn đã ký"
                      : "bạn chưa ký"
                    : c.customerSignStatus === "Signed"
                      ? "bạn đã ký"
                      : "bạn chưa ký"}
                </AppText>
              </View>
              <View style={styles.actions}>
                {(isParty(c, userId) || canManage) && (
                  <Pressable onPress={() => handleView(c)} style={styles.smallButton}>
                    <AppText style={styles.smallText}>Xem</AppText>
                  </Pressable>
                )}
                {signable && (
                  <Pressable
                    onPress={() => handleSign(c)}
                    disabled={signingId !== null}
                    style={[styles.smallButton, styles.signButton, signingId !== null && styles.disabled]}
                  >
                    {signingId === c.id ? (
                      <ActivityIndicator size="small" color={theme.onBrand} />
                    ) : (
                      <AppText style={[styles.smallText, styles.signText]}>Ký</AppText>
                    )}
                  </Pressable>
                )}
                {canManage && c.status === "Draft" && !signable && (
                  <Pressable
                    onPress={() => handleSend(c)}
                    disabled={sendingId !== null}
                    style={[styles.smallButton, styles.signButton, sendingId !== null && styles.disabled]}
                  >
                    {sendingId === c.id ? (
                      <ActivityIndicator size="small" color={theme.onBrand} />
                    ) : (
                      <AppText style={[styles.smallText, styles.signText]}>Gửi ký</AppText>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}

      <Modal visible={otpModal !== null} transparent animationType="fade" onRequestClose={() => setOtpModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <AppText display style={styles.cardTitle}>Ký hợp đồng</AppText>
            <AppText style={styles.muted}>Mã OTP ký đã gửi đến email của bạn, hiệu lực 10 phút.</AppText>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="6 chữ số"
              placeholderTextColor={theme.placeholder}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setOtpModal(null)} style={styles.ghostButton}>
                <AppText style={styles.ghostText}>Đóng</AppText>
              </Pressable>
              <Pressable onPress={handleOtpConfirm} disabled={otpBusy} style={[styles.primaryButton, otpBusy && styles.disabled]}>
                {otpBusy ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <AppText style={styles.primaryText}>Xác nhận</AppText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {pinContract && (
        <ContractPinFlow
          contract={pinContract}
          userEmail={userEmail}
          onClose={() => setPinContract(null)}
          onVerified={(detail) => {
            setContent(detail);
            setPinContract(null);
            void load();
          }}
        />
      )}

      <Modal visible={content !== null} transparent animationType="fade" onRequestClose={() => setContent(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.contentModal]}>
            <AppText display style={styles.cardTitle}>
              Hợp đồng {content?.contractNumber} · v{content?.version}
            </AppText>
            <ScrollView style={styles.contentScroll}>
              {content ? <ContractDocument content={content} /> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              {contentContract && canSignContract(contentContract, userId) ? (
                <Pressable
                  onPress={() => {
                    setContent(null);
                    void handleSign(contentContract);
                  }}
                  style={styles.primaryButton}
                >
                  <AppText style={styles.primaryText}>Ký hợp đồng</AppText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setContent(null)} style={styles.ghostButton}>
                <AppText style={styles.ghostText}>Đóng</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <AppText style={rowStyles.label}>{label}</AppText>
      <AppText style={rowStyles.value}>{value}</AppText>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  label: { color: "#6b7280", fontSize: 13, flexShrink: 0 },
  value: { color: "#111827", fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
    muted: { color: theme.muted, fontSize: 13 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    info: { flex: 1, gap: 2 },
    version: { color: theme.text, fontSize: 14, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 8 },
    smallButton: {
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 48,
      alignItems: "center",
    },
    smallText: { color: theme.text, fontSize: 12, fontWeight: "800" },
    signButton: { backgroundColor: theme.brand },
    signText: { color: theme.onBrand },
    disabled: { opacity: 0.6 },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    contentModal: { maxHeight: "85%" },
    contentScroll: { maxHeight: 420 },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 15,
      letterSpacing: 4,
      textAlign: "center",
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 10,
      minWidth: 110,
      alignItems: "center",
    },
    primaryText: { color: theme.onBrand, fontWeight: "800" },
  });
