import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCmsPageBySlug } from "@/features/cms/services/cmsService";
import type { CmsPageResponse } from "@/features/cms/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type PolicyAccordionItem = {
  id: string;
  title: string;
  content: string;
};

export type PolicySection = {
  id: string;
  title: string;
  content: string[];
  items?: PolicyAccordionItem[];
};

function generateSectionId(title: string, fallback: number) {
  const base = title
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `section-${fallback}`;
}

function splitParagraphs(text: string): string[] {
  return String(text ?? "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSection(raw: unknown, ids: Set<string>, fallback: number): PolicySection | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = String(record.title ?? record.Title ?? "");
  let id = String(record.id ?? record.Id ?? "");
  if (!id || ids.has(id)) id = generateSectionId(title, fallback);
  ids.add(id);
  const type = String(record.type ?? "").toLowerCase();
  const items = record.items ?? record.Items;
  if ((type === "accordion" || (record.content == null && record.Content == null && Array.isArray(items))) && Array.isArray(items)) {
    const used = new Set<string>();
    const parsed = (items as unknown[])
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .map((it, index) => {
        let itemId = String(it.id ?? it.Id ?? "");
        if (!itemId || used.has(itemId)) itemId = `${id}-item-${index + 1}`;
        used.add(itemId);
        return { id: itemId, title: String(it.title ?? it.Title ?? `Mục ${index + 1}`), content: String(it.content ?? it.Content ?? "") };
      });
    return { id, title, content: [], items: parsed };
  }
  const rawContent = record.content ?? record.Content ?? [];
  const content = Array.isArray(rawContent)
    ? rawContent.map((line) => String(line ?? ""))
    : splitParagraphs(String(rawContent ?? ""));
  return { id, title, content };
}

export function parsePolicySections(content: string): PolicySection[] | null {
  try {
    const parsed: unknown = JSON.parse(content);
    const ids = new Set<string>();
    // Format mảng cũ: [{id,title,content:[]}].
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sections = parsed
        .map((item, index) => normalizeSection(item, ids, index + 1))
        .filter((s): s is PolicySection => s !== null);
      return sections.length > 0 ? sections : null;
    }
    // Format mới: {version,sections:[{id,type,title,content,items}]}.
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const nested = record.sections ?? record.Sections;
      if (Array.isArray(nested) && nested.length > 0) {
        const sections = nested
          .map((item, index) => normalizeSection(item, ids, index + 1))
          .filter((s): s is PolicySection => s !== null);
        return sections.length > 0 ? sections : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

export default function PolicyDetailScreen({ onBack, slug }: { onBack: () => void; slug: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [page, setPage] = useState<CmsPageResponse | null | undefined>(undefined);
  const [error, setError] = useState("");

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
    () => (page?.content ? parsePolicySections(page.content) : null),
    [page],
  );
  // JSON có cấu trúc nhưng không render được thì không in raw ra màn hình.
  const isStructuredJson = useMemo(() => {
    if (!page?.content || sections) return false;
    try {
      const parsed: unknown = JSON.parse(page.content);
      return parsed !== null && typeof parsed === "object";
    } catch {
      return false;
    }
  }, [page, sections]);
  const plainText = useMemo(
    () => (page?.content && !sections && !isStructuredJson ? htmlToText(page.content) : ""),
    [page, sections, isStructuredJson],
  );

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topBarTitle}>
          {page?.title || "Điều khoản & Chính sách"}
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
            <View style={styles.heading}>
              <Text style={styles.title}>{page.title}</Text>
              {formatDate(page.updatedAt) ? (
                <Text style={styles.updated}>Cập nhật lần cuối: {formatDate(page.updatedAt)}</Text>
              ) : null}
            </View>
            {sections && sections.length > 0
              ? sections.map((section) => (
                <View key={section.id} style={styles.card}>
                  {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
                  <View style={styles.sectionBody}>
                    {section.content.map((line, index) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <PolicyParagraph key={index} text={line} />
                    ))}
                  </View>
                  {section.items && section.items.length > 0 ? <PolicyAccordion items={section.items} /> : null}
                </View>
              ))
              : isStructuredJson ? (
                <View style={styles.card}>
                  <Text style={styles.muted}>Nội dung đang được cập nhật.</Text>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.paragraph}>{plainText}</Text>
                </View>
              )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PolicyAccordion({ items }: { items: PolicyAccordionItem[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  return (
    <View style={styles.accordion}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <View key={item.id} style={styles.accordionItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenId(open ? null : item.id)}
              style={[styles.accordionHeader, open && styles.accordionHeaderOpen]}
            >
              <Text style={[styles.accordionTitle, open && styles.accordionTitleOpen]}>{item.title}</Text>
              <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
                <ChevronDown color={open ? theme.brand : theme.muted} size={18} strokeWidth={2.4} />
              </View>
            </Pressable>
            {open ? (
              <View style={styles.accordionBody}>
                {splitParagraphs(item.content).map((line, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <PolicyParagraph key={index} text={line} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PolicyParagraph({ text }: { text: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!text.trim()) return <View style={styles.paragraphGap} />;
  if (text.startsWith("<")) {
    return <Text style={styles.paragraph}>{htmlToText(text)}</Text>;
  }
  if (text.startsWith("–") || text.startsWith("•") || text.startsWith("-")) {
    return <Text style={styles.bullet}>{`•  ${text.substring(text.startsWith("-") ? 1 : 2).trim()}`}</Text>;
  }
  return <Text style={styles.paragraph}>{text}</Text>;
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
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { flex: 1, color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
    },
    heading: { gap: 4, paddingTop: 2 },
    title: { color: theme.text, fontSize: 20, fontWeight: "800" },
    updated: { color: theme.muted, fontSize: 12, fontWeight: "600" },
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
    sectionBody: { gap: 8 },
    accordion: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    accordionItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
    accordionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    accordionHeaderOpen: { backgroundColor: theme.brandSoft },
    accordionTitle: { flex: 1, color: theme.text, fontSize: 13, fontWeight: "700" },
    accordionTitleOpen: { color: theme.brand },
    accordionBody: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
    paragraph: { color: theme.text, fontSize: 14, lineHeight: 22, fontWeight: "500" },
    bullet: { color: theme.text, fontSize: 14, lineHeight: 22, fontWeight: "500", paddingLeft: 4 },
    paragraphGap: { height: 4 },
  });
