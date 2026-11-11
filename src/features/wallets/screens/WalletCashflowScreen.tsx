import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { formatMoney, withdrawalStatusLabel } from "@/features/wallets/utils/format";
import WithdrawalRow from "@/features/wallets/components/WithdrawalRow";
import WalletPinUnlockModal from "@/features/wallets/components/WalletPinUnlockModal";
import type { UseWalletPinGateResult } from "@/features/wallets/hooks/useWalletPinGate";
import type { WalletState } from "@/features/wallets/hooks/useWallet";
import {
  TOPUP_MAX_AMOUNT,
  TOPUP_MIN_AMOUNT,
  WITHDRAW_MAX_AMOUNT,
  WITHDRAW_MIN_AMOUNT,
} from "@/features/wallets/hooks/useWallet";

const TOPUP_PRESETS = [50_000, 100_000, 200_000, 500_000, 1_000_000];

export type CashflowPane = "topup" | "withdraw";

export default function WalletCashflowScreen({
  state,
  pinGate,
  initialPane,
  onNeedBank,
}: {
  state: WalletState;
  pinGate: UseWalletPinGateResult;
  initialPane: CashflowPane;
  onNeedBank: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const [pane, setPane] = useState<CashflowPane>(initialPane);
  // Popup PIN xác nhận mỗi lần rút (kể cả vừa mở khóa xem số dư).
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Cho phép Home nhảy sang tab này với pane Nạp/Rút tương ứng.
  useEffect(() => {
    setPane(initialPane);
  }, [initialPane]);

  const {
    wallet,
    bank,
    busy,
    topUpAmount,
    setTopUpAmount,
    withdrawAmount,
    setWithdrawAmount,
    withdrawals,
    activeWithdrawal,
    handleTopUp,
    handleWithdraw,
    handleCancelWithdrawal,
  } = state;

  const withdrawAmountNum = Number(withdrawAmount);
  const balance = wallet?.balance ?? 0;
  const canWithdraw =
    busy === null &&
    !!bank?.bankAccountNumber &&
    !activeWithdrawal &&
    Number.isFinite(withdrawAmountNum) &&
    withdrawAmountNum >= WITHDRAW_MIN_AMOUNT &&
    withdrawAmountNum <= WITHDRAW_MAX_AMOUNT &&
    withdrawAmountNum <= balance;

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.segment}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: pane === "topup" }}
          onPress={() => setPane("topup")}
          style={[styles.segButton, pane === "topup" && styles.segActive]}
        >
          <AppText style={[styles.segText, pane === "topup" && styles.segTextActive]}>
            {t("accountWallet:topUp")}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: pane === "withdraw" }}
          onPress={() => setPane("withdraw")}
          style={[styles.segButton, pane === "withdraw" && styles.segActive]}
        >
          <AppText style={[styles.segText, pane === "withdraw" && styles.segTextActive]}>
            {t("accountWallet:withdraw")}
          </AppText>
        </Pressable>
      </View>

      {pane === "topup" ? (
        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>{t("accountWallet:topUpModal.title")}</AppText>
          <AppText style={styles.muted}>{t("mobile:wallet.cashflow.topUpDesc")}</AppText>
          <View style={styles.presets}>
            {TOPUP_PRESETS.map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setTopUpAmount(String(amt))}
                style={[styles.preset, topUpAmount === String(amt) && styles.presetActive]}
              >
                <AppText style={[styles.presetText, topUpAmount === String(amt) && styles.presetTextActive]}>
                  {formatMoney(amt)}
                </AppText>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={topUpAmount}
            onChangeText={(v) => setTopUpAmount(v.replace(/[^0-9]/g, ""))}
            placeholder={t("mobile:wallet.cashflow.topUpPlaceholder")}
            placeholderTextColor={theme.placeholder}
            keyboardType="number-pad"
            style={styles.input}
          />
          <AppText style={styles.hint}>
            {t("mobile:wallet.cashflow.topUpHint", {
              min: formatMoney(TOPUP_MIN_AMOUNT),
              max: formatMoney(TOPUP_MAX_AMOUNT),
            })}
          </AppText>
          <Pressable
            onPress={() => void handleTopUp()}
            disabled={busy !== null}
            style={[styles.primaryButton, busy !== null && styles.disabled]}
          >
            {busy === "topup" ? (
              <ActivityIndicator color={theme.onBrand} />
            ) : (
              <AppText style={styles.primaryText}>{t("mobile:wallet.cashflow.payWithPayOS")}</AppText>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>{t("mobile:wallet.cashflow.withdrawTitle")}</AppText>
          <AppText style={styles.balanceLine}>
            {t("accountWallet:withdrawModal.available")}{" "}
            <AppText style={styles.balanceValue}>{formatMoney(balance)}</AppText>
          </AppText>
          <AppText style={styles.muted}>
            {t("mobile:wallet.cashflow.toBank", {
              bank: bank?.bankName ?? "-",
              account: bank?.bankAccountNumber ?? t("mobile:wallet.cashflow.notSet"),
            })}
          </AppText>
          {!bank?.bankAccountNumber && (
            <Pressable onPress={onNeedBank} style={styles.linkButton}>
              <AppText style={styles.linkText}>{t("mobile:wallet.cashflow.setupBankLink")}</AppText>
            </Pressable>
          )}
          {activeWithdrawal && (
            <View style={styles.activeBanner}>
              <TriangleAlert color="#F59E0B" size={18} />
              <View style={styles.flexOne}>
                <AppText display style={styles.activeTitle}>
                  {t("mobile:wallet.cashflow.activeRequest", {
                    id: activeWithdrawal.id,
                    status: withdrawalStatusLabel(activeWithdrawal.status).toLowerCase(),
                  })}
                </AppText>
                <AppText style={styles.muted}>
                  {t("mobile:wallet.cashflow.activeRequestHint")}
                </AppText>
              </View>
            </View>
          )}
          <TextInput
            value={withdrawAmount}
            onChangeText={(v) => setWithdrawAmount(v.replace(/[^0-9]/g, ""))}
            placeholder={t("mobile:wallet.cashflow.withdrawPlaceholder")}
            placeholderTextColor={theme.placeholder}
            keyboardType="number-pad"
            editable={!activeWithdrawal}
            style={styles.input}
          />
          <View style={styles.withdrawMeta}>
            <AppText style={styles.hint}>
              {t("mobile:wallet.cashflow.withdrawHint", {
                min: formatMoney(WITHDRAW_MIN_AMOUNT),
                max: formatMoney(WITHDRAW_MAX_AMOUNT),
              })}
            </AppText>
            <Pressable
              onPress={() => setWithdrawAmount(String(balance))}
              disabled={activeWithdrawal != null}
              style={styles.linkButton}
            >
              <AppText style={styles.linkText}>{t("mobile:wallet.cashflow.withdrawMax")}</AppText>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setConfirmVisible(true)}
            disabled={!canWithdraw}
            style={[styles.primaryButton, !canWithdraw && styles.disabled]}
          >
            {busy === "withdraw" ? (
              <ActivityIndicator color={theme.onBrand} />
            ) : (
              <AppText style={styles.primaryText}>{t("mobile:wallet.cashflow.withdrawSubmit")}</AppText>
            )}
          </Pressable>
        </View>
      )}

      {pane === "withdraw" && withdrawals.length > 0 && (
        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>{t("mobile:wallet.cashflow.pendingTitle")}</AppText>
          {withdrawals.map((w) => (
            <WithdrawalRow key={w.id} w={w} onCancel={handleCancelWithdrawal} />
          ))}
        </View>
      )}

      <WalletPinUnlockModal
        gate={pinGate}
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onUnlocked={() => {
          setConfirmVisible(false);
          void handleWithdraw();
        }}
        verifyDescription={t("mobile:wallet.pin.verifyWithdraw")}
      />
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { padding: 16, gap: 12, paddingBottom: 24 },
    muted: { color: theme.muted, fontSize: 13 },
    hint: { color: theme.muted, fontSize: 12 },
    flexOne: { flex: 1 },
    balanceLine: { color: theme.text, fontSize: 13.5, fontWeight: "600" },
    balanceValue: { fontWeight: "800", color: theme.brand },
    activeBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.45)",
      borderRadius: 12,
      padding: 10,
    },
    activeTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    withdrawMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segButton: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: "center" },
    segActive: { backgroundColor: theme.surface, shadowColor: theme.shadow, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
    segText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    segTextActive: { color: theme.brand, fontWeight: "800" },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
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
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingVertical: 13,
      alignItems: "center",
    },
    primaryText: { color: theme.onBrand, fontWeight: "800", fontSize: 14 },
    disabled: { opacity: 0.6 },
    linkButton: { paddingVertical: 4, alignSelf: "flex-start" },
    linkText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
