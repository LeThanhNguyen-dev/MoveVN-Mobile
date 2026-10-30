import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type ProfileAvatarProps = {
  avatarUrl?: string | null;
  fullName?: string | null;
  size?: number;
};

/** Avatar + chữ cái đầu khi không có ảnh (mirror web UserAvatar). */
function ProfileAvatar({ avatarUrl, fullName, size = 72 }: ProfileAvatarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const initial = (fullName ?? "?").trim().charAt(0).toUpperCase() || "?";
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (!avatarUrl) {
    return (
      <View style={[styles.fallback, dimension]}>
        <AppText style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{initial}</AppText>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: avatarUrl }}
      style={[styles.image, dimension]}
      contentFit="cover"
      transition={150}
      accessibilityLabel={fullName ?? "Avatar"}
    />
  );
}

export default memo(ProfileAvatar);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    image: { backgroundColor: theme.surfaceAlt },
    fallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    initial: { color: theme.brand, fontWeight: "900" },
  });
