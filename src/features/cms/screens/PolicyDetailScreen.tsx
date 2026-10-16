import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageSource } from "expo-image";
import { ArrowLeft, ChevronDown } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import CmsHero, { CMS_FALLBACK_BANNER_IMAGE } from "@/features/cms/components/CmsHero";
import CmsHtmlView from "@/features/cms/components/CmsHtmlView";
import ImageViewer from "@/features/cms/components/ImageViewer";
import { getCmsPageBySlug } from "@/features/cms/services/cmsService";
import type { CmsPageResponse, CmsSection } from "@/features/cms/types";
import { parseCmsSections } from "@/features/cms/utils/content";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

export default function PolicyDetailScreen({
  onBack,
  slug,
  groupLabel,
}: {
  onBack: () => void;
  slug: string;
  groupLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [page, setPage] = useState<CmsPageResponse | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [viewerSource, setViewerSource] = useState<ImageSource | null>(null);

  const load = useCallback(async () => {
    setError("");
    setPage(undefined);
    try {
      setPage(await getCmsPageBySlug(slug.trim().toLowerCase()));
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
        <AppText display numberOfLines={1} style={styles.topBarTitle}>
          {groupLabel || "Điều khoản & Chính sách"}
        </AppText>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {page === undefined ? (
          <View style={styles.stateCard}>
            <AppText style={styles.muted}>Đang tải nội dung...</AppText>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <AppText style={styles.error}>{error}</AppText>
            <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retryButton}>
              <AppText style={styles.retryText}>Thử lại</AppText>
            </Pressable>
          </View>
        ) : page === null ? (
          <View style={styles.stateCard}>
            <AppText style={styles.muted}>Không tìm thấy nội dung.</AppText>
          </View>
        ) : (
          <>
            <CmsHero
              meta={updatedLabel ? `Cập nhật ${updatedLabel}` : undefined}
              onPress={() => setViewerSource(bannerSource)}
              source={bannerSource}
              title={page.title}
            />

            {sections.length === 0 ? (
              <View style={styles.stateCard}>
                <AppText style={styles.muted}>Nội dung đang được cập nhật.</AppText>
              </View>
            ) : (
              <View style={styles.body}>
                {sections.map((section, index) => (
                  <ReaderSection
                    key={section.id}
                    onImagePress={(url) => setViewerSource({ uri: url })}
                    section={section}
                    // First section opens by default (mirrors web accordion UX).
                    defaultExpanded={index === 0}
                  />
                ))}
              </View>
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

function ReaderSection({
  section,
  defaultExpanded,
  onImagePress,
}: {
  section: CmsSection;
  defaultExpanded: boolean;
  onImagePress: (url: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (section.kind === "accordion") {
    if (section.items.length === 0) return null;
    return (
      <View style={styles.section}>
        {section.title ? (
          <SectionToggle
            expanded={expanded}
            onToggle={() => setExpanded((current) => !current)}
            title={section.title}
          />
        ) : null}
        {expanded || !section.title ? section.items.map((item) => (
          <View key={item.id} style={styles.accordionItem}>
            {item.title ? <AppText display style={styles.subHeading}>{item.title}</AppText> : null}
            {item.content ? <CmsHtmlView fontSize={15} html={item.content} onImagePress={onImagePress} /> : null}
          </View>
        )) : null}
      </View>
    );
  }

  if (!section.html.trim()) return null;
  // Untitled single-page HTML has no header to tap, so it always shows.
  if (!section.title) {
    return (
      <View style={styles.section}>
        <CmsHtmlView fontSize={15} html={section.html} onImagePress={onImagePress} />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionToggle
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        title={section.title}
      />
      {expanded ? <CmsHtmlView fontSize={15} html={section.html} onImagePress={onImagePress} /> : null}
    </View>
  );
}

function SectionToggle({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={styles.toggleRow}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingAccent} />
        <AppText display style={styles.heading}>{title}</AppText>
      </View>
      <ChevronDown
        color={theme.muted}
        size={18}
        strokeWidth={2.4}
        style={expanded ? styles.chevronOpen : null}
      />
    </Pressable>
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
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 14 },
    stateCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    retryButton: {
      marginTop: 2,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    body: { gap: 20 },
    section: { gap: 10 },
    toggleRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headingRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
    headingAccent: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: theme.brand },
    heading: { flex: 1, minWidth: 0, color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    accordionItem: { gap: 8 },
    subHeading: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  });
