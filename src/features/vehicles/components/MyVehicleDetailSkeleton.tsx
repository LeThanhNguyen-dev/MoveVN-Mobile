import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function Pulse({ height, radius = 10, width }: { height: number; radius?: number; width?: number | `${number}%` }) {
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
      style={{ width: width ?? "100%", height, borderRadius: radius, backgroundColor: theme.surfaceAlt, opacity }}
    />
  );
}

function MyVehicleDetailSkeleton() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.backBtn} />
        <View style={styles.topTitleWrap}>
          <Pulse height={17} width="60%" radius={6} />
          <Pulse height={12} width="40%" radius={6} />
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.gallery} />
        <View style={styles.statusRow}>
          <Pulse height={30} width={150} radius={999} />
          <Pulse height={30} width={52} radius={999} />
        </View>
        <View style={styles.card}>
          <Pulse height={14} width="35%" radius={6} />
          <Pulse height={26} width="55%" radius={8} />
          <Pulse height={13} radius={6} />
          <Pulse height={13} radius={6} />
          <Pulse height={13} width="70%" radius={6} />
        </View>
        <View style={styles.card}>
          <Pulse height={14} width="40%" radius={6} />
          <Pulse height={44} radius={12} />
          <View style={styles.grid}>
            <View style={styles.gridCol}>
              <Pulse height={52} radius={12} />
            </View>
            <View style={styles.gridCol}>
              <Pulse height={52} radius={12} />
            </View>
          </View>
          <Pulse height={13} radius={6} />
          <Pulse height={13} width="80%" radius={6} />
        </View>
        <View style={styles.card}>
          <Pulse height={14} width="35%" radius={6} />
          <View style={styles.gallery} />
        </View>
      </View>
    </View>
  );
}

export default memo(MyVehicleDetailSkeleton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surfaceAlt },
    topTitleWrap: { flex: 1, gap: 6 },
    scroll: { padding: 16, gap: 12 },
    gallery: { width: "100%", aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
    },
    grid: { flexDirection: "row", gap: 10 },
    gridCol: { flex: 1 },
  });
