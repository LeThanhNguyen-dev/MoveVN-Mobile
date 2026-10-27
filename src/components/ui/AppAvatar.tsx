import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";

export default function AppAvatar({ name, uri, size = 44, online }: { name: string; uri?: string | null; size?: number; online?: boolean }) {
  const { theme } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase() || "M";
  return <View style={{ width: size, height: size, flexShrink: 0 }}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.brandSoft }]}>
      {uri && failedUri !== uri
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} onError={() => setFailedUri(uri)} accessibilityLabel={name} />
        : <AppText style={{ color: theme.brand, fontSize: size * 0.32, fontWeight: "700" }}>{initials}</AppText>}
    </View>
    {online !== undefined && <View style={[styles.dot, { backgroundColor: online ? theme.success : theme.faint, borderColor: theme.surface }]} />}
  </View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, position: "absolute", right: 0, bottom: 0 },
});
