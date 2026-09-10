import { useMemo, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { AuthLayout } from "./AuthLayout";

export function AuthScreenLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthLayout>{children}</AuthLayout>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.background }, fill: { flex: 1 }, scroll: { flexGrow: 1 } });
