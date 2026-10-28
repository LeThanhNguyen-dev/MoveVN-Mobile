import { LinearGradient } from "expo-linear-gradient";
import { CircleAlert, Send } from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { formatMoney } from "@/features/booking/utils/format";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";

type Props = {
  total: number | null;
  deposit: number | null;
  days: number;
  submitting: boolean;
  error: string | null;
  bottomInset: number;
  onSubmit: () => void;
};

export default function CheckoutSubmitDock({
  total,
  deposit,
  days,
  submitting,
  error,
  bottomInset,
  onSubmit,
}: Props) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  const hint =
    total == null
      ? "Chọn thời gian thuê hợp lệ để xem tổng tiền"
      : `Cọc ${formatMoney(deposit ?? 0)} · ${days} ngày`;

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {error ? (
        <View style={styles.errorRow}>
          <CircleAlert color={p.danger} size={14} strokeWidth={2.2} />
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.summary}>
          <AppText style={styles.total} numberOfLines={1}>
            {total != null ? formatMoney(total) : "—"}
          </AppText>
          <AppText style={styles.hint} numberOfLines={1}>
            {hint}
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gửi yêu cầu thuê xe"
          accessibilityState={{ busy: submitting, disabled: submitting }}
          disabled={submitting}
          onPress={onSubmit}
          style={({ pressed }) => [styles.ctaWrap, pressed && !submitting && styles.pressed]}
        >
          <LinearGradient
            colors={submitting ? [p.surfaceAlt, p.surfaceAlt] : p.gradient}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.cta}
          >
            {submitting ? (
              <ActivityIndicator color={p.muted} size="small" />
            ) : (
              <>
                <AppText style={styles.ctaText}>Gửi yêu cầu</AppText>
                <Send color={p.onBrand} size={15} strokeWidth={2.2} />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    dock: {
      paddingTop: 10,
      paddingHorizontal: 16,
      gap: 8,
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.line,
      shadowColor: p.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
    errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    errorText: { color: p.danger, fontFamily: checkoutFont.medium, fontSize: 10, lineHeight: 14, flex: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    summary: { flex: 1, minWidth: 0 },
    total: {
      color: p.ink,
      fontFamily: checkoutFont.display,
      fontSize: 21,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    hint: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 10, marginTop: 2 },
    ctaWrap: { borderRadius: 16, overflow: "hidden", flexShrink: 0 },
    cta: {
      minWidth: 148,
      height: 48,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    ctaText: { color: p.onBrand, fontFamily: checkoutFont.bold, fontSize: 13.5, letterSpacing: 0.1 },
    pressed: { opacity: 0.86 },
  });
