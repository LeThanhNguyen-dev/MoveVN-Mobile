import { useMemo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { useTheme } from "@/theme/useTheme";
import { useLanguageStore } from "@/theme/useLanguageStore";
import type { Theme } from "@/theme/tokens";

const shortLabels: Record<SupportedLanguage, string> = { vi: "VI", en: "EN" };

export default function LanguageToggle({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const { t } = useTranslation("app");
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return <View accessibilityRole="radiogroup" style={[styles.group, style]}>
    {SUPPORTED_LANGUAGES.map((value) => {
      const active = value === language;
      return <Pressable
        accessibilityLabel={value === "en" ? t("language.switchToEnglish") : t("language.switchToVietnamese")}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        key={value}
        onPress={() => { if (!active) void setLanguage(value); }}
        style={[styles.option, active ? styles.optionActive : null]}
      >
        <AppText style={[styles.label, active ? styles.labelActive : null]}>{shortLabels[value]}</AppText>
      </Pressable>;
    })}
  </View>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  option: {
    minWidth: 40,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: theme.brand },
  label: { color: theme.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  labelActive: { color: theme.onBrand },
});
