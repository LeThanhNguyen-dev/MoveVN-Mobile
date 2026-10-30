import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { detailFont, useDetailTheme } from "./detailTheme";

type Tone = "brand" | "mint" | "amber";

export default function DetailSectionHeader({
  icon: Icon,
  title,
  tone = "brand",
  actionLabel,
  actionAccessibilityLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  tone?: Tone;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
}) {
  const { p } = useDetailTheme();
  const tint = tone === "mint" ? p.mint : tone === "amber" ? p.rating : p.brand;
  const tintSoft = tone === "mint" ? p.mintSoft : tone === "amber" ? p.ratingSoft : p.brandSoft;

  return (
    <View style={styles.row}>
      <View style={[styles.medal, { backgroundColor: tintSoft }]}>
        <Icon color={tint} size={17} strokeWidth={2} />
      </View>
      <AppText style={[styles.title, { color: p.ink }]} numberOfLines={1}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <AppText style={[styles.actionText, { color: p.brand }]}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  medal: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: detailFont.display, fontSize: 15.5, lineHeight: 20, letterSpacing: -0.1 },
  action: { minHeight: 32, justifyContent: "center", paddingLeft: 8 },
  actionText: { fontFamily: detailFont.bold, fontSize: 11.5 },
  pressed: { opacity: 0.6 },
});
