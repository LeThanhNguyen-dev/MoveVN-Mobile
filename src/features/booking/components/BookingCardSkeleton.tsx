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
 * Skeleton cho BookingCard ngang (ảnh 96 + info).
 * Cao ~140px để khớp card thật, 1 màn thoáng ~4 card.
 */
function BookingCardSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.info}>
        <PulseBlock width="60%" height={12} radius={6} />
        <PulseBlock width="90%" height={16} radius={6} />
        <PulseBlock width="70%" height={12} radius={6} />
        <PulseBlock width="85%" height={13} radius={6} />
        <PulseBlock width="80%" height={13} radius={6} />
        <PulseBlock width="75%" height={13} radius={6} />
        <PulseBlock width="55%" height={16} radius={8} />
      </View>
    </View>
  );
}

export default memo(BookingCardSkeleton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      gap: 12,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
    },
    image: { width: 88, height: 100, borderRadius: 14, backgroundColor: theme.surfaceAlt },
    info: { flex: 1, gap: 10, justifyContent: "center" },
  });
