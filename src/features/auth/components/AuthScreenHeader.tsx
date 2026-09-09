import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function AuthScreenHeader({ title, description, onBack }: { title: string; description: string; onBack?: () => void }) {
  return <>
    {onBack ? <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft color="#6B19FF" size={21} /></Pressable> : null}
    <View style={styles.heading}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
  </>;
}

const styles = StyleSheet.create({ back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#E2D8F0", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 2 }, heading: { gap: 7, marginBottom: 3 }, title: { color: "#101936", fontSize: 30, lineHeight: 38, fontWeight: "800" }, description: { color: "#746F7E", fontSize: 15, lineHeight: 23, fontWeight: "500" } });
