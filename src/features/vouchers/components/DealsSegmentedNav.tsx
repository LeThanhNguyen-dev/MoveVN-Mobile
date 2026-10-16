import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";
import { CTA_GRADIENT } from "@/features/vouchers/voucherFormat";

const SEGMENTS: { route: keyof DealsStackParamList; emoji: string; label: string }[] = [
  { route: "Promotions", emoji: "🔥", label: "Khuyến mãi" },
  { route: "VoucherHunt", emoji: "✨", label: "Săn mã" },
  { route: "VoucherWallet", emoji: "🧳", label: "Ví voucher" },
];

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;

/** Thanh chuyển nhanh 3 màn hình Ưu đãi — dùng chung đầu cả 3 trang. */
function DealsSegmentedNav() {
  const route = useRoute();
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      {SEGMENTS.map((seg) => {
        const active = route.name === seg.route;
        return (
          <Pressable
            key={seg.route}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
            onPress={() => {
              if (active) return;
              if (seg.route === "Promotions") navigation.navigate("Promotions");
              else if (seg.route === "VoucherHunt") navigation.navigate("VoucherHunt");
              else navigation.navigate("VoucherWallet");
            }}
            style={styles.segTouch}
          >
            {active ? (
              <LinearGradient
                colors={[CTA_GRADIENT[0], CTA_GRADIENT[1], CTA_GRADIENT[2]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.segActive}
              >
                <Text style={styles.segActiveText}>
                  {seg.emoji} {seg.label}
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.segIdle}>
                <Text style={styles.segIdleText}>
                  {seg.emoji} {seg.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(DealsSegmentedNav);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      gap: 6,
      padding: 6,
      borderRadius: 16,
      backgroundColor: theme.mode === "dark" ? "#16161D" : "rgba(237,233,254,0.8)",
      marginBottom: 16,
    },
    segTouch: { flex: 1, borderRadius: 12 },
    segActive: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 12,
    },
    segActiveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    segIdle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 12,
    },
    segIdleText: {
      color: theme.mode === "dark" ? "#A1A1AA" : "#4B5563",
      fontSize: 12,
      fontWeight: "500",
    },
  });
