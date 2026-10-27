import AppInput from "@/components/ui/AppInput";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Landmark,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import PinDigitInputs from "@/features/pin/components/PinDigitInputs";
import { VIETNAM_BANKS } from "@/features/wallets/data/banks";
import type { WalletState } from "@/features/wallets/hooks/useWallet";

const RESEND_COUNTDOWN_SECONDS = 60;

export default function WalletBankScreen({ state }: { state: WalletState }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankListOpen, setBankListOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const accountRef = useRef<TextInput | null>(null);
  const holderRef = useRef<TextInput | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    bank,
    busy,
    bankStep,
    setBankStep,
    bankName,
    setBankName,
    setBankBin,
    accountNumber,
    setAccountNumber,
    holderName,
    setHolderName,
    bankOtp,
    setBankOtp,
    openBankSetup,
    handleRequestBankOtp,
    handleSaveBank,
  } = state;

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const filteredBanks = VIETNAM_BANKS.filter((b) =>
    `${b.name} ${b.code}`.toLowerCase().includes(bankSearch.trim().toLowerCase())
  );

  // Bước OTP suy từ hook; còn lại gộp chung 1 màn: dropdown bank (prefill bank cũ) + inputs.
  const stkDigits = accountNumber.replace(/\D/g, "");
  const canSendOtp =
    bankName.trim().length > 0 && stkDigits.length >= 6 && holderName.trim().length >= 2 && busy === null;

  function startEdit() {
    openBankSetup();
    setBankSearch("");
    setBankListOpen(false);
    setCopied(false);
    setResendSeconds(0);
    setEditing(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }

  function cancelEdit() {
    setEditing(false);
    setBankSearch("");
    setBankListOpen(false);
  }

  async function save() {
    const ok = await handleSaveBank();
    if (ok) {
      setEditing(false);
      setResendSeconds(0);
    }
  }

  function scrollToEndSoon() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }

  async function copyAccountNumber() {
    if (!bank?.bankAccountNumber) return;
    await Clipboard.setStringAsync(bank.bankAccountNumber);
    setCopied(true);
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  async function resendOtp() {
    if (resendSeconds > 0 || busy !== null) return;
    await handleRequestBankOtp(() => setResendSeconds(RESEND_COUNTDOWN_SECONDS));
  }

  const body = (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
      automaticallyAdjustKeyboardInsets
    >
      {/* Đã liên kết + không sửa → thẻ gọn. */}
      {bank?.bankAccountNumber && !editing ? (
        <>
          <View style={styles.linkedCard}>
            <View style={styles.linkedTop}>
              <View style={styles.bigAvatar}>
                <AppText style={styles.bigAvatarText}>
                  {(bank.bankName ?? "N").trim().charAt(0).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.flexOne}>
                <AppText style={styles.linkedBankName}>{bank.bankName}</AppText>
                <AppText style={styles.linkedHolder}>{bank.bankAccountHolderName}</AppText>
              </View>
              <View style={styles.verifiedChip}>
                <BadgeCheck color={theme.success} size={14} />
                <AppText style={styles.verifiedText}>Đã xác thực</AppText>
              </View>
            </View>
            <View style={styles.accountBox}>
              <View style={styles.flexOne}>
                <AppText style={styles.accountLabel}>Số tài khoản</AppText>
                <AppText style={styles.accountNumber}>{bank.bankAccountNumber}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sao chép số tài khoản"
                onPress={() => void copyAccountNumber()}
                style={styles.copyButton}
              >
                {copied ? (
                  <Check color={theme.success} size={17} strokeWidth={2.5} />
                ) : (
                  <Copy color={theme.brand} size={17} strokeWidth={2.3} />
                )}
              </Pressable>
            </View>
            {copied ? <AppText style={styles.copiedHint}>Đã sao chép số tài khoản.</AppText> : null}
            <Pressable onPress={startEdit} style={styles.secondaryButton}>
              <Pencil color={theme.brand} size={15} strokeWidth={2.3} />
              <AppText style={styles.secondaryText}>Đổi tài khoản khác</AppText>
            </Pressable>
          </View>
          <AppText style={styles.hint}>
            Đổi tài khoản cần xác thực lại OTP qua email để bảo vệ tiền rút của bạn.
          </AppText>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.headRow}>
              <Landmark color={theme.brand} size={20} />
              <AppText display style={styles.cardTitle}>Tài khoản nhận tiền</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bankListOpen ? "Đóng danh sách ngân hàng" : "Mở danh sách ngân hàng"}
              onPress={() => setBankListOpen((v) => !v)}
              style={[styles.dropdownField, bankListOpen && styles.dropdownFieldOpen]}
            >
              {bankName ? (
                <AppText style={styles.dropdownValue}>{bankName}</AppText>
              ) : (
                <AppText style={styles.dropdownPlaceholder}>Chọn ngân hàng nhận tiền</AppText>
              )}
                {bankListOpen ? (
                  <ChevronUp color={theme.brand} size={19} />
                ) : (
                  <ChevronDown color={theme.muted} size={19} />
                )}
              </Pressable>
              {bankListOpen ? (
                <>
                  <View style={styles.searchBox}>
                    <Search color={theme.placeholder} size={17} />
                    <AppInput
                      value={bankSearch}
                      onChangeText={setBankSearch}
                      placeholder="Tìm Vietcombank, BIDV, MB..."
                      placeholderTextColor={theme.placeholder}
                      style={styles.searchInput}
                      returnKeyType="search"
                    />
                  </View>
                  <ScrollView style={styles.bankListDropdown} nestedScrollEnabled>
                    {filteredBanks.map((b) => (
                      <Pressable
                        key={b.code}
                        onPress={() => {
                          setBankName(b.name);
                          setBankBin(b.bin);
                          setBankListOpen(false);
                          setBankSearch("");
                        }}
                        style={styles.bankRow}
                      >
                        <View style={styles.bankAvatar}>
                          <AppText style={styles.bankAvatarText}>{b.code}</AppText>
                        </View>
                        <AppText style={styles.bankText}>{b.name}</AppText>
                        <ChevronRight color={theme.faint} size={18} />
                      </Pressable>
                    ))}
                    {filteredBanks.length === 0 && (
                      <AppText style={styles.muted}>Không tìm thấy ngân hàng phù hợp.</AppText>
                    )}
                  </ScrollView>
                </>
              ) : null}
              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Số tài khoản</AppText>
                <AppInput
                  ref={accountRef}
                  value={accountNumber}
                  onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ""))}
                  onFocus={scrollToEndSoon}
                  placeholder="VD: 0123456789"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                  maxLength={19}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => holderRef.current?.focus()}
                  style={styles.input}
                />
                <AppText style={styles.fieldHint}>Từ 6–19 chữ số, không dấu cách.</AppText>
              </View>

              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Chủ tài khoản</AppText>
                <AppInput
                  ref={holderRef}
                  value={holderName}
                  onChangeText={setHolderName}
                  onFocus={scrollToEndSoon}
                  placeholder="NGUYEN VAN A (viết hoa)"
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (canSendOtp) void handleRequestBankOtp();
                  }}
                  style={styles.input}
                />
                <AppText style={styles.fieldHint}>Nhập đúng tên in trên thẻ/tài khoản.</AppText>
              </View>

              <Pressable
                onPress={() => void handleRequestBankOtp()}
                disabled={!canSendOtp}
                style={[styles.primaryButton, !canSendOtp && styles.disabled]}
              >
                {busy === "bankOtp" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <AppText style={styles.primaryText}>Gửi mã OTP</AppText>
                )}
              </Pressable>
              {bank?.bankAccountNumber ? (
                <Pressable onPress={cancelEdit} style={styles.ghostButton}>
                  <AppText style={styles.ghostText}>Hủy thay đổi</AppText>
                </Pressable>
              ) : null}
            </View>

          {bankStep === "otp" ? (
            <View style={styles.card}>
              <View style={styles.headRow}>
                <ShieldCheck color={theme.brand} size={20} />
                <AppText display style={styles.cardTitle}>Xác thực OTP</AppText>
              </View>
              <AppText style={styles.muted}>
                Mã gồm 6 chữ số đã gửi đến email của bạn cho tài khoản{" "}
                <AppText style={styles.bold}>
                  {bankName} · ****{stkDigits.slice(-4)}
                </AppText>
                .
              </AppText>
              <PinDigitInputs
                autoFocus
                disabled={busy !== null}
                label="Mã OTP"
                value={bankOtp}
                onChange={setBankOtp}
                onComplete={() => void save()}
              />
              <Pressable
                onPress={() => void save()}
                disabled={busy !== null || bankOtp.trim().length < 6}
                style={[styles.primaryButton, (busy !== null || bankOtp.trim().length < 6) && styles.disabled]}
              >
                {busy === "bankSave" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <AppText style={styles.primaryText}>Xác nhận</AppText>
                )}
              </Pressable>
              <View style={styles.otpFooter}>
                <Pressable onPress={() => setBankStep("info")} style={styles.linkButton}>
                  <AppText style={styles.linkText}>Sửa lại thông tin</AppText>
                </Pressable>
                <Pressable onPress={() => void resendOtp()} disabled={resendSeconds > 0 || busy !== null}>
                  <AppText style={[styles.linkText, (resendSeconds > 0 || busy !== null) && styles.linkDisabled]}>
                    {resendSeconds > 0 ? `Gửi lại sau ${resendSeconds}s` : "Gửi lại mã"}
                  </AppText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    body: { padding: 16, gap: 12 },
    flexOne: { flex: 1 },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    bold: { fontWeight: "800", color: theme.text },
    hint: { color: theme.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 12 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    // Linked card
    linkedCard: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    linkedTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    bigAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    bigAvatarText: { color: theme.brand, fontSize: 20, fontWeight: "800" },
    linkedBankName: { color: theme.text, fontSize: 15, fontWeight: "800" },
    linkedHolder: { color: theme.muted, fontSize: 13 },
    verifiedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.successSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    verifiedText: { color: theme.success, fontSize: 11, fontWeight: "800" },
    accountBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    accountLabel: { color: theme.muted, fontSize: 11, fontWeight: "700" },
    accountNumber: { color: theme.text, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
    copyButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    copiedHint: { color: theme.success, fontSize: 12, fontWeight: "700" },
    secondaryButton: {
      flexDirection: "row",
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    secondaryText: { color: theme.brand, fontWeight: "800", fontSize: 14 },
    // Bank pick
    dropdownField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    dropdownFieldOpen: { borderColor: theme.brand },
    dropdownPlaceholder: { color: theme.placeholder, fontSize: 14, flex: 1 },
    dropdownValue: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    bankListDropdown: { maxHeight: 300 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 11, color: theme.text, fontSize: 14 },
    bankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
      backgroundColor: theme.surfaceAlt,
    },
    bankAvatar: {
      minWidth: 46,
      height: 40,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    bankAvatarText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    bankText: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "700" },
    // Form
    field: { gap: 6 },
    fieldLabel: { color: theme.text, fontSize: 13, fontWeight: "800" },
    fieldHint: { color: theme.placeholder, fontSize: 12 },
    input: {
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
    },
    primaryButton: {
      borderRadius: 12,
      backgroundColor: theme.brandSolid,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 2,
    },
    primaryText: { color: theme.onBrand, fontWeight: "800", fontSize: 14 },
    ghostButton: { paddingVertical: 10, alignItems: "center" },
    ghostText: { color: theme.muted, fontWeight: "700", fontSize: 13 },
    linkButton: { paddingVertical: 4 },
    linkText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    linkDisabled: { color: theme.placeholder },
    otpFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    disabled: { opacity: 0.55 },
  });
