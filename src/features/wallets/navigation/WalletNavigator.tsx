import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import {
  Banknote,
  Clock3,
  Landmark,
  LayoutDashboard,
} from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import MobileBottomBar, { type MobileTabItem } from "@/navigation/MobileBottomBar";
import PaymentWebViewModal from "@/features/payments/components/PaymentWebViewModal";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useWallet } from "@/features/wallets/hooks/useWallet";
import { useWalletPinGate } from "@/features/wallets/hooks/useWalletPinGate";
import WalletHomeScreen from "@/features/wallets/screens/WalletHomeScreen";
import WalletHistoryScreen from "@/features/wallets/screens/WalletHistoryScreen";
import WalletCashflowScreen, { type CashflowPane } from "@/features/wallets/screens/WalletCashflowScreen";
import WalletBankScreen from "@/features/wallets/screens/WalletBankScreen";

export type WalletTabKey = "home" | "history" | "cashflow" | "bank";

export default function WalletNavigator({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const state = useWallet();
  // Mở khóa PIN chỉ giữ trong RAM của Navigator: thoát ví là khóa lại.
  const pinGate = useWalletPinGate();
  const activeRole = useAuthStore((s) => s.activeRole);
  const isOwner = activeRole === "Owner";

  const [activeTab, setActiveTab] = useState<WalletTabKey>("home");
  const [cashflowPane, setCashflowPane] = useState<CashflowPane>(isOwner ? "withdraw" : "topup");
  const [balanceHidden, setBalanceHidden] = useState(false);

  const tabs: MobileTabItem<WalletTabKey>[] = [
    { key: "home", label: "Tổng quan", icon: LayoutDashboard },
    { key: "history", label: "Lịch sử", icon: Clock3 },
    { key: "cashflow", label: isOwner ? "Rút tiền" : "Nạp tiền", icon: Banknote },
    { key: "bank", label: "Ngân hàng", icon: Landmark },
  ];

  function goCashflow(pane: CashflowPane) {
    setCashflowPane(pane);
    setActiveTab("cashflow");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={onBack}
          style={styles.backButton}
        >
          <AppText style={styles.backText}>‹</AppText>
        </Pressable>
        <AppText display style={styles.headerTitle}>Ví của tôi</AppText>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <View style={styles.content}>
        {activeTab === "home" ? (
          <WalletHomeScreen
            state={state}
            isOwner={isOwner}
            pinGate={pinGate}
            balanceHidden={balanceHidden}
            onToggleHidden={() => setBalanceHidden((v) => !v)}
            onTopUp={() => goCashflow("topup")}
            onWithdraw={() => goCashflow("withdraw")}
            onGoHistory={() => setActiveTab("history")}
            onGoBank={() => setActiveTab("bank")}
          />
        ) : activeTab === "history" ? (
          <WalletHistoryScreen state={state} />
        ) : activeTab === "cashflow" ? (
          <WalletCashflowScreen
            state={state}
            pinGate={pinGate}
            initialPane={cashflowPane}
            onNeedBank={() => setActiveTab("bank")}
          />
        ) : (
          <WalletBankScreen state={state} />
        )}
      </View>

      <MobileBottomBar activeKey={activeTab} items={tabs} onChange={setActiveTab} />

      <PaymentWebViewModal
        checkoutUrl={state.paySheet?.checkoutUrl ?? null}
        onClose={() => {
          state.setPaySheet(null);
          void state.reload();
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
      paddingTop: 2,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPlaceholder: { width: 32, height: 32 },
    backText: { color: theme.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    content: { flex: 1 },
  });
