import { useMemo } from "react";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

export function AuthScreenHeader({ title, description, onBack }: { title: string; description: string; onBack?: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <>
    {onBack ? <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft color={theme.brand} size={21} /></Pressable> : null}
    <View style={styles.heading}><AppText display style={styles.title}>{title}</AppText><AppText style={styles.description}>{description}</AppText></View>
  </>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", marginBottom: 2 }, heading: { gap: 7, marginBottom: 3 }, title: { color: theme.text, fontSize: 30, lineHeight: 38, fontWeight: "800" }, description: { color: theme.muted, fontSize: 15, lineHeight: 23, fontWeight: "500" } });
