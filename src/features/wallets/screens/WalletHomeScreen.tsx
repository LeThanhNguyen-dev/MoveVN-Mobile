import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, ChevronRight, Clock3, Landmark, Plus, TriangleAlert } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import BalanceCard from "@/features/wallets/components/BalanceCard";
import QuickActions from "@/features/wallets/components/QuickActions";
import TxRow from "@/features/wallets/components/TxRow";
import WalletPinUnlockModal from "@/features/wallets/components/WalletPinUnlockModal";
import type { UseWalletPinGateResult } from "@/features/wallets/hooks/useWalletPinGate";
import type { WalletState } from "@/features/wallets/hooks/useWallet";

export default function WalletHomeScreen({
  state,
  isOwner,
  pinGate,
  balanceHidden,
  onToggleHidden,
  onTopUp,
  onWithdraw,
  onGoHistory,
  onGoBank,
}: {
  state: WalletState;
  isOwner: boolean;
  pinGate: UseWalletPinGateResult;
  balanceHidden: boolean;
  onToggleHidden: () => void;
  onTopUp: () => void;
  onWithdraw: () => void;
  onGoHistory: () => void;
  onGoBank: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const { wallet, transactions, bank, loading, pendingOrderCode } = state;

  if (loading || !wallet) {
    return (
      <View style={styles.center}>
        {loading
          ? <ActivityIndicator color={theme.brand} />
          : <Text style={styles.muted}>Không tải được ví.</Text>}
      </View>
    );
  }

  const recent = transactions.slice(0, 5);
  const needBank = !bank?.bankAccountNumber;

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <BalanceCard
        balance={wallet.balance}
        totalEarned={wallet.totalEarned}
        totalSpent={wallet.totalSpent}
        hidden={balanceHidden}
        onToggleHidden={onToggleHidden}
        pendingOrderCode={pendingOrderCode}
        isOwner={isOwner}
        locked={!pinGate.unlocked}
        onUnlockPress={() => setPinModalVisible(true)}
      />
      <WalletPinUnlockModal
        gate={pinGate}
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
      />

      <QuickActions
        actions={
          isOwner
            ? [
              { key: "withdraw", label: "Rút tiền", icon: ArrowUpRight, onPress: onWithdraw },
              { key: "topup", label: "Nạp tiền", icon: Plus, onPress: onTopUp },
              { key: "history", label: "Lịch sử", icon: Clock3, onPress: onGoHistory },
              { key: "bank", label: "Ngân hàng", icon: Landmark, onPress: onGoBank },
            ]
            : [
              { key: "topup", label: "Nạp tiền", icon: Plus, onPress: onTopUp },
              { key: "withdraw", label: "Rút tiền", icon: ArrowUpRight, onPress: onWithdraw },
              { key: "history", label: "Lịch sử", icon: Clock3, onPress: onGoHistory },
              { key: "bank", label: "Ngân hàng", icon: Landmark, onPress: onGoBank },
            ]
        }
      />

      {needBank ? (
        <Pressable onPress={onGoBank} style={styles.warnBanner}>
          <TriangleAlert color={theme.brand} size={20} />
          <View style={styles.flexOne}>
            <Text style={styles.warnTitle}>Chưa liên kết ngân hàng</Text>
            <Text style={styles.warnSub}>Thiết lập để rút tiền về tài khoản.</Text>
          </View>
          <ChevronRight color={theme.brand} size={18} />
        </Pressable>
      ) : (
        <Pressable onPress={onGoBank} style={styles.bankCard}>
          <View style={styles.bankAvatar}>
            <Text style={styles.bankAvatarText}>
              {(bank?.bankName ?? "N").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.bankName} numberOfLines={1}>
              {bank?.bankName} · ****{(bank?.bankAccountNumber ?? "").slice(-4)}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>{bank?.bankAccountHolderName}</Text>
          </View>
          <ChevronRight color={theme.muted} size={18} />
        </Pressable>
      )}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Giao dịch gần đây</Text>
          <Pressable onPress={onGoHistory} style={styles.linkHit}>
            <Text style={styles.linkText}>Xem tất cả</Text>
            <ChevronRight color={theme.brand} size={15} />
          </Pressable>
        </View>
        {recent.length === 0 && (
          <Text style={styles.muted}>Chưa có giao dịch nào. Nạp tiền để bắt đầu.</Text>
        )}
        {recent.map((t) => (
          <TxRow key={t.id} tx={t} />
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { padding: 16, gap: 12, paddingBottom: 24 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    muted: { color: theme.muted, fontSize: 13 },
    flexOne: { flex: 1 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    linkHit: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4 },
    linkText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    warnBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      borderRadius: 14,
      padding: 13,
    },
    warnTitle: { color: theme.text, fontSize: 13.5, fontWeight: "800" },
    warnSub: { color: theme.muted, fontSize: 12 },
    bankCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 13,
    },
    bankAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    bankAvatarText: { color: theme.brand, fontSize: 16, fontWeight: "800" },
    bankName: { color: theme.text, fontSize: 13.5, fontWeight: "800" },
  });
