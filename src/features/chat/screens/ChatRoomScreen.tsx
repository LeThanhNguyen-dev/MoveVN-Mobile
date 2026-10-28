import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowDown,
  ArrowLeft,
  Camera,
  ImagePlus,
  Images,
  MessageSquare,
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
import ChatAvatar from "../components/ChatAvatar";
import { useChatPresence } from "../useChatPresence";
import type { ChatMessage } from "../types";

export default function ChatRoomScreen({
  roomId: requestedRoomId,
  bookingId,
  onBack,
  onBookingPress,
  onOpenUserProfile,
}: {
  roomId?: string;
  bookingId?: number;
  onBack: () => void;
  onBookingPress: (bookingId: number) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
  const presence = useChatPresence(person);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    <AppText
      accessibilityRole="alert"
      style={{
        color: theme.danger,
        backgroundColor: theme.dangerSoft,
        padding: 10,
        fontSize: 12,
      }}
    >
      {message}
    </AppText>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <View style={[styles.header, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={onBack}
          style={styles.icon}
        >
          <ArrowLeft size={23} color={theme.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem hồ sơ ${person?.name ?? "người trò chuyện"}`}
          disabled={!onOpenUserProfile || !person?.id}
          onPress={() => person && onOpenUserProfile?.(person.id)}
        >
          <ChatAvatar name={person?.name ?? "Người trò chuyện"} uri={person?.avatarUrl}
            size={40} online={person ? presence.isOnline : undefined} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 5 }}>
          {onOpenUserProfile && person?.id ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Xem hồ sơ ${person?.name ?? ""}`}
              onPress={() => onOpenUserProfile(person!.id)}
              style={styles.personLink}
            >
              <AppText
                numberOfLines={1}
                style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}
              >
                {person?.name ?? "Chat booking"}
              </AppText>
            </Pressable>
          ) : (
            <AppText
              numberOfLines={1}
              style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}
            >
              {person?.name ?? "Chat booking"}
            </AppText>
          )}
          <AppText numberOfLines={1} style={{
            color: presence.isOnline ? theme.success : theme.muted,
            fontSize: 11, marginTop: 4,
          }}>{person ? presence.label : "Đang mở cuộc trò chuyện…"}</AppText>
        </View>
        {iconButton(
          "Tìm trong chat booking",
          Search,
          () => { Keyboard.dismiss(); setTools("search"); },
          !room,
        )}
        {iconButton(
          "Thư viện ảnh booking",
          Images,
          () => { Keyboard.dismiss(); setTools("gallery"); },
          !room,
        )}
      </View>
      {room ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Xem đơn thuê"
          onPress={() => { Keyboard.dismiss(); onBookingPress(room.bookingId); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 8,
            paddingHorizontal: 16, paddingVertical: 9,
            backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
          <AppText numberOfLines={1} style={{ color: theme.brand, fontWeight: "600", fontSize: 11 }}>
            {room.bookingCode}
          </AppText>
          <AppText numberOfLines={1} style={{ flex: 1, color: theme.muted, fontSize: 11 }}>
            {room.vehicleName || "Đơn thuê xe"}
          </AppText>
          <AppText style={{ color: theme.brand, fontSize: 11 }}>Xem đơn →</AppText>
        </Pressable>
      ) : null}
      {state.connectionStatus !== "connected" ? (
        <AppText
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
        </AppText>
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
            <AppText style={{ color: theme.brand }}>Thử lại</AppText>
          </Pressable>
        </View>
      ) : null}
      {!opening && room && !openError ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <FlatList
            ref={list}
            inverted
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={history.items.length
              ? { paddingVertical: 10 }
              : { flexGrow: 1, justifyContent: "center" }}
            data={[...history.items].reverse()}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onLayout={() => {
              if (!awayFromBottom) list.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
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
                senderAvatarUrl={room.participants.find((participant) => Number(participant.userId) === Number(item.senderId))?.avatarUrl}
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
                  gap: 12,
                }}
              >
                {history.loading ? (
                  <ActivityIndicator color={theme.brand} />
                ) : !history.error ? (
                  <>
                    <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: theme.brandSoft,
                      alignItems: "center", justifyContent: "center" }}>
                      <MessageSquare size={26} color={theme.brand} />
                    </View>
                    <AppText style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>Bắt đầu cuộc trò chuyện</AppText>
                    <AppText style={{ color: theme.muted, textAlign: "center", fontSize: 13, lineHeight: 20 }}>
                      Trao đổi về lịch nhận xe, địa điểm hoặc chuyến đi của bạn.
                    </AppText>
                  </>
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
                      <AppText style={{ color: theme.brand }}>Thử lại</AppText>
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
                      <AppText style={{ color: theme.brand }}>
                        Tải tin nhắn cũ
                      </AppText>
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
              <AppText style={{ color: theme.brand }}>Tin mới nhất</AppText>
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
                { borderColor: theme.border, backgroundColor: theme.surface,
                  paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) },
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
                    <AppText
                      style={{
                        color: theme.brand,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Trả lời {draft.reply.senderName}
                    </AppText>
                    <AppText
                      numberOfLines={2}
                      style={{ color: theme.text, fontSize: 12 }}
                    >
                      {draft.reply.content ||
                        `📷 ${draft.reply.attachments?.length ?? 1} ảnh`}
                    </AppText>
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
                <AppText style={{ color: theme.brand, fontSize: 12 }}>
                  {sending.progress >= 100
                    ? "Đang xử lý ảnh…"
                    : `Đang gửi ảnh ${sending.progress}%`}
                </AppText>
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
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderWidth: 1,
                    borderColor: theme.border,
                    fontSize: 15,
                    lineHeight: 21,
                    textAlignVertical: "top",
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
                <AppText
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
                </AppText>
              ) : null}
            </View>
          ) : (
            <AppText
              style={{ color: theme.muted, padding: 16,
                paddingBottom: Math.max(insets.bottom, 16), textAlign: "center" }}
            >
              Cuộc trò chuyện đã đóng. Bạn vẫn có thể xem lịch sử.
            </AppText>
          )}
        </View>
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
                <AppText numberOfLines={1} style={{ color: theme.text, flex: 1 }}>
                  {photo.attachment.name}
                </AppText>
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
                <AppText
                  style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}
                >
                  Tin nhắn gốc
                </AppText>
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
    </KeyboardAvoidingView>
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
    flexShrink: 0,
  },
  icon: {
    padding: 8,
    minWidth: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  personLink: { alignSelf: "flex-start" },
  composer: { padding: 8, gap: 8, flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth },
  send: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  disabled: { opacity: 0.4 },
});
