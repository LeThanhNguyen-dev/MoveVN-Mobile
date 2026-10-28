import { ChevronLeft } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useDetailTheme } from "./detailTheme";

function Pulse({
  height,
  radius = 12,
  width,
  style,
}: {
  height: number;
  radius?: number;
  width?: number | `${number}%`;
  style?: object;
}) {
  const { p } = useDetailTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (active) setReduceMotion(enabled); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.8);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        { width: width ?? "100%", height, borderRadius: radius, backgroundColor: p.surfaceAlt, opacity },
        style,
      ]}
    />
  );
}

export default function VehicleDetailSkeleton({
  bottomInset,
  onBack,
}: {
  bottomInset: number;
  onBack: () => void;
}) {
  const { p } = useDetailTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(p, width), [p, width]);
  const heroHeight = Math.min(width * 0.84, 430);

  return (
    <View
      style={styles.screen}
    >
      <View style={[styles.hero, { height: heroHeight }]}>
        <Pulse height={heroHeight} radius={0} />
        <View style={[styles.topbar, { paddingTop: 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={6}
            onPress={onBack}
            style={styles.back}
          >
            <ChevronLeft color="#FFFFFF" size={22} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.topActions}>
            <View style={styles.glass} />
            <View style={styles.glass} />
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryLeft}>
            <Pulse height={9} radius={5} width={92} />
            <Pulse height={22} radius={8} width="82%" />
            <Pulse height={11} radius={6} width={128} />
          </View>
          <View style={styles.summaryRight}>
            <Pulse height={19} radius={7} width={82} />
            <Pulse height={9} radius={5} width={52} />
          </View>
        </View>
        <View style={styles.facts}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.fact}>
              <Pulse height={30} radius={10} width={30} />
              <Pulse height={8} radius={4} width="70%" />
              <Pulse height={10} radius={4} width="52%" />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.banner}>
        <Pulse height={34} radius={17} width={34} />
        <View style={styles.bannerBody}>
          <Pulse height={11} radius={5} width="62%" />
          <Pulse height={9} radius={5} width="42%" />
        </View>
      </View>

      {[0, 1].map((index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHead}>
            <Pulse height={34} radius={11} width={34} />
            <Pulse height={15} radius={6} width={148} />
          </View>
          <View style={styles.cardRows}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.cardRow}>
                <Pulse height={11} radius={5} width="38%" />
                <Pulse height={11} radius={5} width="22%" />
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <View style={styles.dockSummary}>
          <Pulse height={20} radius={7} width={110} />
          <Pulse height={9} radius={5} width={132} />
        </View>
        <Pulse height={50} radius={16} width={168} />
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"], width: number) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.canvas },
    hero: {
      width,
      backgroundColor: p.surfaceAlt,
      justifyContent: "flex-start",
    },
    topbar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(16,12,28,0.34)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.26)",
    },
    glass: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(16,12,28,0.22)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    summaryCard: {
      marginTop: -30,
      marginHorizontal: 14,
      backgroundColor: p.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: p.line,
      paddingTop: 18,
      paddingHorizontal: 18,
      overflow: "hidden",
    },
    summaryTop: { flexDirection: "row", gap: 12 },
    summaryLeft: { flex: 1, gap: 8 },
    summaryRight: { width: 96, alignItems: "flex-end", gap: 6 },
    facts: {
      flexDirection: "row",
      marginTop: 16,
      marginHorizontal: -18,
      paddingHorizontal: 8,
      paddingTop: 13,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: p.line,
      backgroundColor: p.surfaceSoft,
    },
    fact: { flex: 1, alignItems: "center", gap: 6 },
    banner: {
      marginTop: 12,
      marginHorizontal: 14,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    bannerBody: { flex: 1, gap: 6 },
    card: {
      marginTop: 12,
      marginHorizontal: 14,
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
      gap: 14,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardRows: { gap: 11 },
    cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 12,
      paddingHorizontal: 16,
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.line,
    },
    dockSummary: { flex: 1, gap: 7 },
  });
