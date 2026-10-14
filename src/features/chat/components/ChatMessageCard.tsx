import { Pressable, StyleSheet, Text, View } from "react-native";
import { Reply } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { chatTime } from "../chatPresentation";
import ChatImage from "./ChatImage";
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
  onReply,
  onQuote,
  onPhoto,
}: {
  message: ChatMessage;
  userId: number;
  onReply?: (message: ChatMessage) => void;
  onQuote?: (id: string) => void;
  onPhoto: (photo: ChatPhoto) => void;
}) {
  const { theme } = useTheme();
  const own = Number(message.senderId) === Number(userId);
  const foreground = own ? theme.onBrand : theme.text;
  return (
    <View style={[styles.row, { alignItems: own ? "flex-end" : "flex-start" }]}>
      <Text
        style={{
          color: theme.muted,
          fontSize: 11,
          paddingHorizontal: 6,
          marginBottom: 4,
        }}
      >
        {message.senderName}
      </Text>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: own ? theme.brand : theme.surface,
            borderColor: own ? theme.brand : theme.border,
          },
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
              borderLeftColor: own ? "#D9CCFF" : theme.brand,
              padding: 8,
              marginBottom: 8,
              backgroundColor: own ? "rgba(255,255,255,0.15)" : theme.brandSoft,
              borderRadius: 4,
            }}
          >
            <Text
              style={{ color: foreground, fontWeight: "700", fontSize: 12 }}
            >
              {message.replyTo?.senderName ?? "Tin nhắn không còn khả dụng"}
            </Text>
            <Text numberOfLines={2} style={{ color: foreground, fontSize: 12 }}>
              {message.replyTo?.content ||
                (message.replyTo?.attachments?.length
                  ? `📷 ${message.replyTo.attachments.length} ảnh`
                  : "")}
            </Text>
          </Pressable>
        ) : null}
        {message.attachments?.map((attachment, index) => (
          <View key={index} style={{ marginBottom: 6 }}>
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
          <Text
            selectable
            style={{ color: foreground, fontSize: 15, lineHeight: 22 }}
          >
            {message.content}
          </Text>
        ) : null}
        {!message.content && !message.attachments?.length ? (
          <Text style={{ color: foreground }}>Tin nhắn ảnh</Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 6,
        }}
      >
        <Text style={{ color: theme.muted, fontSize: 10 }}>
          {chatTime(message.sentAt)}
          {own ? " · Đã gửi" : ""}
        </Text>
        {onReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Trả lời tin nhắn ${message.id}`}
            onPress={() => onReply(message)}
            style={{ flexDirection: "row", gap: 4, paddingVertical: 8 }}
          >
            <Reply size={14} color={theme.brand} />
            <Text style={{ color: theme.brand, fontSize: 11 }}>Trả lời</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 6 },
  bubble: { maxWidth: "85%", padding: 12, borderWidth: 1, borderRadius: 16 },
});
