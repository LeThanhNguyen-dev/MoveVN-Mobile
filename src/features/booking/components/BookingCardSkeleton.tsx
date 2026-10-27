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
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
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

/** Match the compact booking card to avoid a large jump after loading. */
function BookingCardSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <PulseBlock width="40%" height={11} radius={6} />
        <PulseBlock width="30%" height={23} radius={12} />
      </View>
      <View style={styles.row}>
        <View style={styles.image} />
        <View style={styles.info}>
          <PulseBlock width="85%" height={15} radius={6} />
          <PulseBlock width="95%" height={11} radius={6} />
          <PulseBlock width="90%" height={11} radius={6} />
        </View>
      </View>
      <PulseBlock width="85%" height={10} radius={5} />
      <View style={styles.row}>
        <PulseBlock width="32%" height={25} radius={6} />
        <PulseBlock width="25%" height={20} radius={6} />
      </View>
    </View>
  );
}

export default memo(BookingCardSkeleton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: 10,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    row: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      justifyContent: "space-between",
    },
    image: {
      width: 64,
      height: 68,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
    },
    info: { flex: 1, gap: 9, justifyContent: "center" },
  });
