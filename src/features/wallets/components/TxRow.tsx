import { useMemo } from "react";
import { StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  Ban,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { WalletTransactionDto } from "@/features/wallets/types";
import { formatDateTime, formatMoney, txTypeLabel } from "@/features/wallets/utils/format";

function iconForType(type: string) {
  switch (type) {
    case "TopUp":
    case "Refund":
    case "PayoutReversal":
    case "DisputeCompensation":
      return ArrowDownLeft;
    case "BookingPayment":
    case "Withdrawal":
    case "Penalty":
      return ArrowUpRight;
    case "BookingEarning":
      return Wallet;
    case "AutoPayout":
      return Landmark;
    case "AdminAdjust":
      return ShieldCheck;
    case "BookingEarningReversal":
      return Ban;
    case "PlatformFeeRevenue":
      return BadgePercent;
    default:
      return RefreshCcw;
  }
}

export function isIncoming(type: string, amount: number) {
  if (amount !== 0) return amount > 0;
  return ["TopUp", "BookingEarning", "Refund", "PayoutReversal", "DisputeCompensation"].includes(type);
}

export default function TxRow({ tx }: { tx: WalletTransactionDto }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const Icon = iconForType(tx.type);
  const incoming = isIncoming(tx.type, tx.amount);

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, incoming ? styles.iconIn : styles.iconOut]}>
        <Icon color={incoming ? theme.success : theme.danger} size={18} strokeWidth={2.2} />
      </View>
      <View style={styles.mid}>
        <AppText display style={styles.title} numberOfLines={1}>{txTypeLabel(tx.type)}</AppText>
        {tx.note ? (
          <AppText numberOfLines={1} style={styles.note}>{tx.note}</AppText>
        ) : null}
        <AppText style={styles.time}>{formatDateTime(tx.createdAt)}</AppText>
      </View>
      <AppText style={[styles.amount, incoming ? styles.amountIn : styles.amountOut]}>
        {incoming ? "+" : "−"}{formatMoney(Math.abs(tx.amount))}
      </AppText>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    iconIn: { backgroundColor: theme.successSoft },
    iconOut: { backgroundColor: theme.dangerSoft },
    mid: { flex: 1, gap: 1 },
    title: { color: theme.text, fontSize: 13.5, fontWeight: "700" },
    note: { color: theme.muted, fontSize: 12 },
    time: { color: theme.placeholder, fontSize: 11 },
    amount: { fontSize: 14, fontWeight: "800" },
    amountIn: { color: theme.success },
    amountOut: { color: theme.text },
  });
