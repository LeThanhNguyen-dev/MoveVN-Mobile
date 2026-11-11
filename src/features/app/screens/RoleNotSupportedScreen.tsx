import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { ShieldAlert } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { clearSession, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { UserRole } from "@/features/auth/types";
import NotificationBell from "@/features/notifications/components/NotificationBell";

export default function RoleNotSupportedScreen({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.screen}>
      <ShieldAlert color={theme.brand} size={48} />
      <AppText display style={styles.title}>{t("mobile:navigation.roleNotSupported.title")}</AppText>
      <AppText style={styles.muted}>
        {t("mobile:navigation.roleNotSupported.description", { email: user?.email ?? "", role })}
      </AppText>
      <View style={styles.notifications}>
        <AppText style={styles.muted}>{t("mobile:navigation.yourNotifications")}</AppText>
        <NotificationBell />
      </View>
      <Pressable onPress={() => clearSession()} style={styles.button}>
        <AppText style={styles.buttonText}>{t("accountSecurity:sessions.signOut")}</AppText>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    muted: { color: theme.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
    notifications: { flexDirection: "row", alignItems: "center", gap: 12 },
    button: { marginTop: 8, borderRadius: 12, backgroundColor: theme.brand, paddingHorizontal: 24, paddingVertical: 12 },
    buttonText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
  });
