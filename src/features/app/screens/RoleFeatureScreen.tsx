import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RoleFeatureScreen({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft color="#6B19FF" size={21} /></Pressable>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#FAF6FF" }, content: { flex: 1, padding: 24 }, back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#E2D8F0", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, copy: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }, title: { color: "#101936", fontSize: 27, fontWeight: "800", textAlign: "center" }, description: { color: "#746F7E", fontSize: 15, lineHeight: 23, textAlign: "center", maxWidth: 300 } });
