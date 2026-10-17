import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { WalletTransactionDto } from "@/features/wallets/types";
import { formatDateTime, formatMoney, txTypeLabel } from "@/features/wallets/utils/format";
import { isIncoming } from "@/features/wallets/components/TxRow";

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { theme } = useTheme();
  return (
    <View style={detailRowStyles.row}>
      <AppText style={[detailRowStyles.label, { color: theme.muted }]}>{label}</AppText>
      <AppText style={[detailRowStyles.value, { color: accent ?? theme.text }]}>{value}</AppText>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  label: { fontSize: 13, flexShrink: 0 },
  value: { fontSize: 13.5, fontWeight: "700", textAlign: "right", flex: 1 },
});

export default function TxDetailSheet({
  tx,
  onClose,
}: {
  tx: WalletTransactionDto | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const incoming = tx ? isIncoming(tx.type, tx.amount) : true;

  return (
    <Modal visible={tx !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {tx && (
            <>
              <AppText display style={styles.title}>{txTypeLabel(tx.type)}</AppText>
              <AppText style={[styles.amount, incoming ? styles.amountIn : styles.amountOut]}>
                {incoming ? "+" : "−"}{formatMoney(Math.abs(tx.amount))}
              </AppText>
              <View style={styles.divider} />
              <Row label="Thời gian" value={formatDateTime(tx.createdAt)} />
              <Row label="Số dư sau GD" value={formatMoney(tx.balanceAfter)} accent={theme.brand} />
              {tx.referenceId != null && <Row label="Mã tham chiếu" value={`#${tx.referenceId}`} />}
              {tx.status ? <Row label="Trạng thái" value={tx.status} /> : null}
              {tx.note ? <Row label="Ghi chú" value={tx.note} /> : null}
              <Pressable onPress={onClose} style={styles.closeButton}>
                <AppText style={styles.closeText}>Đóng</AppText>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 28,
      gap: 4,
    },
    title: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    amount: { fontSize: 26, fontWeight: "800", textAlign: "center", marginVertical: 4 },
    amountIn: { color: theme.success },
    amountOut: { color: theme.danger },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 8 },
    closeButton: {
      marginTop: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      paddingVertical: 12,
      alignItems: "center",
    },
    closeText: { color: theme.text, fontWeight: "800" },
  });
