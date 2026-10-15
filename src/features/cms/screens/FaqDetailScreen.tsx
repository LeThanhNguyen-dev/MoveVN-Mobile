import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageSource } from "expo-image";
import { ArrowLeft, ChevronDown } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCmsPageBySlug } from "@/features/cms/services/cmsService";
import type { CmsPageResponse, CmsSection } from "@/features/cms/types";
import { htmlToText, parseCmsSections } from "@/features/cms/utils/content";
import CmsHero, { CMS_FALLBACK_BANNER_IMAGE } from "@/features/cms/components/CmsHero";
import CmsHtmlView from "@/features/cms/components/CmsHtmlView";
import ImageViewer from "@/features/cms/components/ImageViewer";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

export default function FaqDetailScreen({ onBack, slug }: { onBack: () => void; slug: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [page, setPage] = useState<CmsPageResponse | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [viewerSource, setViewerSource] = useState<ImageSource | null>(null);

  const load = useCallback(async () => {
    setError("");
    setPage(undefined);
    try {
      const data = await getCmsPageBySlug(slug.trim().toLowerCase());
      // Mirror web FaqDetailPage: only render pages actually typed as FAQ.
      setPage(data && data.contentType === "FAQ" ? data : null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tải được nội dung.");
      setPage(null);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => (page?.content ? parseCmsSections(page.content) : []),
    [page],
  );
  const updatedLabel = formatDate(page?.updatedAt);
  // Mirrors web FALLBACK_BANNER: pages without their own banner use 123.png.
  const bannerSource = useMemo(
    () => (page?.bannerImageUrl ? { uri: page.bannerImageUrl } : CMS_FALLBACK_BANNER_IMAGE),
    [page?.bannerImageUrl],
  );

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topBarTitle}>
          {page?.title || "Hỏi và trả lời"}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {page === undefined ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Đang tải nội dung...</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : page === null ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Không tìm thấy nội dung.</Text>
          </View>
        ) : (
          <>
            <CmsHero
              meta={updatedLabel ? `Cập nhật ${updatedLabel}` : undefined}
              onPress={() => setViewerSource(bannerSource)}
              source={bannerSource}
              title={page.title}
            />
            {page.description ? <Text style={styles.description}>{page.description}</Text> : null}
            {sections.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.muted}>Nội dung đang được cập nhật.</Text>
              </View>
            ) : (
              sections.map((section) => (
                <FaqSectionBlock
                  key={section.id}
                  onImagePress={(url) => setViewerSource({ uri: url })}
                  section={section}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <ImageViewer
        onClose={() => setViewerSource(null)}
        source={viewerSource}
        title={page?.title ?? ""}
      />
    </View>
  );
}

function FaqSectionBlock({
  section,
  onImagePress,
}: {
  section: CmsSection;
  onImagePress: (url: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expandedId, setExpandedId] = useState<string | null>(
    section.kind === "accordion" && section.items.length > 0 ? section.items[0]?.id ?? null : null,
  );

  if (section.kind === "accordion") {
    return (
      <View style={styles.card}>
        {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
        {section.items.map((item, index) => {
          const expanded = expandedId === item.id;
          return (
            <View key={item.id}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setExpandedId(expanded ? null : item.id)}
                style={styles.faqRow}
              >
                <Text style={styles.faqQuestion}>{item.title || `Câu hỏi ${index + 1}`}</Text>
                <ChevronDown
                  color={theme.muted}
                  size={18}
                  strokeWidth={2.3}
                  style={expanded ? styles.chevronOpen : null}
                />
              </Pressable>
              {expanded && item.content ? (
                <CmsHtmlView html={item.content} onImagePress={onImagePress} />
              ) : null}
              {index < section.items.length - 1 ? <View style={styles.faqDivider} /> : null}
            </View>
          );
        })}
      </View>
    );
  }

  const text = htmlToText(section.html);
  const hasImage = /<img[\s>]/i.test(section.html);
  if (!text && !hasImage) return null;
  return (
    <View style={styles.card}>
      {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
      <CmsHtmlView html={section.html} onImagePress={onImagePress} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { flex: 1, color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    description: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    muted: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    retryButton: {
      marginTop: 4,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    sectionTitle: { color: theme.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
    faqRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
    faqQuestion: { flex: 1, color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    faqDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  });
