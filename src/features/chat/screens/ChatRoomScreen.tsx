import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowDown,
  ArrowLeft,
  Camera,
  ImagePlus,
  Images,
  Search,
  Send,
  X,
} from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  captureChatSession,
  loadChatHistory,
  openChatRoom,
  readChatRoom,
  submitChatMessage,
} from "../chatActions";
import { getChatMessage } from "../chatService";
import { chatCounterpart } from "../chatPresentation";
import { pickChatImages } from "../chatImagePicker";
import { emptyDraft, emptyHistory, useChatStore as store } from "../useChat";
import ChatMessageCard, { type ChatPhoto } from "../components/ChatMessageCard";
import ChatImage from "../components/ChatImage";
import ChatTools from "../components/ChatTools";
import type { ChatMessage } from "../types";

export default function ChatRoomScreen({
  roomId: requestedRoomId,
  bookingId,
  onBack,
  onBookingPress,
}: {
  roomId?: string;
  bookingId?: number;
  onBack: () => void;
  onBookingPress: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  const userId = useAuthStore((auth) => auth.user?.userId ?? 0);
  const notificationOpen = useNotificationStore(
    (notifications) => notifications.centerOpen,
  );
  const state = store();
  const [roomId, setRoomId] = useState(requestedRoomId ?? "");
  const [opening, setOpening] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [tools, setTools] = useState<"search" | "gallery" | null>(null);
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [quote, setQuote] = useState<ChatMessage | null>(null);
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const focused = useRef(false);
  const quoteRequest = useRef<AbortController | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const input = useRef<TextInput>(null);
  const room = state.rooms.find((item) => item.id === roomId);
  const history = state.histories[roomId] ?? emptyHistory;
  const draft = state.drafts[roomId] ?? emptyDraft;
  const sending = state.sending[roomId];
  const person = room ? chatCounterpart(room, userId) : null;

  useEffect(() => {
    if (!focused.current) return;
    const paused = Boolean(
      tools || photo || quoteVisible || picking || notificationOpen,
    );
    store.setState({ readPaused: paused });
    if (!paused && history.page > 0) void readChatRoom(roomId);
  }, [
    tools,
    photo,
    quoteVisible,
    picking,
    notificationOpen,
    roomId,
    history.page,
  ]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      focused.current = true;
      setOpening(true);
      setOpenError(null);
      setTools(null);
      setPhoto(null);
      setQuoteVisible(false);
      void openChatRoom({ roomId: requestedRoomId, bookingId })
        .then((opened) => {
          if (!live) return;
          setRoomId(opened.id);
          store.setState({ activeRoomId: opened.id, readPaused: false });
          void loadChatHistory(opened.id);
          setOpening(false);
        })
        .catch((error) => {
          if (live) {
            setOpening(false);
            setOpenError(
              getApiErrorMessage(
                error,
                "Không mở được chat booking. Vui lòng thử lại.",
              ),
            );
          }
        });
      return () => {
        live = false;
        focused.current = false;
        quoteRequest.current?.abort();
        store.setState({ activeRoomId: null, readPaused: false });
      };
    }, [requestedRoomId, bookingId, retry, userId]),
  );

  function replyTo(message: ChatMessage) {
    if (message.roomId !== roomId || !room?.isActive || sending) return;
    store.getState().patchDraft(roomId, {
      reply: {
        id: message.id,
        senderName: message.senderName,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
      },
    });
    input.current?.focus();
  }

  async function pick(source: "library" | "camera") {
    if (picking || sending || !room?.isActive) return;
    const current = captureChatSession();
    const capturedRoom = roomId;
    setPicking(true);
    setPickerError(null);
    try {
      const selected = await pickChatImages(source, 4 - draft.images.length);
      if (
        !current() ||
        !focused.current ||
        store.getState().activeRoomId !== capturedRoom
      )
        return;
      const latest = store.getState().drafts[capturedRoom] ?? emptyDraft;
      if (latest.images.length + selected.length > 4)
        throw new Error("Mỗi tin nhắn chỉ gửi tối đa 4 ảnh.");
      if (selected.length)
        store.getState().patchDraft(capturedRoom, {
          images: [...latest.images, ...selected],
        });
    } catch (error) {
      if (current() && focused.current)
        setPickerError(
          error instanceof Error ? error.message : "Không chọn được ảnh.",
        );
    } finally {
      if (current()) setPicking(false);
    }
  }

  async function openQuote(id: string) {
    quoteRequest.current?.abort();
    const abort = new AbortController();
    quoteRequest.current = abort;
    const current = captureChatSession();
    setQuoteVisible(true);
    setQuote(null);
    setQuoteError(null);
    try {
      const message = await getChatMessage(roomId, id, abort.signal);
      if (!abort.signal.aborted && current() && focused.current)
        setQuote(message);
    } catch (error) {
      if (!abort.signal.aborted && current())
        setQuoteError(
          getApiErrorMessage(
            error,
            "Tin nhắn không còn khả dụng hoặc chưa tải được.",
          ),
        );
    }
  }

  const iconButton = (
    label: string,
    Icon: typeof Search,
    onPress: () => void,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.icon, disabled && styles.disabled]}
    >
      <Icon size={21} color={theme.brand} />
    </Pressable>
  );
  const notice = (message: string) => (
    <Text
      accessibilityRole="alert"
      style={{
        color: theme.danger,
        backgroundColor: theme.dangerSoft,
        padding: 10,
        fontSize: 12,
      }}
    >
      {message}
    </Text>
  );

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={onBack}
          style={styles.icon}
        >
          <ArrowLeft size={23} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: theme.text, fontSize: 17, fontWeight: "800" }}
          >
            {person?.name ?? "Chat booking"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem booking"
            disabled={!room}
            onPress={() => room && onBookingPress(room.bookingId)}
          >
            <Text
              numberOfLines={1}
              style={{ color: theme.brand, fontSize: 11, marginTop: 3 }}
            >
              {room?.bookingCode ?? "Đang mở…"} · Xem booking
            </Text>
          </Pressable>
        </View>
        {iconButton(
          "Tìm trong chat booking",
          Search,
          () => setTools("search"),
          !room,
        )}
        {iconButton(
          "Thư viện ảnh booking",
          Images,
          () => setTools("gallery"),
          !room,
        )}
      </View>
      {state.connectionStatus !== "connected" ? (
        <Text
          style={{
            color: theme.muted,
            fontSize: 11,
            textAlign: "center",
            padding: 5,
          }}
        >
          {state.connectionStatus === "connecting"
            ? "Đang kết nối tin nhắn…"
            : "Chưa có kết nối trực tiếp · Tự cập nhật mỗi 30 giây"}
        </Text>
      ) : null}
      {opening ? (
        <ActivityIndicator color={theme.brand} style={{ padding: 24 }} />
      ) : null}
      {openError ? (
        <View>
          {notice(openError)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử mở lại chat"
            onPress={() => setRetry((value) => value + 1)}
            style={{ padding: 16 }}
          >
            <Text style={{ color: theme.brand }}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      {!opening && room && !openError ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <FlatList
            ref={list}
            inverted
            data={[...history.items].reverse()}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={10}
            windowSize={5}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onScroll={(event) =>
              setAwayFromBottom(event.nativeEvent.contentOffset.y > 140)
            }
            scrollEventThrottle={100}
            renderItem={({ item }) => (
              <ChatMessageCard
                message={item}
                userId={userId}
                onPhoto={setPhoto}
                onQuote={(id) => {
                  void openQuote(id);
                }}
                onReply={room.isActive && !sending ? replyTo : undefined}
              />
            )}
            ListEmptyComponent={
              <View
                style={{
                  transform: [{ scaleY: -1 }],
                  padding: 32,
                  alignItems: "center",
                }}
              >
                {history.loading ? (
                  <ActivityIndicator color={theme.brand} />
                ) : !history.error ? (
                  <Text style={{ color: theme.muted }}>
                    Chưa có tin nhắn. Hãy bắt đầu trao đổi về booking này.
                  </Text>
                ) : null}
              </View>
            }
            ListFooterComponent={
              <View style={{ padding: 12 }}>
                {history.error ? (
                  <View>
                    {notice(history.error)}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Thử tải lại tin nhắn"
                      onPress={() => {
                        void loadChatHistory(
                          roomId,
                          history.page > 0 && history.page < history.totalPages,
                        );
                      }}
                      style={{ padding: 12 }}
                    >
                      <Text style={{ color: theme.brand }}>Thử lại</Text>
                    </Pressable>
                  </View>
                ) : null}
                {history.page > 0 && history.page < history.totalPages ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tải tin nhắn cũ"
                    disabled={history.loading}
                    onPress={() => {
                      void loadChatHistory(roomId, true);
                    }}
                    style={{ padding: 12, alignItems: "center" }}
                  >
                    {history.loading ? (
                      <ActivityIndicator color={theme.brand} />
                    ) : (
                      <Text style={{ color: theme.brand }}>
                        Tải tin nhắn cũ
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            }
          />
          {awayFromBottom ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đến tin nhắn mới nhất"
              onPress={() =>
                list.current?.scrollToOffset({ offset: 0, animated: true })
              }
              style={{
                alignSelf: "center",
                flexDirection: "row",
                gap: 8,
                padding: 8,
                backgroundColor: theme.brandSoft,
                borderRadius: 16,
              }}
            >
              <ArrowDown size={16} color={theme.brand} />
              <Text style={{ color: theme.brand }}>Tin mới nhất</Text>
            </Pressable>
          ) : null}
          {state.readErrors[roomId] ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thử đánh dấu chat đã đọc"
              onPress={() => {
                void readChatRoom(roomId);
              }}
            >
              {notice(state.readErrors[roomId]!)}
            </Pressable>
          ) : null}
          {room.isActive ? (
            <View
              style={[
                styles.composer,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            >
              {draft.reply ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: theme.brandSoft,
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.brand,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Trả lời {draft.reply.senderName}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ color: theme.text, fontSize: 12 }}
                    >
                      {draft.reply.content ||
                        `📷 ${draft.reply.attachments?.length ?? 1} ảnh`}
                    </Text>
                  </View>
                  {iconButton(
                    "Hủy trả lời",
                    X,
                    () =>
                      store.getState().patchDraft(roomId, { reply: undefined }),
                    Boolean(sending),
                  )}
                </View>
              ) : null}
              {draft.images.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: 90 }}
                >
                  {draft.images.map((image) => (
                    <View key={image.id} style={{ marginRight: 8 }}>
                      <Image
                        source={{ uri: image.uri }}
                        style={{ width: 76, height: 76, borderRadius: 10 }}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Bỏ ảnh ${image.name}`}
                        disabled={Boolean(sending)}
                        onPress={() =>
                          store.getState().patchDraft(roomId, {
                            images: draft.images.filter(
                              (entry) => entry.id !== image.id,
                            ),
                          })
                        }
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          backgroundColor: theme.surface,
                          padding: 4,
                          borderRadius: 12,
                        }}
                      >
                        <X size={15} color={theme.danger} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {pickerError ? notice(pickerError) : null}
              {state.sendErrors[roomId]
                ? notice(state.sendErrors[roomId]!)
                : null}
              {sending && draft.images.length ? (
                <Text style={{ color: theme.brand, fontSize: 12 }}>
                  {sending.progress >= 100
                    ? "Đang xử lý ảnh…"
                    : `Đang gửi ảnh ${sending.progress}%`}
                </Text>
              ) : null}
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}
              >
                {iconButton(
                  "Chọn ảnh",
                  ImagePlus,
                  () => {
                    void pick("library");
                  },
                  Boolean(sending) || picking || draft.images.length >= 4,
                )}
                {iconButton(
                  "Chụp ảnh",
                  Camera,
                  () => {
                    void pick("camera");
                  },
                  Boolean(sending) || picking || draft.images.length >= 4,
                )}
                <TextInput
                  ref={input}
                  accessibilityLabel="Nội dung tin nhắn"
                  multiline
                  maxLength={2001}
                  value={draft.content}
                  editable={!sending && !picking}
                  onChangeText={(content) =>
                    store.getState().patchDraft(roomId, { content })
                  }
                  placeholder="Nhập tin nhắn…"
                  placeholderTextColor={theme.placeholder}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 120,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: theme.input,
                    color: theme.text,
                    borderWidth: 1,
                    borderColor: theme.border,
                    fontSize: 15,
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gửi tin nhắn"
                  disabled={
                    Boolean(sending) ||
                    picking ||
                    (!draft.content.trim() && !draft.images.length)
                  }
                  onPress={() => {
                    void submitChatMessage(roomId).then((sent) => {
                      if (sent && focused.current)
                        list.current?.scrollToOffset({
                          offset: 0,
                          animated: true,
                        });
                    });
                  }}
                  style={[
                    styles.send,
                    { backgroundColor: theme.brand },
                    (sending ||
                      picking ||
                      (!draft.content.trim() && !draft.images.length)) &&
                      styles.disabled,
                  ]}
                >
                  {sending || picking ? (
                    <ActivityIndicator color={theme.onBrand} />
                  ) : (
                    <Send size={19} color={theme.onBrand} />
                  )}
                </Pressable>
              </View>
              {draft.content.length > 1800 ? (
                <Text
                  style={{
                    color:
                      draft.content.trim().length > 2000
                        ? theme.danger
                        : theme.muted,
                    fontSize: 11,
                    textAlign: "right",
                  }}
                >
                  {draft.content.length}/2000
                </Text>
              ) : null}
            </View>
          ) : (
            <Text
              style={{ color: theme.muted, padding: 16, textAlign: "center" }}
            >
              Cuộc trò chuyện đã đóng. Bạn vẫn có thể xem lịch sử.
            </Text>
          )}
        </KeyboardAvoidingView>
      ) : null}
      {tools && room ? (
        <ChatTools
          roomId={roomId}
          userId={userId}
          mode={tools}
          visible={!photo}
          onClose={() => setTools(null)}
          onReply={replyTo}
          onPhoto={setPhoto}
        />
      ) : null}
      {photo ? (
        <Modal
          visible
          animationType="fade"
          onRequestClose={() => setPhoto(null)}
        >
          <SafeAreaProvider>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: theme.background }}
            >
              <View style={styles.header}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng ảnh"
                  onPress={() => setPhoto(null)}
                  style={styles.icon}
                >
                  <ArrowLeft color={theme.text} />
                </Pressable>
                <Text numberOfLines={1} style={{ color: theme.text, flex: 1 }}>
                  {photo.attachment.name}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChatImage {...photo} full />
              </View>
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      ) : null}
      {quoteVisible ? (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => {
            quoteRequest.current?.abort();
            setQuoteVisible(false);
          }}
        >
          <SafeAreaProvider>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: theme.background }}
            >
              <View style={styles.header}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng tin nhắn gốc"
                  onPress={() => {
                    quoteRequest.current?.abort();
                    setQuoteVisible(false);
                  }}
                  style={styles.icon}
                >
                  <ArrowLeft color={theme.text} />
                </Pressable>
                <Text
                  style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}
                >
                  Tin nhắn gốc
                </Text>
              </View>
              <ScrollView>
                {quote ? (
                  <ChatMessageCard
                    message={quote}
                    userId={userId}
                    onPhoto={(value) => {
                      setQuoteVisible(false);
                      setPhoto(value);
                    }}
                    onReply={(value) => {
                      replyTo(value);
                      setQuoteVisible(false);
                    }}
                  />
                ) : quoteError ? (
                  notice(quoteError)
                ) : (
                  <ActivityIndicator
                    color={theme.brand}
                    style={{ padding: 24 }}
                  />
                )}
              </ScrollView>
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    padding: 10,
    minWidth: 40,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: { padding: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  send: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  disabled: { opacity: 0.4 },
});
