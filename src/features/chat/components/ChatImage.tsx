import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getChatImageData } from "../chatService";
import type { ChatAttachment } from "../types";

export default function ChatImage({
  roomId,
  messageId,
  index,
  attachment,
  onOpen,
  full = false,
}: {
  roomId: string;
  messageId: string;
  index: number;
  attachment: ChatAttachment;
  onOpen?: () => void;
  full?: boolean;
}) {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setUri(null);
    setError(false);
    void getChatImageData(roomId, messageId, index, attachment, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setUri(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [roomId, messageId, index, attachment.contentType, retry]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        error ? `Tải lại ảnh ${attachment.name}` : `Xem ảnh ${attachment.name}`
      }
      onPress={() => {
        if (error) setRetry((value) => value + 1);
        else if (uri) onOpen?.();
      }}
      style={{
        width: full ? "100%" : 180,
        height: full ? "85%" : 150,
        maxWidth: "100%",
        backgroundColor: theme.surfaceAlt,
        borderRadius: 12,
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri && !error ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : error ? (
        <Text style={{ color: theme.danger, textAlign: "center", padding: 12 }}>
          Chưa tải được ảnh. Nhấn thử lại.
        </Text>
      ) : (
        <View>
          <ActivityIndicator color={theme.brand} />
        </View>
      )}
    </Pressable>
  );
}
