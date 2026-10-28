import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { Reply } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { chatTime } from "../chatPresentation";
import ChatImage from "./ChatImage";
import ChatAvatar from "./ChatAvatar";
import type { ChatAttachment, ChatMessage } from "../types";

export interface ChatPhoto {
  roomId: string;
  messageId: string;
  index: number;
  attachment: ChatAttachment;
}

export default function ChatMessageCard({
  message,
  userId,
  senderAvatarUrl,
  onReply,
  onQuote,
  onPhoto,
}: {
  message: ChatMessage;
  userId: number;
  senderAvatarUrl?: string | null;
  onReply?: (message: ChatMessage) => void;
  onQuote?: (id: string) => void;
  onPhoto: (photo: ChatPhoto) => void;
}) {
  const { theme } = useTheme();
  const own = Number(message.senderId) === Number(userId);
  const hasImages = Boolean(message.attachments?.length);
  const foreground = own && !hasImages ? theme.onBrand : theme.text;
  return (
    <View style={[styles.row, { justifyContent: own ? "flex-end" : "flex-start" }]}>
      {!own ? <View style={{ paddingTop: 2 }}>
        <ChatAvatar name={message.senderName} uri={senderAvatarUrl} size={28} />
      </View> : null}
      <View style={{ maxWidth: own ? "85%" : "82%", minWidth: 0, alignItems: own ? "flex-end" : "flex-start" }}>
      {!own ? (
      <AppText
        style={{
          color: theme.muted,
          fontSize: 11,
          paddingHorizontal: 6,
          marginBottom: 4,
        }}
      >
        {message.senderName}
      </AppText>
      ) : null}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: hasImages ? "transparent" : own ? theme.brand : theme.surface,
            borderColor: hasImages ? "transparent" : own ? theme.brand : theme.border,
          },
          hasImages && styles.mediaBubble,
        ]}
      >
        {message.replyToId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem tin nhắn được trả lời"
            disabled={!message.replyTo || !onQuote}
            onPress={() => onQuote?.(message.replyToId!)}
            style={{
              borderLeftWidth: 3,
              borderLeftColor: own && !hasImages ? "#D9CCFF" : theme.brand,
              padding: 8,
              marginBottom: 8,
              backgroundColor: own && !hasImages ? "rgba(255,255,255,0.15)" : theme.brandSoft,
              borderRadius: 10,
            }}
          >
            <AppText
              style={{ color: foreground, fontWeight: "700", fontSize: 12 }}
            >
              {message.replyTo?.senderName ?? "Tin nhắn không còn khả dụng"}
            </AppText>
            <AppText numberOfLines={2} style={{ color: foreground, fontSize: 12 }}>
              {message.replyTo?.content ||
                (message.replyTo?.attachments?.length
                  ? `📷 ${message.replyTo.attachments.length} ảnh`
                  : "")}
            </AppText>
          </Pressable>
        ) : null}
        {message.attachments?.map((attachment, index) => (
          <View key={index} style={{ marginBottom: index < (message.attachments?.length ?? 0) - 1 ? 6 : 0 }}>
            <ChatImage
              roomId={message.roomId}
              messageId={message.id}
              index={index}
              attachment={attachment}
              onOpen={() =>
                onPhoto({
                  roomId: message.roomId,
                  messageId: message.id,
                  index,
                  attachment,
                })
              }
            />
          </View>
        ))}
        {message.content ? (
          <View style={hasImages ? {
            marginTop: 6, paddingHorizontal: 13, paddingVertical: 9,
            borderRadius: 16, backgroundColor: own ? theme.brand : theme.surface,
            borderWidth: own ? 0 : 1, borderColor: theme.border,
          } : undefined}>
          <AppText
            selectable
            style={{ color: own ? theme.onBrand : theme.text, fontSize: 15, lineHeight: 22 }}
          >
            {message.content}
          </AppText>
          </View>
        ) : null}
        {!message.content && !message.attachments?.length ? (
          <AppText style={{ color: foreground }}>Tin nhắn ảnh</AppText>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 6,
          flexWrap: "wrap",
        }}
      >
        <AppText style={{ color: theme.muted, fontSize: 10 }}>
          {chatTime(message.sentAt)}
          {own ? message.isRead ? " · Đã xem" : " · Đã gửi" : ""}
        </AppText>
        {onReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Trả lời tin nhắn ${message.id}`}
            onPress={() => onReply(message)}
            style={{ flexDirection: "row", gap: 4, paddingVertical: 8 }}
          >
            <Reply size={14} color={theme.brand} />
            <AppText style={{ color: theme.brand, fontSize: 11 }}>Trả lời</AppText>
          </Pressable>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 12, paddingVertical: 5 },
  bubble: { maxWidth: "100%", paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderRadius: 18 },
  mediaBubble: { padding: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0 },
});
