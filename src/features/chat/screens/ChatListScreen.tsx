import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
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
      <View
        style={{
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 25 }}>
            Tin nhắn
          </Text>
          <Text style={{ color: theme.muted, marginTop: 4 }}>
            Trao đổi theo từng booking
          </Text>
        </View>
        <NotificationBell />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới danh sách chat"
          disabled={state.roomsLoading}
          onPress={() => {
            void refreshChatRooms();
          }}
          style={{ padding: 10 }}
        >
          <RefreshCw size={21} color={theme.brand} />
        </Pressable>
      </View>
      <TextInput
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
        <Text
          accessibilityRole="alert"
          style={{
            color: theme.danger,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          {state.roomsError}
        </Text>
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
            <View style={{ alignItems: "center", padding: 36, gap: 12 }}>
              <MessageSquare size={36} color={theme.muted} />
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {query ? "Không tìm thấy booking" : "Chưa có cuộc trò chuyện"}
              </Text>
              <Text style={{ color: theme.muted, textAlign: "center" }}>
                Mở chi tiết chuyến đi hoặc đơn thuê và chọn Nhắn tin để bắt đầu.
              </Text>
            </View>
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
              <View
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: theme.brandSoft,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={22} color={theme.brand} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.text,
                    fontSize: 16,
                    fontWeight: room.unreadCount ? "800" : "600",
                  }}
                >
                  {person.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.brand, fontSize: 11 }}
                >
                  {room.bookingCode} · {room.vehicleName || "Đơn thuê xe"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: theme.muted, fontSize: 13 }}
                >
                  {room.lastMessage?.text || "Bắt đầu trò chuyện"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <Text style={{ color: theme.muted, fontSize: 10 }}>
                  {room.lastMessage ? chatTime(room.lastMessage.sentAt) : ""}
                </Text>
                {room.unreadCount > 0 ? (
                  <View
                    style={{
                      backgroundColor: theme.brand,
                      borderRadius: 12,
                      minWidth: 22,
                      padding: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.onBrand,
                        fontSize: 11,
                        textAlign: "center",
                        fontWeight: "700",
                      }}
                    >
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </Text>
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
