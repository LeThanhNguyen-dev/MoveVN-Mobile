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
import { MessageSquare, RefreshCw, Search } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { refreshChatRooms } from "../chatActions";
import {
  chatCounterpart,
  normalizeChatSearch,
} from "../chatPresentation";
import { useChatStore } from "../useChat";
import ChatConversationRow from "../components/ChatConversationRow";
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
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: theme.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText style={{ color: theme.text, fontWeight: "800", fontSize: 23 }}>
            Tin nhắn
          </AppText>
          <AppText style={{ color: theme.muted, marginTop: 4, fontSize: 12 }}>
            Trao đổi trong từng chuyến đi
          </AppText>
        </View>
        <NotificationBell />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới danh sách chat"
          disabled={state.roomsLoading}
          onPress={() => {
            void refreshChatRooms();
          }}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" }}
        >
          <RefreshCw size={19} color={theme.brand} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9,
        marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12,
        minHeight: 44, borderWidth: 1, borderColor: theme.border,
        borderRadius: 14, backgroundColor: theme.surface }}>
        <Search size={18} color={theme.muted} />
        <TextInput
          accessibilityLabel="Tìm người trò chuyện, mã đặt xe hoặc xe"
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm tên, mã đặt xe hoặc xe…"
          placeholderTextColor={theme.placeholder}
          returnKeyType="search"
          style={{ flex: 1, minWidth: 0, paddingVertical: 10, color: theme.text, fontSize: 14 }}
        />
      </View>
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
            <View style={{ alignItems: "center", padding: 36, gap: 12 }}>
              <MessageSquare size={36} color={theme.muted} />
              <AppText style={{ color: theme.text, fontWeight: "700" }}>
                {query ? "Không tìm thấy booking" : "Chưa có cuộc trò chuyện"}
              </AppText>
              <AppText style={{ color: theme.muted, textAlign: "center" }}>
                Mở chi tiết chuyến đi hoặc đơn thuê và chọn Nhắn tin để bắt đầu.
              </AppText>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <ChatConversationRow room={item} userId={userId} onOpen={onOpen} />
        )}
      />
    </View>
  );
}
