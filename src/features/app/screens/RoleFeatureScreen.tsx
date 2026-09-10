import { ArrowLeft } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function RoleFeatureScreen({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft color={theme.brand} size={21} /></Pressable>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
  </View></SafeAreaView>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.background }, content: { flex: 1, padding: 24 }, back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }, title: { color: theme.text, fontSize: 27, fontWeight: "800", textAlign: "center" }, description: { color: theme.muted, fontSize: 15, lineHeight: 23, textAlign: "center", maxWidth: 300 } });
