import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";

/** Các màn hình còn lại trong cụm Ưu đãi sau khi bỏ màn Khuyến mãi (Promotions). */
const SEGMENTS: { route: keyof DealsStackParamList; labelKey: string }[] = [
  { route: "VoucherHunt", labelKey: "mobile:voucher.nav.hunt" },
  { route: "VoucherWallet", labelKey: "promo:wallet.pageTitle" },
];

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;

/** Thanh chuyển nhanh giữa Săn mã và Ví voucher (không icon, không màn Khuyến mãi). */
function DealsSegmentedNav() {
  const route = useRoute();
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      {SEGMENTS.map((seg) => {
        const active = route.name === seg.route;
        const label = t(seg.labelKey);
        return (
          <Pressable
            key={seg.route}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => {
              if (active) return;
              if (seg.route === "VoucherHunt") navigation.navigate("VoucherHunt");
              else navigation.navigate("VoucherWallet");
            }}
            style={styles.segTouch}
          >
            <View style={active ? styles.segActive : styles.segIdle}>
              <AppText style={active ? styles.segActiveText : styles.segIdleText}>
                {label}
              </AppText>
            </View>
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
      backgroundColor: theme.surfaceAlt,
      marginBottom: 16,
    },
    segTouch: { flex: 1, borderRadius: 12 },
    segActive: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.brand,
    },
    segActiveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    segIdle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 12,
    },
    segIdleText: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "500",
    },
  });
