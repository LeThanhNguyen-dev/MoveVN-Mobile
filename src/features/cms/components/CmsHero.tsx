import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";

/**
 * Shared fallback banner, mirroring web `FALLBACK_BANNER = "/images/123.png"`.
 * Used whenever a CMS page has no `bannerImageUrl` of its own.
 */
export const CMS_FALLBACK_BANNER_IMAGE = require("../../../../public/images/123.png");

/**
 * Premium image hero for CMS detail pages: the page's own banner image as
 * background (cover, natural colors) with a bottom-weighted gradient overlay
 * for text contrast and the title left-aligned at the bottom.
 * Tapping the hero opens the fullscreen image viewer.
 */
export default function CmsHero({
  source,
  title,
  meta,
  onPress,
}: {
  source: ImageSource;
  title: string;
  meta?: string;
  onPress: () => void;
}) {
  const styles = useMemo(() => createStyles(), []);
  return (
    <Pressable
      accessibilityHint="Mở xem ảnh toàn màn hình"
      accessibilityLabel={`Xem ảnh: ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <View style={styles.hero}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={title}
          contentFit="cover"
          source={source}
          style={styles.image}
          transition={200}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.28)", "rgba(0,0,0,0.68)"]}
          locations={[0.3, 0.65, 1]}
          style={styles.overlay}
        />
        <View style={styles.textBlock}>
          <AppText display numberOfLines={3} style={styles.title}>
            {title}
          </AppText>
          {meta ? (
            <AppText numberOfLines={1} style={styles.meta}>
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressable: { borderRadius: 18 },
    pressed: { opacity: 0.96 },
    hero: {
      height: 220,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#1E1930",
      justifyContent: "flex-end",
    },
    image: { ...StyleSheet.absoluteFill },
    overlay: { ...StyleSheet.absoluteFill },
    textBlock: { gap: 6, paddingHorizontal: 18, paddingVertical: 16 },
    title: { color: "#FFFFFF", fontSize: 23, lineHeight: 30, fontWeight: "700" },
    meta: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  });
