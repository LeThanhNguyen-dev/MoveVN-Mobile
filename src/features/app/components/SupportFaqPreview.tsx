import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronDown, CircleHelp } from "lucide-react-native";
import AppText from "@/components/AppText";
import { getCmsPageBySlug } from "@/features/cms/services/cmsService";
import { htmlToText, parseCmsSections } from "@/features/cms/utils/content";
import type { CmsAccordionItem } from "@/features/cms/types";
import { useTheme } from "@/theme/useTheme";

export default function SupportFaqPreview({
  slug,
  onOpen,
}: {
  slug?: string;
  onOpen: (slug: string) => void;
}) {
  const { theme } = useTheme();
  const [items, setItems] = useState<CmsAccordionItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setExpanded(null);
    if (slug)
      void getCmsPageBySlug(slug)
        .then((page) => {
          if (cancelled || page?.contentType !== "FAQ") return;
          const questions = parseCmsSections(page.content)
            .flatMap((section) =>
              section.kind === "accordion"
                ? section.items
                : section.title && section.html.trim()
                  ? [
                      {
                        id: section.id,
                        title: section.title,
                        content: section.html,
                      },
                    ]
                  : [],
            )
            .slice(0, 3);
          setItems(questions);
        })
        .catch(() => {
          /* The topic cards remain available when this optional preview cannot load. */
        });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  if (!items.length || !slug) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.heading}>
        <AppText
          display
          style={{ fontSize: 18, fontWeight: "700", color: theme.text }}
        >
          Câu hỏi thường gặp
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(slug)}
          style={styles.link}
        >
          <AppText style={{ color: theme.brand, fontSize: 12 }}>
            Xem tất cả →
          </AppText>
        </Pressable>
      </View>
      {items.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: expanded === item.id }}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            style={styles.question}
          >
            <CircleHelp size={17} color={theme.brand} />
            <AppText
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: "700",
                color: theme.text,
              }}
            >
              {item.title}
            </AppText>
            <ChevronDown
              color={theme.text}
              size={17}
              style={{
                transform: [
                  { rotate: expanded === item.id ? "180deg" : "0deg" },
                ],
              }}
            />
          </Pressable>
          {expanded === item.id && (
            <AppText
              style={{
                paddingHorizontal: 16,
                paddingBottom: 14,
                color: theme.muted,
                fontSize: 13,
                lineHeight: 21,
              }}
            >
              {htmlToText(item.content)}
            </AppText>
          )}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  link: { minHeight: 44, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 14 },
  question: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    padding: 14,
  },
});
