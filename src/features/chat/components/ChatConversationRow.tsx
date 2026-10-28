import { Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import { chatCounterpart, chatTime } from "../chatPresentation";
import { useChatPresence } from "../useChatPresence";
import type { ChatRoom } from "../types";
import ChatAvatar from "./ChatAvatar";

export default function ChatConversationRow({ room, userId, onOpen }: {
  room: ChatRoom;
  userId: number;
  onOpen: (roomId: string) => void;
}) {
  const { theme } = useTheme();
  const person = chatCounterpart(room, userId);
  const presence = useChatPresence(person);
  const unread = room.unreadCount > 0;
  const preview = room.lastMessage
    ? `${Number(room.lastMessage.senderId) === Number(userId) ? "Bạn: " : ""}${room.lastMessage.text || "Đã gửi ảnh"}`
    : "Bắt đầu trò chuyện";

  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={`${person.name}, ${presence.label}, ${room.bookingCode}, ${room.unreadCount} chưa đọc`}
      onPress={() => onOpen(room.id)}
      style={({ pressed }) => [styles.container, {
        backgroundColor: pressed ? theme.brandSoft : theme.surface,
        borderBottomColor: theme.divider,
      }]}>
      <ChatAvatar name={person.name} uri={person.avatarUrl} online={presence.isOnline} size={50} />
      <View style={styles.body}>
        <View style={styles.row}>
          <AppText numberOfLines={1} style={{ flex: 1, color: theme.text,
            fontSize: 15, fontWeight: unread ? "800" : "600" }}>{person.name}</AppText>
          {room.lastMessage ? <AppText style={{ color: unread ? theme.brand : theme.muted, fontSize: 10 }}>
            {chatTime(room.lastMessage.sentAt)}
          </AppText> : null}
        </View>
        <AppText numberOfLines={1} style={{ color: presence.isOnline ? theme.success : theme.muted, fontSize: 11 }}>
          {presence.label}
        </AppText>
        <View style={styles.row}>
          <AppText numberOfLines={1} style={{ flex: 1, color: unread ? theme.text : theme.muted,
            fontWeight: unread ? "600" : "400", fontSize: 13 }}>{preview}</AppText>
          {unread ? <View style={[styles.unread, { backgroundColor: theme.brand }]}>
            <AppText style={{ color: theme.onBrand, fontSize: 10, fontWeight: "700" }}>
              {room.unreadCount > 99 ? "99+" : room.unreadCount}
            </AppText>
          </View> : null}
        </View>
        <AppText numberOfLines={1} style={{ color: theme.brand, fontSize: 10, marginTop: 2 }}>
          {room.bookingCode} · {room.vehicleName || "Đơn thuê xe"}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, minWidth: 0, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  unread: { minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center" },
});
