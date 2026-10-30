import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function PulseBlock({
  width,
  height,
  radius,
}: {
  width?: number | `${number}%`;
  height: number;
  radius: number;
}) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        backgroundColor: theme.surfaceAlt,
        opacity,
      }}
    />
  );
}

/**
 * Skeleton cho BookingCard mới (ảnh 86 + info + dòng thời gian + địa điểm + footer).
 * Khớp chiều cao thật để list không nhảy khi dữ liệu về.
 */
function BookingCardSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <PulseBlock width={86} height={86} radius={18} />
        <View style={styles.info}>
          <View style={styles.codeRow}>
            <PulseBlock width="42%" height={9} radius={5} />
            <PulseBlock width={62} height={18} radius={999} />
          </View>
          <PulseBlock width="72%" height={15} radius={6} />
          <PulseBlock width="46%" height={10} radius={5} />
          <PulseBlock width="88%" height={10} radius={5} />
          <PulseBlock width="78%" height={10} radius={5} />
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.price}>
          <PulseBlock width={96} height={16} radius={6} />
          <PulseBlock width={74} height={9} radius={5} />
        </View>
        <PulseBlock width={92} height={34} radius={12} />
      </View>
    </View>
  );
}

export default memo(BookingCardSkeleton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 13,
      gap: 10,
    },
    row: { flexDirection: "row", gap: 11 },
    info: { flex: 1, gap: 7, minWidth: 0, justifyContent: "center" },
    codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    price: { gap: 5 },
  });
