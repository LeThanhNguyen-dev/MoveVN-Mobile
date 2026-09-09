import type { ComponentType } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  return (
    <View style={styles.content}>
      <View style={styles.iconWrap}>
        <Icon color="#6B19FF" size={30} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#F1E7FF",
  },
  title: {
    color: "#101936",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "#746F7E",
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
