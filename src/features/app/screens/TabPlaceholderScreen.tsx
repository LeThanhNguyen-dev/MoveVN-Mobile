import type { ComponentType } from "react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PlaceholderIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export default function TabPlaceholderScreen({
  description,
  icon: Icon,
  title,
  footer,
}: {
  description: string;
  footer?: ReactNode;
  icon: PlaceholderIcon;
  title: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.content}>
      <View style={styles.iconWrap}>
        <Icon color={theme.brand} size={30} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.brandSoft,
  },
  title: {
    color: theme.text,
    fontSize: 27,
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
  footer: {
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
});
