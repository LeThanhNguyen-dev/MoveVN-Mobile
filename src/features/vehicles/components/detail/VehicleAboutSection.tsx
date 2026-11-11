import { Info } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import DetailSectionHeader from "./DetailSectionHeader";
import { detailFont, useDetailTheme } from "./detailTheme";

export default function VehicleAboutSection({ description }: { description: string | null }) {
  const { t } = useTranslation();
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim() || "";
  const canExpand = text.length > 180;

  return (
    <View style={styles.section}>
      <DetailSectionHeader icon={Info} title={t("mobile:vehicleDetail.about.title")} />
      <AppText
        numberOfLines={canExpand && !expanded ? 4 : undefined}
        style={[styles.description, !text && { color: p.muted }]}
      >
        {text || t("mobile:vehicleDetail.about.empty")}
      </AppText>
      {canExpand ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <AppText style={styles.moreText}>
            {expanded ? t("common:tableCollapse") : t("mobile:vehicleDetail.about.showMore")}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    section: { marginTop: 20, marginHorizontal: 20 },
    description: {
      color: p.ink,
      fontFamily: detailFont.regular,
      fontSize: 12.5,
      lineHeight: 20,
      marginTop: 9,
    },
    more: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginTop: 2 },
    moreText: { color: p.brand, fontFamily: detailFont.bold, fontSize: 11.5 },
    pressed: { opacity: 0.6 },
  });
