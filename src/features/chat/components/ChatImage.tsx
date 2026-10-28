import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, useWindowDimensions, View } from "react-native"
import AppText from "@/components/AppText";
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
  const { width: screenWidth } = useWindowDimensions();
  const ratio = Number.isFinite(attachment.width) && Number.isFinite(attachment.height)
    && attachment.width > 0 && attachment.height > 0
    ? attachment.width / attachment.height : 4 / 3;
  // Keep the photo's actual proportions rather than a fixed box with empty side bands.
  const thumbnailWidth = Math.min(232, screenWidth * 0.65, 320 * ratio);
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
        width: full ? "100%" : thumbnailWidth,
        height: full ? "85%" : thumbnailWidth / ratio,
        maxWidth: "100%",
        backgroundColor: uri && !error ? "transparent" : theme.surfaceAlt,
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
        <AppText style={{ color: theme.danger, textAlign: "center", padding: 12 }}>
          Chưa tải được ảnh. Nhấn thử lại.
        </AppText>
      ) : (
        <View>
          <ActivityIndicator color={theme.brand} />
        </View>
      )}
    </Pressable>
  );
}
