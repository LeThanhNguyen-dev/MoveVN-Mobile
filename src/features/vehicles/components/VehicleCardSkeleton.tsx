import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function PulseBlock({ width, height, radius, delay = 0 }: { width?: number | `${number}%`; height: number; radius: number; delay?: number }) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, delay]);

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

function VehicleCardSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.info}>
        <PulseBlock width="55%" height={13} radius={7} />
        <PulseBlock width="85%" height={17} radius={7} delay={120} />
        <PulseBlock width="65%" height={13} radius={7} delay={240} />
        <View style={styles.row}>
          <PulseBlock width={90} height={14} radius={7} delay={360} />
          <PulseBlock width={110} height={18} radius={7} delay={420} />
        </View>
        <PulseBlock height={42} radius={12} delay={480} />
      </View>
    </View>
  );
}

export default memo(VehicleCardSkeleton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.surfaceAlt },
    info: { padding: 13, gap: 8 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  });
