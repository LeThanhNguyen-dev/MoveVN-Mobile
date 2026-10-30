import { BookingButton, BookingField } from "@/features/booking/components/BookingControls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FileText } from "lucide-react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  getContractsByBooking,
  createContract, extendContract, downloadContractPdf,
  sendForSigning,
} from "@/features/contracts/contractService";
import ContractPinFlow from "@/features/contracts/components/ContractPinFlow";
import ContractSignDialog from "@/features/contracts/components/ContractSignDialog";
import {
  DetailButton,
  DetailCard,
  DetailPill,
  DetailSectionHeader,
} from "@/features/booking/components/detail/BookingDetailUI";
import {
  detailFont as font,
  useDetailTheme,
  type DetailPalette,
} from "@/features/vehicles/components/detail/detailTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import {
  CONTRACT_STATUS_LABELS,
  type ContractSummary,
} from "@/features/contracts/types";
import { canSignContract, contractTone, isParty, signLabel } from "@/features/contracts/contractUi";
import { getApiErrorMessage } from "@/services/apiClient";

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
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(p), [p]);
  const navigation = useNavigation<{
    navigate: (screen: "ContractDetail", params: { contract: ContractSummary }) => void;
  }>();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [signTarget, setSignTarget] = useState<ContractSummary | null>(null);
  const [pinContract, setPinContract] = useState<ContractSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extendTarget, setExtendTarget] = useState<ContractSummary | null>(null);
  const [days, setDays] = useState("1");
  const [extending, setExtending] = useState(false);
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
    const timer = setInterval(() => { if (!actionLock.current) void load(); }, 30000);
    const sub = AppState.addEventListener("change", state => { if (state === "active" && !actionLock.current) void load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!actionLock.current) void load();
    }, [load, bookingStatus]),
  );

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

  function handleView(contract: ContractSummary) {
    // Nội dung mở ở trang riêng; màn đó tự xin quyền bằng PIN nếu chưa có grant.
    navigation.navigate("ContractDetail", { contract });
    void load();
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
      if (!verified) setPinContract(contract);
      else setActionError(getApiErrorMessage(e, "Không tải được PDF. Vui lòng thử lại."));
    } finally { actionLock.current = false; setFileBusy(false); }
  }
  const hasLive = contracts.some(c => ["Draft", "PendingSigning", "Overdue", "Active"].includes(c.status));
  const canCreate = canManage && ["Approved", "DepositPaid", "Confirmed"].includes(bookingStatus ?? "") && !hasLive && !loadError;

  const latest = contracts.length > 0 ? contracts[contracts.length - 1] : null;
  const latestStatusLabel = latest ? CONTRACT_STATUS_LABELS[latest.status] ?? latest.status : "";
  const cardSubtitle = loading
    ? "Đang tải hợp đồng"
    : !latest
      ? "Chưa có hợp đồng cho đơn thuê này"
      : `${contracts.length} phiên bản · ${latestStatusLabel}`;

  return (
    <DetailCard>
      <DetailSectionHeader
        icon={FileText}
        title="Hợp đồng thuê xe"
        subtitle={cardSubtitle}
        tone={latest?.status === "Active" ? "mint" : "brand"}
        right={latest ? <DetailPill label={`v${latest.version}`} tone={contractTone(latest.status)} /> : undefined}
      />
      {loadError ? <Text accessibilityRole="alert" style={{ color: p.danger }}>{loadError}</Text> : null}
      {actionError && !extendTarget ? <Text accessibilityRole="alert" style={{ color: p.danger }}>{actionError}</Text> : null}
      {canCreate ? <DetailButton label="Tạo hợp đồng" busy={creating} onPress={() => void handleCreate()} /> : null}
      {loading ? (
        <ActivityIndicator color={p.brand} />
      ) : contracts.length === 0 ? (
        <Text style={cardStyles.muted}>Chưa có hợp đồng. Hệ thống thường tự tạo lúc duyệt booking.</Text>
      ) : (
        contracts.map((c, index) => {
          const signable = canSignContract(c, userId);
          const customerSigned = c.customerSignStatus === "Signed";
          const ownerSigned = c.ownerSignStatus === "Signed";
          return (
            <View key={c.id} style={[cardStyles.contractRow, index > 0 && cardStyles.contractRowDivider]}>
              <View style={cardStyles.contractTop}>
                <Text numberOfLines={1} style={cardStyles.contractVersion}>
                  v{c.version} · {c.contractNumber}
                </Text>
                <DetailPill label={CONTRACT_STATUS_LABELS[c.status] ?? c.status} tone={contractTone(c.status)} />
              </View>
              <View style={cardStyles.partyRow}>
                <Text style={cardStyles.partyLabel}>Khách thuê{userId === c.customerId ? " (bạn)" : ""}</Text>
                <Text style={[cardStyles.partyValue, { color: customerSigned ? p.mint : p.faint }]}>
                  {signLabel(customerSigned, c.customerSignedAt)}
                </Text>
              </View>
              <View style={cardStyles.partyRow}>
                <Text style={cardStyles.partyLabel}>Chủ xe{userId === c.ownerId ? " (bạn)" : ""}</Text>
                <Text style={[cardStyles.partyValue, { color: ownerSigned ? p.mint : p.faint }]}>
                  {signLabel(ownerSigned, c.ownerSignedAt)}
                </Text>
              </View>
              <View style={cardStyles.actions}>
                {(isParty(c, userId) || canManage) && (
                  <Pressable onPress={() => handleView(c)} style={cardStyles.button}>
                    <Text style={cardStyles.buttonText}>Xem</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Tải PDF hợp đồng v${c.version}`} onPress={() => void handleDownload(c)} disabled={fileBusy} style={cardStyles.button}><Text style={cardStyles.buttonText}>Tải PDF</Text></Pressable>
                {canManage && c.id === contracts[contracts.length - 1]?.id && ["Active", "Overdue"].includes(c.status) ?
                  <Pressable accessibilityRole="button" accessibilityLabel="Gia hạn hợp đồng" onPress={() => { setActionError(""); setDays("1"); setExtendTarget(c); }} style={cardStyles.button}><Text style={cardStyles.buttonText}>Gia hạn</Text></Pressable> : null}
                {signable && (
                  <Pressable
                    onPress={() => setSignTarget(c)}
                    style={[cardStyles.button, cardStyles.primaryButton]}
                  >
                    <Text style={[cardStyles.buttonText, cardStyles.primaryButtonText]}>Ký</Text>
                  </Pressable>
                )}
                {canManage && c.status === "Draft" && !signable && (
                  <Pressable
                    onPress={() => handleSend(c)}
                    disabled={sendingId !== null}
                    style={[cardStyles.button, cardStyles.primaryButton, sendingId !== null && cardStyles.disabled]}
                  >
                    {sendingId === c.id ? (
                      <ActivityIndicator size="small" color={p.onBrand} />
                    ) : (
                      <Text style={[cardStyles.buttonText, cardStyles.primaryButtonText]}>Gửi ký</Text>
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
      <ContractSignDialog
        contract={signTarget}
        userId={userId}
        onClose={() => {
          setSignTarget(null);
          void load();
        }}
        onSigned={() => {
          setSignTarget(null);
          void load();
          onChanged?.();
        }}
      />

      {pinContract && (
        <ContractPinFlow
          contract={pinContract}
          userEmail={userEmail}
          onClose={() => setPinContract(null)}
          onVerified={() => {
            const target = pinContract;
            setPinContract(null);
            void handleDownload(target, true);
            void load();
          }}
        />
      )}
    </DetailCard>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
    muted: { color: theme.muted, fontSize: 13 },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
  });

const createCardStyles = (p: DetailPalette) =>
  StyleSheet.create({
    muted: { color: p.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 16 },
    contractRow: { gap: 8 },
    contractRowDivider: { borderTopWidth: 1, borderTopColor: p.line, paddingTop: 12 },
    contractTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    contractVersion: {
      flex: 1,
      color: p.ink,
      fontFamily: font.semibold,
      fontSize: 12.5,
      lineHeight: 17,
    },
    partyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    partyLabel: { color: p.muted, fontFamily: font.regular, fontSize: 11.5 },
    partyValue: { fontFamily: font.semibold, fontSize: 11.5, textAlign: "right" },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    button: {
      minHeight: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceAlt,
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: { color: p.ink, fontFamily: font.bold, fontSize: 11.5 },
    primaryButton: { backgroundColor: p.brand, borderColor: p.brand },
    primaryButtonText: { color: p.onBrand },
    disabled: { opacity: 0.5 },
  });
