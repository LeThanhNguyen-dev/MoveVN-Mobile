import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, RefreshCw } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PolicyDetailScreen from "@/features/cms/screens/PolicyDetailScreen";
import { getCmsPageNavigation } from "@/features/cms/services/cmsService";
import type { CmsPageNavigationItem } from "@/features/cms/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PolicyListScreenProps = {
  onBack: () => void;
  initialSlug?: string;
};

export default function PolicyListScreen({ onBack, initialSlug }: PolicyListScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<CmsPageNavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setItems(await getCmsPageNavigation());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (selectedSlug) {
    return <PolicyDetailScreen slug={selectedSlug} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Điều khoản & Chính sách</Text>
        <Pressable
          accessibilityLabel="Tải lại"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => { void load(); }}
          style={styles.backButton}
        >
          <RefreshCw color={theme.brand} size={19} strokeWidth={2.3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Đang tải danh sách...</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Chưa có nội dung điều khoản.</Text>
          </View>
        ) : (
          <View style={styles.menuCard}>
            {items.map((item, index) => (
              <Pressable
                key={item.slug}
                accessibilityRole="button"
                onPress={() => setSelectedSlug(item.slug)}
                style={[styles.menuRow, index < items.length - 1 && styles.menuDivider]}
              >
                <View style={styles.menuIcon}>
                  <FileText color={theme.brand} size={20} strokeWidth={2.3} />
                </View>
                <View style={styles.menuContent}>
                  <Text numberOfLines={2} style={styles.menuLabel}>
                    {item.title}
                  </Text>
                </View>
                <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
    },
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
    menuCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    menuRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    menuDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    menuIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    menuContent: { minWidth: 0, flex: 1 },
    menuLabel: { color: theme.text, fontSize: 14, fontWeight: "700" },
  });
