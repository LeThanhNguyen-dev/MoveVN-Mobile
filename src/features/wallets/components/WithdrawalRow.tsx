import { useMemo, type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { Check, CheckCheck, Clock, TriangleAlert, X } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { WithdrawalRequestDto } from "@/features/wallets/types";
import { formatDateTime, formatMoney, withdrawalStatusLabel } from "@/features/wallets/utils/format";

type StatusLook = {
  color: string;
  softBg: string;
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
};

function lookForStatus(status: string, theme: Theme): StatusLook {
  switch (status) {
    case "Pending":
      return { color: "#F59E0B", softBg: "rgba(245, 158, 11, 0.14)", icon: Clock };
    case "Approved":
      return { color: theme.info, softBg: theme.infoSoft, icon: Check };
    case "NeedsManualReview":
      return { color: "#EA580C", softBg: "rgba(234, 88, 12, 0.12)", icon: TriangleAlert };
    case "Completed":
      return { color: theme.success, softBg: theme.successSoft, icon: CheckCheck };
    case "Rejected":
      return { color: theme.danger, softBg: theme.dangerSoft, icon: X };
    default:
      return { color: theme.muted, softBg: theme.surfaceAlt, icon: Clock };
  }
}

export function isCancellable(w: WithdrawalRequestDto) {
  return w.status === "Pending" || (w.status === "Approved" && !w.externalTransactionRef);
}

export default function WithdrawalRow({
  w,
  onCancel,
}: {
  w: WithdrawalRequestDto;
  onCancel: (id: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const look = lookForStatus(w.status, theme);
  const Icon = look.icon;

  return (
    <View style={styles.row}>
      {/* Vòng tròn trạng thái: màu tương ứng từng trạng thái rút tiền */}
      <View
        accessibilityLabel={`Trạng thái: ${withdrawalStatusLabel(w.status)}`}
        style={[styles.statusCircle, { backgroundColor: look.softBg, borderColor: look.color }]}
      >
        <Icon color={look.color} size={19} strokeWidth={2.4} />
      </View>
      <View style={styles.mid}>
        <AppText style={styles.amount}>{formatMoney(w.amount)}</AppText>
        <AppText style={[styles.status, { color: look.color }]}>
          {withdrawalStatusLabel(w.status)}
        </AppText>
        <AppText style={styles.muted} numberOfLines={1}>
          {w.bankName} · {w.bankAccountNumber}
        </AppText>
        {w.processNote ? (
          <AppText style={styles.muted} numberOfLines={2}>{w.processNote}</AppText>
        ) : null}
        <AppText style={styles.time}>{formatDateTime(w.createdAt)}</AppText>
      </View>
      {isCancellable(w) && (
        <Pressable onPress={() => onCancel(w.id)} style={styles.cancelButton}>
          <AppText style={styles.cancelText}>Hủy</AppText>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    statusCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    mid: { flex: 1, gap: 1 },
    amount: { color: theme.text, fontSize: 14.5, fontWeight: "800" },
    status: { fontSize: 12.5, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 12 },
    time: { color: theme.placeholder, fontSize: 11 },
    cancelButton: {
      borderRadius: 8,
      backgroundColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    cancelText: { color: theme.danger, fontSize: 12, fontWeight: "800" },
  });
