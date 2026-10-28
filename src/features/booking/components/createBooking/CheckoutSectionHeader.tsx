import type { LucideIcon } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";

type Tone = "brand" | "mint" | "amber";

export default function CheckoutSectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "brand",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: Tone;
}) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const tint = tone === "mint" ? p.mint : tone === "amber" ? p.rating : p.brand;
  const tintSoft = tone === "mint" ? p.mintSoft : tone === "amber" ? p.ratingSoft : p.brandSoft;

  return (
    <View style={styles.row}>
      <View style={[styles.medal, { backgroundColor: tintSoft }]}>
        <Icon color={tint} size={17} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <AppText style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    medal: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, minWidth: 0 },
    title: { color: p.ink, fontFamily: checkoutFont.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
    subtitle: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10.5, lineHeight: 15, marginTop: 1 },
  });
