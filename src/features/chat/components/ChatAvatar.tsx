import { memo, useEffect, useState } from "react";
import { Image } from "expo-image";
import { View } from "react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";

function ChatAvatar({ name, uri, size = 48, online }: {
  name: string;
  uri?: string | null;
  size?: number;
  online?: boolean;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const initials = name.trim().split(/\s+/).slice(-2)
    .map((part) => part.charAt(0)).join("").toUpperCase() || "?";
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2,
        overflow: "hidden", backgroundColor: theme.brandSoft,
        alignItems: "center", justifyContent: "center" }}>
        {uri && !failed ? (
          <Image source={{ uri }} contentFit="cover" recyclingKey={uri}
            onError={() => setFailed(true)} accessibilityLabel={`Ảnh đại diện ${name}`}
            style={{ width: size, height: size }} />
        ) : (
          <AppText style={{ color: theme.brand, fontSize: size * 0.32, fontWeight: "700" }}>
            {initials}
          </AppText>
        )}
      </View>
      {online !== undefined ? (
        <View style={{ position: "absolute", right: 0, bottom: 0,
          width: size > 40 ? 13 : 11, height: size > 40 ? 13 : 11,
          borderRadius: 8, borderWidth: 2, borderColor: theme.surface,
          backgroundColor: online ? theme.success : theme.faint }} />
      ) : null}
    </View>
  );
}

export default memo(ChatAvatar);
