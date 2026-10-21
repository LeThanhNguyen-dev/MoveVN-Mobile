import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { Eye, EyeOff, LoaderCircle } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { formatMoney } from "@/features/wallets/utils/format";

export default function BalanceCard({
  balance,
  totalEarned,
  totalSpent,
  hidden,
  onToggleHidden,
  pendingOrderCode,
  isOwner,
  locked,
  onUnlockPress,
}: {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  hidden: boolean;
  onToggleHidden: () => void;
  pendingOrderCode: number | null;
  isOwner: boolean;
  /** Khóa PIN: số tiền hiện *** cho tới khi bấm mắt để mở popup PIN. */
  locked?: boolean;
  onUnlockPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const masked = locked === true || hidden;

  return (
    <View style={styles.card}>
      {/* Decor fintech: 2 vòng tròn mờ giữ màu app */}
      <View pointerEvents="none" style={styles.decorA} />
      <View pointerEvents="none" style={styles.decorB} />

      <View style={styles.topRow}>
        <AppText style={styles.label}>Số dư khả dụng</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locked === true ? "Mở khóa số dư" : hidden ? "Hiện số dư" : "Ẩn số dư"}
          onPress={locked === true ? onUnlockPress : onToggleHidden}
          style={styles.eyeButton}
          hitSlop={10}
        >
          {masked
            ? <Eye color={theme.onBrand} size={18} />
            : <EyeOff color={theme.onBrand} size={18} />}
        </Pressable>
      </View>

      <AppText style={styles.balance}>
        {masked ? "***" : formatMoney(balance)}
      </AppText>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <AppText style={styles.statLabel}>{isOwner ? "Tổng thu nhập" : "Đã nạp"}</AppText>
          <AppText style={styles.statValue}>
            {masked ? "***" : formatMoney(totalEarned)}
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <AppText style={styles.statLabel}>Đã chi</AppText>
          <AppText style={styles.statValue}>
            {masked ? "***" : formatMoney(totalSpent)}
          </AppText>
        </View>
      </View>

      {pendingOrderCode != null && (
        <View style={styles.pendingChip}>
          <LoaderCircle color={theme.onBrand} size={14} />
          <AppText style={styles.pendingText}>Đang chờ nạp #{pendingOrderCode}...</AppText>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.brand,
      borderRadius: 20,
      padding: 18,
      gap: 8,
      overflow: "hidden",
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    decorA: {
      position: "absolute",
      top: -70,
      right: -50,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: theme.decorA,
      opacity: 0.35,
    },
    decorB: {
      position: "absolute",
      bottom: -90,
      left: -40,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: theme.decorB,
      opacity: 0.28,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    label: { color: theme.onBrand, fontSize: 13, opacity: 0.85, fontWeight: "600" },
    eyeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    balance: { color: theme.onBrand, fontSize: 32, fontWeight: "800", letterSpacing: 0.3 },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    stat: { flex: 1, gap: 2 },
    statLabel: { color: theme.onBrand, fontSize: 11, opacity: 0.8, fontWeight: "600" },
    statValue: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    divider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 10 },
    pendingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      alignSelf: "flex-start",
    },
    pendingText: { color: theme.onBrand, fontSize: 12, fontWeight: "700" },
  });
