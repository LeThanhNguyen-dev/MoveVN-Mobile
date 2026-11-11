import { HelpCircle, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function PricingModeHelp() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={styles.helpButton}
        accessibilityRole="button"
        accessibilityLabel={t("mobile:ownerVehicle.pricingHelp.a11y")}
      >
        <HelpCircle color={theme.muted} size={16} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <AppText display style={styles.title}>{t("mobile:ownerVehicle.pricing.modeTitle")}</AppText>
              <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
                <X color={theme.text} size={18} />
              </Pressable>
            </View>

            <AppText display style={styles.sectionTitle}>{t("mobile:ownerVehicle.pricing.fixed")}</AppText>
            <AppText style={styles.body}>{t("mobile:ownerVehicle.pricingHelp.fixedBody")}</AppText>

            <AppText display style={styles.sectionTitle}>{t("mobile:ownerVehicle.pricing.auto")}</AppText>
            <AppText style={styles.body}>{t("mobile:ownerVehicle.pricingHelp.autoBody")}</AppText>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    helpButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.overlay,
      padding: 20,
    },
    sheet: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    sectionTitle: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: 6 },
    body: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  });
