import AppScreenHeader from "@/components/ui/AppScreenHeader";
import AppAvatar from "@/components/ui/AppAvatar";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppInput from "@/components/ui/AppInput";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { MessageSquare, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { refreshChatRooms } from "../chatActions";
import {
  chatCounterpart,
  chatTime,
  normalizeChatSearch,
} from "../chatPresentation";
import { useChatStore } from "../useChat";
import NotificationBell from "@/features/notifications/components/NotificationBell";

export default function ChatListScreen({
  onOpen,
}: {
  onOpen: (roomId: string) => void;
}) {
  const state = useChatStore();
  const userId = useAuthStore((auth) => auth.user?.userId ?? 0);
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  useEffect(() => {
    void refreshChatRooms();
  }, []);
  const rooms = state.rooms.filter((room) =>
    normalizeChatSearch(
      `${chatCounterpart(room, userId).name} ${room.bookingCode} ${room.vehicleName ?? ""}`,
    ).includes(normalizeChatSearch(query.trim())),
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppScreenHeader title="Tin nhắn" subtitle="Trao đổi theo từng chuyến thuê" actions={<NotificationBell />} onRefresh={() => { void refreshChatRooms(); }} refreshLabel="Làm mới danh sách chat" busy={state.roomsLoading} />
      <AppInput
        accessibilityLabel="Tìm booking hoặc người trò chuyện"
        value={query}
        onChangeText={setQuery}
        placeholder="Tên, mã booking hoặc xe…"
        placeholderTextColor={theme.placeholder}
        style={{
          color: theme.text,
          backgroundColor: theme.input,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 12,
        }}
      />
      {state.roomsError ? (
        <AppText
          accessibilityRole="alert"
          style={{
            color: theme.danger,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          {state.roomsError}
        </AppText>
      ) : null}
      {state.roomsLoading && !state.roomsLoaded ? (
        <ActivityIndicator color={theme.brand} style={{ padding: 24 }} />
      ) : null}
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={state.roomsLoading && state.roomsLoaded}
            onRefresh={() => {
              void refreshChatRooms();
            }}
            tintColor={theme.brand}
          />
        }
        ListEmptyComponent={
          !state.roomsLoading && !state.roomsError ? (
            <AppEmptyState icon={<MessageSquare size={28} color={theme.brand} />}
              title={query ? "Không tìm thấy booking" : "Chưa có cuộc trò chuyện"}
              description="Mở chi tiết chuyến đi hoặc đơn thuê và chọn Nhắn tin để bắt đầu." />
          ) : null
        }
        renderItem={({ item: room }) => {
          const person = chatCounterpart(room, userId);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${person.name}, ${room.bookingCode}, ${room.unreadCount} chưa đọc`}
              onPress={() => onOpen(room.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginHorizontal: 12,
                marginBottom: 8,
                padding: 14,
                borderRadius: 16,
                backgroundColor: room.unreadCount
                  ? theme.brandSoft
                  : theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <AppAvatar name={person.name} uri={room.participants.find(p => Number(p.userId) === Number(person.id))?.avatarUrl} online={person.isOnline} size={48} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText
                  numberOfLines={1}
                  style={{
                    color: theme.text,
                    fontSize: 16,
                    fontWeight: room.unreadCount ? "800" : "600",
                  }}
                >
                  {person.name}
                </AppText>
                <AppText
                  numberOfLines={1}
                  style={{ color: theme.brand, fontSize: 11 }}
                >
                  {room.bookingCode} · {room.vehicleName || "Đơn thuê xe"}
                </AppText>
                <AppText
                  numberOfLines={1}
                  style={{ color: theme.muted, fontSize: 13 }}
                >
                  {room.lastMessage?.text || "Bắt đầu trò chuyện"}
                </AppText>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <AppText style={{ color: theme.muted, fontSize: 10 }}>
                  {room.lastMessage ? chatTime(room.lastMessage.sentAt) : ""}
                </AppText>
                {room.unreadCount > 0 ? (
                  <View
                    style={{
                      backgroundColor: theme.brandSolid,
                      borderRadius: 12,
                      minWidth: 22,
                      padding: 4,
                    }}
                  >
                    <AppText
                      style={{
                        color: theme.onBrand,
                        fontSize: 11,
                        textAlign: "center",
                        fontWeight: "700",
                      }}
                    >
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
