import { BookingButton, BookingField } from "@/features/booking/components/BookingControls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  getContractsByBooking,
  createContract, extendContract, downloadContractPdf, getContractAudit, type ContractAuditLogItem,
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
import * as DeviceStorage from "@/services/deviceStorage";

const SIGN_OTP_TTL_MS = 10 * 60 * 1000;

function signOtpStorageKey(userId: number, contractId: number) {
  return `movevn.contract-sign-otp:${userId}:${contractId}`;
}

async function hasUnexpiredSignOtp(userId: number, contractId: number) {
  const key = signOtpStorageKey(userId, contractId);
  try {
    const sentAt = Number(await DeviceStorage.getItemAsync(key));
    if (Number.isFinite(sentAt) && sentAt > 0 && Date.now() - sentAt < SIGN_OTP_TTL_MS) return true;
    await DeviceStorage.deleteItemAsync(key);
  } catch {
    // OTP delivery must still work if device storage is unavailable.
  }
  return false;
}

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
  bookingStatus,
  userId,
  canManage,
  onChanged,
}: {
  bookingId: number;
  bookingStatus?: string;
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
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extendTarget, setExtendTarget] = useState<ContractSummary | null>(null);
  const [days, setDays] = useState("1");
  const [extending, setExtending] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<"view" | "download">("view");
  const [audit, setAudit] = useState<ContractAuditLogItem[]>([]);
  const actionLock = useRef(false);
  const userEmail = useAuthStore((s) => s.user?.email ?? "");

  const load = useCallback(async () => {
    try {
      setContracts(await getContractsByBooking(bookingId)); setLoadError("");
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Không tải được hợp đồng. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load, bookingStatus]);

  useEffect(() => {
    const timer = setInterval(() => { if (!actionLock.current) void load(); }, 30000);
    const sub = AppState.addEventListener("change", state => { if (state === "active" && !actionLock.current) void load(); });
    return () => { clearInterval(timer); sub.remove(); };
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
      setPinPurpose("view"); setPinContract(contract);
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
      if (!(await hasUnexpiredSignOtp(userId, contract.id))) {
        await requestSignOtp(contract.id);
        try {
          await DeviceStorage.setItemAsync(signOtpStorageKey(userId, contract.id), String(Date.now()));
        } catch {
          // The backend still limits duplicate OTP requests if local storage fails.
        }
      }
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
      try {
        await DeviceStorage.deleteItemAsync(signOtpStorageKey(userId, otpModal.contract.id));
      } catch {
        // A stale timestamp expires automatically after the OTP validity window.
      }
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

  async function handleCreate() {
    if (actionLock.current) return;
    actionLock.current = true; setCreating(true); setActionError("");
    try { await createContract(bookingId); await load(); onChanged?.(); }
    catch (e) { setActionError(getApiErrorMessage(e, "Không tạo được hợp đồng.")); }
    finally { actionLock.current = false; setCreating(false); }
  }
  async function handleExtend() {
    if (!extendTarget || actionLock.current) return;
    const count = Number(days);
    if (!/^\d+$/.test(days.trim()) || !Number.isInteger(count) || count < 1 || count > 90) { setActionError("Số ngày gia hạn phải từ 1 đến 90."); return; }
    actionLock.current = true; setExtending(true); setActionError("");
    try {
      const updated = await extendContract(extendTarget.id, count);
      setExtendTarget(null); await load(); onChanged?.();
      Alert.alert("Đã gia hạn", `Đã tạo hợp đồng v${updated.version}. Hai bên cần ký lại bằng OTP và thanh toán cọc bổ sung nếu có.`);
    } catch (e) { setActionError(getApiErrorMessage(e, "Không thể gia hạn. Vui lòng kiểm tra lịch xe và trạng thái hợp đồng.")); }
    finally { actionLock.current = false; setExtending(false); }
  }
  async function handleDownload(contract: ContractSummary, verified = false) {
    if (actionLock.current) return;
    actionLock.current = true; setFileBusy(true); setActionError("");
    try { await downloadContractPdf(contract); }
    catch (e) {
      if (!verified) { setPinPurpose("download"); setPinContract(contract); }
      else setActionError(getApiErrorMessage(e, "Không tải được PDF. Vui lòng thử lại."));
    } finally { actionLock.current = false; setFileBusy(false); }
  }
  useEffect(() => {
    let active = true;
    setAudit([]);
    if (content) void getContractAudit(content.id).then(items => { if (active) setAudit(items); }).catch(() => {});
    return () => { active = false; };
  }, [content]);
  const hasLive = contracts.some(c => ["Draft", "PendingSigning", "Overdue", "Active"].includes(c.status));
  const canCreate = canManage && ["Approved", "DepositPaid", "Confirmed"].includes(bookingStatus ?? "") && !hasLive && !loadError;

  const contentContract = content ? contracts.find((c) => c.id === content.id) ?? null : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hợp đồng ({contracts.length})</Text>
      {loadError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{loadError}</Text> : null}
      {actionError && !extendTarget ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{actionError}</Text> : null}
      {canCreate ? <BookingButton title="Tạo hợp đồng" busy={creating} onPress={() => void handleCreate()} /> : null}
      {loading ? (
        <ActivityIndicator color={theme.brand} />
      ) : contracts.length === 0 ? (
        <Text style={styles.muted}>Chưa có hợp đồng. Hệ thống thường tự tạo lúc duyệt booking.</Text>
      ) : (
        contracts.map((c) => {
          const signable = canSignContract(c, userId);
          return (
            <View key={c.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.version}>
                  v{c.version} · {c.contractNumber}
                </Text>
                <Text style={styles.muted}>
                  {CONTRACT_STATUS_LABELS[c.status] ?? c.status} ·{" "}
                  {userId === c.ownerId
                    ? c.ownerSignStatus === "Signed"
                      ? "bạn đã ký"
                      : "bạn chưa ký"
                    : c.customerSignStatus === "Signed"
                      ? "bạn đã ký"
                      : "bạn chưa ký"}
                </Text>
              </View>
              <View style={styles.actions}>
                {(isParty(c, userId) || canManage) && (
                  <Pressable onPress={() => handleView(c)} style={styles.smallButton}>
                    <Text style={styles.smallText}>Xem</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Tải PDF hợp đồng v${c.version}`} onPress={() => void handleDownload(c)} disabled={fileBusy} style={styles.smallButton}><Text style={styles.smallText}>Tải PDF</Text></Pressable>
                {canManage && c.id === contracts[contracts.length - 1]?.id && ["Active", "Overdue"].includes(c.status) ?
                  <Pressable accessibilityRole="button" accessibilityLabel="Gia hạn hợp đồng" onPress={() => { setActionError(""); setDays("1"); setExtendTarget(c); }} style={styles.smallButton}><Text style={styles.smallText}>Gia hạn</Text></Pressable> : null}
                {signable && (
                  <Pressable
                    onPress={() => handleSign(c)}
                    disabled={signingId !== null}
                    style={[styles.smallButton, styles.signButton, signingId !== null && styles.disabled]}
                  >
                    {signingId === c.id ? (
                      <ActivityIndicator size="small" color={theme.onBrand} />
                    ) : (
                      <Text style={[styles.smallText, styles.signText]}>Ký</Text>
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
                      <Text style={[styles.smallText, styles.signText]}>Gửi ký</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}

      <Modal visible={extendTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!extending) setExtendTarget(null); }}>
        <View style={styles.backdrop}><View style={styles.modal}>
          <Text style={styles.cardTitle}>Gia hạn hợp đồng</Text>
          <Text style={styles.muted}>Tạo phiên bản mới với ngày trả xe được kéo dài. Hai bên phải ký lại bằng OTP; cọc bổ sung được tính theo hợp đồng mới. Hợp đồng cũ tiếp tục hiệu lực nếu yêu cầu hết hạn.</Text>
          <BookingField label="Số ngày gia hạn" numeric value={days} onChangeText={setDays} editable={!extending} />
          {actionError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{actionError}</Text> : null}
          <BookingButton title="Xác nhận gia hạn" busy={extending} onPress={() => void handleExtend()} />
          <BookingButton secondary title="Đóng gia hạn" disabled={extending} onPress={() => setExtendTarget(null)} />
        </View></View>
      </Modal>
      <Modal visible={otpModal !== null} transparent animationType="fade" onRequestClose={() => setOtpModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>Ký hợp đồng</Text>
            <Text style={styles.muted}>Mã OTP ký đã gửi đến email của bạn, hiệu lực 10 phút.</Text>
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
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={handleOtpConfirm} disabled={otpBusy} style={[styles.primaryButton, otpBusy && styles.disabled]}>
                {otpBusy ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>Xác nhận</Text>
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
            const target = pinContract;
            setPinContract(null);
            if (pinPurpose === "download") void handleDownload(target, true);
            else setContent(detail);
            void load();
          }}
        />
      )}

      <Modal visible={content !== null} animationType="slide" onRequestClose={() => setContent(null)}>
        <View style={styles.contractPage}>
          <View style={styles.contractPageHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng hợp đồng" onPress={() => setContent(null)} style={styles.ghostButton}>
              <Text style={styles.ghostText}>‹ Quay lại</Text>
            </Pressable>
            <Text numberOfLines={1} style={[styles.cardTitle, { flex: 1, marginBottom: 0 }]}>Hợp đồng</Text>
          </View>
          <Text style={styles.contractNumber}>
              Hợp đồng {content?.contractNumber} · v{content?.version}
          </Text>
          <ScrollView style={styles.contractDocumentScroll} contentContainerStyle={styles.contractDocumentContent}>
              {content ? <ContractDocument content={content} /> : null}
              {audit.length ? <View style={{ gap: 6 }}><Text style={styles.cardTitle}>Lịch sử hợp đồng</Text>{audit.map((entry, i) => <Text key={i} style={styles.muted}>{formatDateTime(entry.timestamp)} · {entry.actorName || entry.actorRole || "Hệ thống"} · {entry.action}{entry.note ? ` · ${entry.note}` : ""}</Text>)}</View> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              {contentContract ? <Pressable accessibilityRole="button" onPress={() => void handleDownload(contentContract)} disabled={fileBusy} style={styles.ghostButton}><Text style={styles.ghostText}>Tải PDF</Text></Pressable> : null}
              {contentContract && canSignContract(contentContract, userId) ? (
                <Pressable
                  onPress={() => {
                    setContent(null);
                    void handleSign(contentContract);
                  }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryText}>Ký hợp đồng</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setContent(null)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
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
      flexDirection: "column",
      alignItems: "stretch",
      gap: 8,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    info: { gap: 2 },
    version: { color: theme.text, fontSize: 14, fontWeight: "700" },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    smallButton: {
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 48,
      minHeight: 44,
      justifyContent: "center",
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
    contractPage: { flex: 1, backgroundColor: theme.background, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20 },
    contractPageHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    contractNumber: { color: theme.text, fontSize: 16, fontWeight: "800", paddingVertical: 14 },
    contractDocumentScroll: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    contractDocumentContent: { padding: 16 },
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
