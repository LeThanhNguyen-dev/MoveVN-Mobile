import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Search } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getChatImages, searchChatMessages } from "../chatService";
import { captureChatSession } from "../chatActions";
import ChatMessageCard, { type ChatPhoto } from "./ChatMessageCard";
import type { ChatMessage, PagedResult } from "../types";

export default function ChatTools({
  roomId,
  userId,
  mode,
  visible = true,
  onClose,
  onReply,
  onPhoto,
}: {
  roomId: string;
  userId: number;
  mode: "search" | "gallery";
  visible?: boolean;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onPhoto: (photo: ChatPhoto) => void;
}) {
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<ChatMessage> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResult(null);
    setError(null);
    if (mode === "search" && !keyword) return;
    const abort = new AbortController();
    const current = captureChatSession();
    setLoading(true);
    void (
      mode === "search"
        ? searchChatMessages(roomId, keyword, page, abort.signal)
        : getChatImages(roomId, page, abort.signal)
    )
      .then((data) => {
        if (!abort.signal.aborted && current()) setResult(data);
      })
      .catch((err) => {
        if (!abort.signal.aborted && current())
          setError(
            getApiErrorMessage(
              err,
              "Chưa tải được dữ liệu. Kiểm tra Backend đã cập nhật rồi thử lại.",
            ),
          );
      })
      .finally(() => {
        if (!abort.signal.aborted && current()) setLoading(false);
      });
    return () => abort.abort();
  }, [roomId, mode, keyword, page, retry]);
  const pages =
    result?.totalPages ??
    Math.ceil((result?.totalCount ?? 0) / (result?.pageSize || 20));
  function search() {
    if (input.trim().length > 120) {
      setError("Từ khóa tối đa 120 ký tự.");
      return;
    }
    setPage(1);
    setKeyword(input.trim());
    setRetry((value) => value + 1);
  }
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 12,
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng công cụ chat"
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <ArrowLeft color={theme.text} />
            </Pressable>
            <Text
              style={{
                color: theme.text,
                fontSize: 19,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {mode === "search" ? "Tìm trong booking" : "Ảnh của booking"}
            </Text>
          </View>
          {mode === "search" ? (
            <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
              <TextInput
                accessibilityLabel="Từ khóa tìm tin nhắn"
                value={input}
                onChangeText={setInput}
                maxLength={121}
                placeholder="Nội dung hoặc tên ảnh…"
                placeholderTextColor={theme.placeholder}
                onSubmitEditing={search}
                returnKeyType="search"
                style={{
                  flex: 1,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  color: theme.text,
                  backgroundColor: theme.input,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tìm tin nhắn"
                onPress={search}
                style={{
                  padding: 12,
                  backgroundColor: theme.brand,
                  borderRadius: 12,
                }}
              >
                <Search color={theme.onBrand} />
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <ActivityIndicator color={theme.brand} style={{ padding: 20 }} />
          ) : null}
          {error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thử lại công cụ chat"
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={{ padding: 16, color: theme.danger }}>
                {error} Nhấn thử lại.
              </Text>
            </Pressable>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {result ? (
              <Text style={{ color: theme.muted, paddingHorizontal: 16 }}>
                {result.totalCount} tin nhắn · Trang {page}/{Math.max(pages, 1)}
              </Text>
            ) : null}
            {!loading && !error && !result ? (
              <Text style={{ color: theme.muted, padding: 24 }}>
                Nhập từ khóa để tìm trong toàn bộ lịch sử booking.
              </Text>
            ) : null}
            {result?.items.length === 0 ? (
              <Text style={{ color: theme.muted, padding: 24 }}>
                {mode === "search"
                  ? "Không có tin nhắn phù hợp."
                  : "Booking này chưa có ảnh."}
              </Text>
            ) : null}
            {result?.items.map((message) => (
              <ChatMessageCard
                key={message.id}
                message={message}
                userId={userId}
                onPhoto={onPhoto}
                onReply={(entry) => {
                  onReply(entry);
                  onClose();
                }}
              />
            ))}
          </ScrollView>
          {pages > 1 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                padding: 16,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trang trước"
                disabled={page <= 1 || loading}
                onPress={() => setPage((value) => value - 1)}
                style={{ padding: 12, opacity: page <= 1 ? 0.4 : 1 }}
              >
                <Text style={{ color: theme.brand }}>Trang trước</Text>
              </Pressable>
              <Text style={{ color: theme.text, padding: 12 }}>
                {page}/{pages}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trang sau"
                disabled={page >= pages || loading}
                onPress={() => setPage((value) => value + 1)}
                style={{ padding: 12, opacity: page >= pages ? 0.4 : 1 }}
              >
                <Text style={{ color: theme.brand }}>Trang sau</Text>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
