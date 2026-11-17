import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/**
 * Nút "!" mở giải thích cách hệ thống đọc GPS (sai số, ngưỡng tính dừng).
 * Dùng chung cho các màn hình GPS để người tò mò tự xem.
 */
export default function GpsInfoButton({ size = 32 }: { size?: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <Pressable
      onPress={() => showAppAlert(t("mobile:gps.info.title"), t("mobile:gps.info.body"))}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("mobile:gps.info.aria")}
    >
      <AppText style={styles.mark}>!</AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme, size: number) => StyleSheet.create({
  button: {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { color: theme.muted, fontSize: Math.round(size * 0.45), fontWeight: "900" },
});
