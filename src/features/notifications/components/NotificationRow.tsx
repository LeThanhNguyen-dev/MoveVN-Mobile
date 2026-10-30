import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Bell, CalendarCheck, CarFront, ChevronRight, CircleAlert, FileCheck2, Flag, Headphones, MessageSquare, Scale, Wallet } from "lucide-react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import { notificationReference, notificationRelativeTime } from "../notificationPresentation";
import { notificationVisuals } from "../notificationVisuals";
import type { NotificationItem } from "../types";

const icons = { booking: CalendarCheck, wallet: Wallet, support: Headphones, vehicle: CarFront,
  message: MessageSquare, system: Bell, contract: FileCheck2, dispute: Scale, violation: Flag };

function NotificationRow({ item, now, onOpen }: {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
}) {
  const { theme } = useTheme();
  const visual = notificationVisuals(item, theme);
  const Icon = visual.urgent ? CircleAlert : icons[visual.icon];
  const reference = notificationReference(item.dataJson);
  // The reference has its own line; don't repeat the same booking code in the preview.
  const code = reference?.slice(reference.indexOf(":") + 1).trim();
  const body = code && item.body.startsWith(`${code}:`) ? item.body.slice(code.length + 1).trim() : item.body;
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={`${item.isRead ? "Đã đọc" : "Chưa đọc"}, ${visual.label}${visual.urgent ? ", Cảnh báo quá hạn" : ""}: ${item.title}`}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.card, {
        backgroundColor: pressed ? theme.brandSoft : item.isRead ? theme.surface
          : theme.mode === "light" ? "#FCFAFF" : "#251E38",
        borderColor: item.isRead ? theme.border : theme.brandBorder,
      }]}>
      <View style={[styles.icon, { backgroundColor: visual.background }]}>
        <Icon size={19} color={visual.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.line}>
          <AppText numberOfLines={1} style={{ flex: 1, color: visual.color, fontWeight: "600", fontSize: 10 }}>
            {visual.label}
          </AppText>
          <AppText style={{ color: theme.muted, fontSize: 10 }}>{notificationRelativeTime(item.createdAt, now)}</AppText>
          {!item.isRead ? <View style={[styles.dot, { backgroundColor: theme.brand }]} /> : null}
        </View>
        <AppText numberOfLines={2} style={{ color: theme.text, fontSize: 14, lineHeight: 20,
          fontWeight: item.isRead ? "600" : "800", marginTop: 4 }}>{item.title}</AppText>
        <AppText numberOfLines={2} style={{ color: theme.mode === "light" ? "#526077" : theme.muted,
          fontSize: 12, lineHeight: 18, marginTop: 4 }}>{body}</AppText>
        {visual.urgent ? <View style={[styles.badge, { backgroundColor: visual.background, marginTop: 7, alignSelf: "flex-start" }]}>
            <AppText style={{ color: visual.color, fontWeight: "600", fontSize: 10 }}>Cảnh báo quá hạn</AppText>
          </View> : null}
        {reference ? <View style={[styles.line, { marginTop: 7 }]}>
          <AppText numberOfLines={1} style={{ flex: 1, color: theme.muted, fontSize: 11 }}>
            {reference}
          </AppText>
          <ChevronRight size={14} color={theme.faint} />
        </View> : null}
      </View>
    </Pressable>
  );
}

export default memo(NotificationRow);

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: 7 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, flexShrink: 0 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
