import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";

export function PreviewImage({ uri, label, full = false }: { uri: string; label: string; full?: boolean }) {
  const { t } = useTranslation("bookingGuide");
  const { theme } = useTheme();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setStatus("loading"); setAttempt(0); }, [uri]);
  return <View style={[full ? styles.full : styles.thumb, { backgroundColor: theme.surfaceAlt }]}>
    <Image key={`${uri}-${attempt}`} source={{ uri }} accessibilityLabel={label} resizeMode="contain"
      style={StyleSheet.absoluteFill} onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />
    {status === "loading" ? <ActivityIndicator accessibilityLabel={t("loading")} color={theme.brand} /> : null}
    {status === "error" ? <View style={styles.error}>
      <Text style={{ color: theme.text }}>{t("loadError")}</Text>
      <Pressable accessibilityRole="button" onPress={event => { event?.stopPropagation(); setStatus("loading"); setAttempt(n => n + 1); }} style={styles.action}>
        <Text style={{ color: theme.brand }}>{t("retry")}</Text>
      </Pressable>
    </View> : null}
  </View>;
}

export function PhotoViewer({ uri, label, onClose }: { uri: string; label?: string; onClose: () => void }) {
  const { t } = useTranslation("bookingGuide");
  return <Modal visible animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.viewer}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("close")} onPress={onClose} style={styles.action}><Text style={styles.white}>{t("close")}</Text></Pressable>
      <PreviewImage uri={uri} label={label ?? t("view", { index: 1 })} full />
      {label ? <Text style={[styles.white, styles.action]}>{label}</Text> : null}
    </SafeAreaView>
  </Modal>;
}

export default function PhotoPreview({ photos, onRemove, disabled }: {
  photos: { uri: string; name?: string }[]; onRemove?: (index: number) => void; disabled?: boolean;
}) {
  const { t } = useTranslation("bookingGuide");
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  return <>
    <View style={styles.grid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.item}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("view", { index: index + 1 })} onPress={() => setSelected(photo.uri)}>
        <PreviewImage uri={photo.uri} label={photo.name ?? t("view", { index: index + 1 })} />
      </Pressable>
      {photo.name ? <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12 }}>{photo.name}</Text> : null}
      {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={t("remove", { index: index + 1 })} disabled={disabled} onPress={() => onRemove(index)} style={styles.action}>
        <Text style={{ color: theme.danger }}>{t("remove", { index: index + 1 })}</Text>
      </Pressable> : null}
    </View>)}</View>
    {selected ? <PhotoViewer uri={selected} onClose={() => setSelected(null)} /> : null}
  </>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, item: { width: 140, gap: 4 },
  thumb: { width: "100%", height: 120, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  full: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  viewer: { flex: 1, backgroundColor: "#101019" }, white: { color: "#fff", textAlign: "center" },
  action: { minHeight: 44, padding: 10, justifyContent: "center" }, error: { alignItems: "center", padding: 8 },
});
