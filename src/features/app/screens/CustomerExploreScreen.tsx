import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function CustomerExploreScreen({ onAvatarPress, user }: { onAvatarPress?: () => void; user: AuthUser }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.content}>
      <AppDashboardHeader onAvatarPress={onAvatarPress} user={user} />

      <View style={styles.placeholder}>
        <Text style={styles.title}>Khám phá</Text>
        <Text style={styles.description}>Nội dung tìm kiếm, gợi ý xe và xe nổi bật sẽ được phát triển ở màn này.</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 44,
  },
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 23,
    maxWidth: 305,
    textAlign: "center",
  },
});
