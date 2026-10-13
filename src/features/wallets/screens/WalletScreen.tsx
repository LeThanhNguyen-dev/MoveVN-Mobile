import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  cancelWithdrawal,
  createWithdrawal,
  getBankAccountDetails,
  getMyTransactions,
  getMyWallet,
  getMyWithdrawals,
  requestBankAccountOtp,
  verifyBankAccountOtp,
} from "@/features/wallets/services/walletService";
import type {
  OwnerBankDetailsDto,
  WalletDto,
  WalletTransactionDto,
  WithdrawalRequestDto,
} from "@/features/wallets/types";
import { VIETNAM_BANKS } from "@/features/wallets/data/banks";
import {
  checkPaymentStatus,
  createTopUpPaymentLink,
} from "@/features/payments/services/paymentService";
import PaymentWebViewModal from "@/features/payments/components/PaymentWebViewModal";
import { formatDateTime, formatMoney, txTypeLabel, withdrawalStatusLabel } from "@/features/wallets/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

const TOPUP_PRESETS = [50_000, 100_000, 200_000, 500_000, 1_000_000];
const TX_PAGE_SIZE = 15;

export default function WalletScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestDto[]>([]);
  const [bank, setBank] = useState<OwnerBankDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankStep, setBankStep] = useState<"info" | "otp">("info");
  const [bankName, setBankName] = useState("");
  const [bankBin, setBankBin] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankOtp, setBankOtp] = useState("");
  const [paySheet, setPaySheet] = useState<{ checkoutUrl: string; orderCode: number } | null>(null);
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const [w, tx, wd, bankInfo] = await Promise.all([
        getMyWallet(),
        getMyTransactions({ page: 1, pageSize: TX_PAGE_SIZE }),
        getMyWithdrawals({ page: 1, pageSize: 10 }),
        getBankAccountDetails().catch(() => null),
      ]);
      setWallet(w);
      setTransactions(tx.items);
      setTxPage(tx.page);
      setTxTotal(tx.totalCount);
      setWithdrawals(wd.items);
      setBank(bankInfo);
    } catch (err) {
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được ví."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  function pollTopUp(orderCode: number, attempt = 1) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await checkPaymentStatus(orderCode);
        if (res.isConfirmed) {
          setPendingOrderCode(null);
          Alert.alert("Thành công", "Đã nạp tiền vào ví.");
          await reload();
          return;
        }
        if (["Cancelled", "Expired", "Failed"].includes(res.status)) {
          setPendingOrderCode(null);
          Alert.alert("Thông báo", res.message || "Giao dịch đã kết thúc.");
          await reload();
          return;
        }
      } catch {
        // Thử lại.
      }
      if (attempt < 10) {
        pollTopUp(orderCode, attempt + 1);
      } else {
        setPendingOrderCode(null);
        Alert.alert("Hết thời gian chờ", "Mở lại màn ví để kiểm tra số dư.");
        await reload();
      }
    }, 3000);
  }

  useEffect(() => {
    if (pendingOrderCode == null) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") pollTopUp(pendingOrderCode);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderCode]);

  async function handleTopUp() {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Số tiền chưa đúng", "Vui lòng nhập số tiền nạp (đồng).");
      return;
    }
    if (busy) return;
    setBusy("topup");
    try {
      const link = await createTopUpPaymentLink(Math.round(amount));
      setTopUpOpen(false);
      setTopUpAmount("");
      setPaySheet({ checkoutUrl: link.checkoutUrl, orderCode: link.orderCode });
      setPendingOrderCode(link.orderCode);
      pollTopUp(link.orderCode);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không tạo được link nạp tiền."));
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Số tiền chưa đúng", "Vui lòng nhập số tiền rút (đồng).");
      return;
    }
    if (!bank?.bankAccountNumber) {
      Alert.alert("Chưa có tài khoản nhận", "Hãy thiết lập tài khoản ngân hàng trước khi rút.");
      return;
    }
    if (busy) return;
    setBusy("withdraw");
    try {
      await createWithdrawal(Math.round(amount));
      setWithdrawOpen(false);
      setWithdrawAmount("");
      Alert.alert("Thành công", "Đã tạo yêu cầu rút tiền. Nhân viên duyệt xong tiền sẽ về tài khoản.");
      await reload();
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không tạo được yêu cầu rút tiền."));
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelWithdrawal(id: number) {
    Alert.alert("Hủy yêu cầu", "Tiền đang giữ sẽ hoàn lại ví ngay.", [
      { text: "Giữ lại", style: "cancel" },
      {
        text: "Xác nhận hủy",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await cancelWithdrawal(id);
              await reload();
            } catch (err) {
              Alert.alert("Thất bại", getApiErrorMessage(err, "Không hủy được yêu cầu."));
            }
          })();
        },
      },
    ]);
  }

  function openBankSetup() {
    setBankName(bank?.bankName ?? "");
    setBankBin(bank?.bankBin ?? "");
    setAccountNumber(bank?.bankAccountNumber ?? "");
    setHolderName(bank?.bankAccountHolderName ?? "");
    setBankOtp("");
    setBankStep("info");
    setBankOpen(true);
  }

  async function handleRequestBankOtp() {
    if (!bankName.trim() || !accountNumber.trim() || !holderName.trim()) {
      Alert.alert("Thiếu thông tin", "Nhập đủ ngân hàng, số tài khoản và chủ tài khoản.");
      return;
    }
    if (busy) return;
    setBusy("bankOtp");
    try {
      await requestBankAccountOtp();
      setBankStep("otp");
      Alert.alert("Đã gửi", "Mã OTP đã gửi đến email của bạn.");
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không gửi được mã OTP."));
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveBank() {
    if (bankOtp.trim().length < 6) {
      Alert.alert("Thiếu mã", "Vui lòng nhập đủ mã OTP.");
      return;
    }
    if (busy) return;
    setBusy("bankSave");
    try {
      const picked = VIETNAM_BANKS.find((b) => b.name === bankName.trim());
      await verifyBankAccountOtp({
        otp: bankOtp.trim(),
        bankAccountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
        bankAccountHolderName: holderName.trim(),
        bankBin: bankBin || picked?.bin,
      });
      setBankOpen(false);
      Alert.alert("Thành công", "Đã lưu tài khoản ngân hàng.");
      await reload();
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không lưu được tài khoản."));
    } finally {
      setBusy(null);
    }
  }

  async function loadMoreTx() {
    if (loadingMore || transactions.length >= txTotal) return;
    setLoadingMore(true);
    try {
      const res = await getMyTransactions({ page: txPage + 1, pageSize: TX_PAGE_SIZE });
      setTransactions((prev) => [...prev, ...res.items.filter((t) => !prev.some((p) => p.id === t.id))]);
      setTxPage(res.page);
      setTxTotal(res.totalCount);
    } catch {
      // Bỏ qua lỗi tải thêm.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Ví của tôi</Text>
        <View style={styles.iconButton} />
      </View>
      {loading || !wallet ? (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.brand} /> : <Text style={styles.muted}>Không tải được ví.</Text>}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
            <Text style={styles.balance}>{formatMoney(wallet.balance)}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={() => setTopUpOpen(true)} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Nạp tiền</Text>
              </Pressable>
              <Pressable onPress={() => setWithdrawOpen(true)} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Rút tiền</Text>
              </Pressable>
            </View>
            {pendingOrderCode != null && (
              <Text style={styles.muted}>Đang chờ xác nhận nạp tiền #{pendingOrderCode}...</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tài khoản nhận tiền</Text>
            {bank?.bankAccountNumber ? (
              <>
                <Text style={styles.bankLine}>
                  {bank.bankName} · {bank.bankAccountNumber}
                </Text>
                <Text style={styles.muted}>{bank.bankAccountHolderName}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Chưa thiết lập — cần có để rút tiền.</Text>
            )}
            <Pressable onPress={openBankSetup} style={styles.linkButton}>
              <Text style={styles.linkText}>{bank?.bankAccountNumber ? "Cập nhật ngân hàng" : "Thiết lập ngay"}</Text>
            </Pressable>
          </View>

          {withdrawals.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Yêu cầu rút tiền</Text>
              {withdrawals.map((w) => (
                <View key={w.id} style={styles.withdrawRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.withdrawAmount}>{formatMoney(w.amount)}</Text>
                    <Text style={styles.muted}>
                      {withdrawalStatusLabel(w.status)} · {w.bankName} {w.bankAccountNumber}
                    </Text>
                    {w.processNote ? <Text style={styles.muted}>{w.processNote}</Text> : null}
                  </View>
                  {(w.status === "Pending" || (w.status === "Approved" && !w.externalTransactionRef)) && (
                    <Pressable onPress={() => handleCancelWithdrawal(w.id)} style={styles.smallDanger}>
                      <Text style={styles.smallDangerText}>Hủy</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lịch sử giao dịch</Text>
            {transactions.length === 0 && <Text style={styles.muted}>Chưa có giao dịch nào.</Text>}
            {transactions.map((t) => (
              <View key={t.id} style={styles.txRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.txTitle}>{txTypeLabel(t.type)}</Text>
                  {t.note ? (
                    <Text numberOfLines={2} style={styles.muted}>
                      {t.note}
                    </Text>
                  ) : null}
                  <Text style={styles.txTime}>{formatDateTime(t.createdAt)}</Text>
                </View>
                <Text style={[styles.txAmount, t.amount < 0 ? styles.txOut : styles.txIn]}>
                  {t.amount < 0 ? "−" : "+"}
                  {formatMoney(Math.abs(t.amount))}
                </Text>
              </View>
            ))}
            {transactions.length < txTotal && (
              <Pressable onPress={loadMoreTx} disabled={loadingMore} style={styles.linkButton}>
                <Text style={styles.linkText}>{loadingMore ? "Đang tải..." : `Xem thêm (${txTotal - transactions.length})`}</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={topUpOpen} transparent animationType="fade" onRequestClose={() => setTopUpOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>Nạp tiền vào ví</Text>
            <View style={styles.presets}>
              {TOPUP_PRESETS.map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setTopUpAmount(String(amt))}
                  style={[styles.preset, topUpAmount === String(amt) && styles.presetActive]}
                >
                  <Text style={[styles.presetText, topUpAmount === String(amt) && styles.presetTextActive]}>
                    {formatMoney(amt)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={topUpAmount}
              onChangeText={(v) => setTopUpAmount(v.replace(/[^0-9]/g, ""))}
              placeholder="Hoặc nhập số tiền (đồng)"
              placeholderTextColor={theme.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setTopUpOpen(false)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={handleTopUp} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                {busy === "topup" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>Thanh toán PayOS</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={withdrawOpen} transparent animationType="fade" onRequestClose={() => setWithdrawOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>Rút tiền</Text>
            <Text style={styles.muted}>
              Về: {bank?.bankName ?? "-"} · {bank?.bankAccountNumber ?? "chưa thiết lập"}
            </Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={(v) => setWithdrawAmount(v.replace(/[^0-9]/g, ""))}
              placeholder="Số tiền rút (đồng)"
              placeholderTextColor={theme.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setWithdrawOpen(false)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={handleWithdraw} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                {busy === "withdraw" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>Tạo yêu cầu</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bankOpen} transparent animationType="fade" onRequestClose={() => setBankOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.tallModal]}>
            <Text style={styles.cardTitle}>Tài khoản ngân hàng</Text>
            {bankStep === "info" ? (
              <>
                <Text style={styles.fieldLabel}>Ngân hàng</Text>
                <ScrollView style={styles.bankList} nestedScrollEnabled>
                  {VIETNAM_BANKS.map((b) => (
                    <Pressable
                      key={b.code}
                      onPress={() => {
                        setBankName(b.name);
                        setBankBin(b.bin);
                      }}
                      style={[styles.bankRow, bankName === b.name && styles.bankRowActive]}
                    >
                      <Text style={[styles.bankText, bankName === b.name && styles.bankTextActive]}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.fieldLabel}>Số tài khoản</Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ""))}
                  placeholder="VD: 0123456789"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Chủ tài khoản</Text>
                <TextInput
                  value={holderName}
                  onChangeText={setHolderName}
                  placeholder="NGUYEN VAN A"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="characters"
                  style={styles.input}
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setBankOpen(false)} style={styles.ghostButton}>
                    <Text style={styles.ghostText}>Đóng</Text>
                  </Pressable>
                  <Pressable onPress={handleRequestBankOtp} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                    {busy === "bankOtp" ? (
                      <ActivityIndicator color={theme.onBrand} />
                    ) : (
                      <Text style={styles.primaryText}>Gửi mã OTP</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.muted}>Mã OTP đã gửi đến email của bạn.</Text>
                <TextInput
                  value={bankOtp}
                  onChangeText={setBankOtp}
                  placeholder="6 chữ số OTP"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.input}
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setBankStep("info")} style={styles.ghostButton}>
                    <Text style={styles.ghostText}>Sửa lại</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveBank} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                    {busy === "bankSave" ? (
                      <ActivityIndicator color={theme.onBrand} />
                    ) : (
                      <Text style={styles.primaryText}>Xác nhận</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <PaymentWebViewModal
        checkoutUrl={paySheet?.checkoutUrl ?? null}
        onClose={() => {
          setPaySheet(null);
          void reload();
        }}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { color: theme.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    body: { padding: 16, gap: 12, paddingBottom: 32 },
    muted: { color: theme.muted, fontSize: 13 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 2 },
    balanceCard: {
      backgroundColor: theme.brand,
      borderRadius: 14,
      padding: 18,
      gap: 8,
    },
    balanceLabel: { color: theme.onBrand, fontSize: 13, opacity: 0.85 },
    balance: { color: theme.onBrand, fontSize: 30, fontWeight: "800" },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 11,
      minWidth: 110,
      alignItems: "center",
      flex: 1,
    },
    primaryText: { color: theme.onBrand, fontWeight: "800" },
    secondaryButton: {
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 18,
      paddingVertical: 11,
      flex: 1,
      alignItems: "center",
    },
    secondaryText: { color: theme.onBrand, fontWeight: "800" },
    disabled: { opacity: 0.6 },
    bankLine: { color: theme.text, fontSize: 14, fontWeight: "700" },
    linkButton: { paddingVertical: 6, alignSelf: "flex-start" },
    linkText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    withdrawRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingVertical: 8,
    },
    flexOne: { flex: 1, gap: 2 },
    withdrawAmount: { color: theme.text, fontSize: 14, fontWeight: "800" },
    smallDanger: {
      borderRadius: 8,
      backgroundColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    smallDangerText: { color: theme.danger, fontSize: 12, fontWeight: "800" },
    txRow: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    txTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
    txTime: { color: theme.placeholder, fontSize: 11 },
    txAmount: { fontSize: 14, fontWeight: "800" },
    txIn: { color: "#059669" },
    txOut: { color: theme.text },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    tallModal: { maxHeight: "85%" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    fieldLabel: { color: theme.text, fontSize: 13, fontWeight: "700" },
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
    presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    preset: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    presetActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    presetText: { color: theme.text, fontSize: 12, fontWeight: "700" },
    presetTextActive: { color: theme.brand },
    bankList: { maxHeight: 220 },
    bankRow: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
      marginBottom: 4,
    },
    bankRowActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    bankText: { color: theme.text, fontSize: 14 },
    bankTextActive: { fontWeight: "800", color: theme.brand },
  });
