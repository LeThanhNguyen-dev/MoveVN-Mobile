import AppSegmentedControl from "@/components/ui/AppSegmentedControl";
import AppScreenHeader from "@/components/ui/AppScreenHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  BookOpen,
  CarFront,
  CalendarCheck,
  CreditCard,
  Headphones,
  Mail,
  Phone,
  Search,
  X,
} from "lucide-react-native";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import AppText from "@/components/AppText";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import FaqDetailScreen from "@/features/cms/screens/FaqDetailScreen";
import { getCmsPageNavigation } from "@/features/cms/services/cmsService";
import type { CmsPageNavigationItem } from "@/features/cms/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { openSupportTickets } from "@/features/supportTickets/ticketNavigation";
import { TicketButton } from "@/features/supportTickets/TicketUi";
import BrandButton from "@/components/ui/BrandButton";
import SupportFaqPreview from "../components/SupportFaqPreview";
import { fontFamilyForWeight } from "@/theme/typography";

type FaqTab = "CUSTOMER" | "OWNER";

const TABS: Array<{ value: FaqTab; label: string }> = [
  { value: "CUSTOMER", label: "Khách thuê" },
  { value: "OWNER", label: "Chủ xe" },
];

// Verified in MoveVN-FrontEnd: PublicLayout footer (tel:19006868) and
// PromoTrapezoids ("hotline 1900 6868", mailto:support@movevn.com).
const HOTLINE_DISPLAY = "1900 6868";
const HOTLINE_URL = "tel:19006868";
const SUPPORT_EMAIL = "support@movevn.com";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function SupportCenterScreen({
  onBack,
  onBecomeOwner,
  embedded = false,
}: {
  onBack: () => void;
  onBecomeOwner?: () => void;
  embedded?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeRole = useAuthStore((state) => state.activeRole);

  const [tab, setTab] = useState<FaqTab>(
    activeRole === "Owner" ? "OWNER" : "CUSTOMER",
  );
  const [topics, setTopics] = useState<CmsPageNavigationItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async (category: FaqTab) => {
    const id = ++request.current;
    setStatus("loading");
    try {
      const result = await getCmsPageNavigation("FAQ", category);
      if (id !== request.current) return;
      setTopics(result);
      setStatus("ready");
    } catch {
      if (id === request.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load(tab === "OWNER" ? "OWNER" : "CUSTOMER");
    return () => {
      request.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTab(next: FaqTab) {
    if (next === tab) return;
    setTab(next);
    setTopics([]);
    setQuery("");
    setStatus("loading");
    void load(next);
  }

  // Backend has no FAQ search endpoint (admin list is the only keyword
  // filter), so search filters the already-loaded navigation items locally.
  const filtered = useMemo(() => {
    const keyword = normalizeText(query.trim());
    if (!keyword) return topics;
    return topics.filter((topic) =>
      normalizeText(`${topic.title} ${topic.description ?? ""}`).includes(
        keyword,
      ),
    );
  }, [query, topics]);

  const searching = query.trim().length > 0;

  if (selectedSlug) {
    return (
      <FaqDetailScreen
        slug={selectedSlug}
        onBack={() => setSelectedSlug(null)}
      />
    );
  }

  return (
    <View style={styles.content}>
      {!embedded && <AppScreenHeader title="Hỏi và trả lời" onBack={onBack} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <AppText style={styles.eyebrow}>TRUNG TÂM HỖ TRỢ</AppText>
          <AppText display style={styles.heroTitle}>
            Mình có thể giúp gì?
          </AppText>
        </View>

        <View
          style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}
        >
          <Search color={theme.faint} size={19} strokeWidth={2.3} />
          <TextInput
            accessibilityLabel="Tìm kiếm chủ đề trợ giúp"
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder="Tìm câu hỏi hoặc từ khóa..."
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Xóa tìm kiếm"
              accessibilityRole="button"
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <X color={theme.muted} size={17} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        <AppSegmentedControl value={tab} onChange={switchTab} items={TABS} />

        <View style={styles.sectionHeader}>
          <AppText display style={styles.sectionTitle}>
            Danh mục trợ giúp
          </AppText>
          {status === "ready" ? (
            <AppText style={styles.sectionCount}>
              {searching
                ? `${filtered.length} kết quả`
                : `${topics.length} chủ đề`}
            </AppText>
          ) : null}
        </View>

        {status === "loading" ? (
          <View style={styles.stateCard}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
            <AppText style={styles.muted}>Đang tải danh mục...</AppText>
          </View>
        ) : status === "error" ? (
          <View style={styles.stateCard}>
            <AppText style={styles.errorText}>
              Không thể tải danh mục hỏi đáp. Vui lòng thử lại.
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void load(tab);
              }}
              style={styles.retryButton}
            >
              <AppText style={styles.retryText}>Thử lại</AppText>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <AppText display style={styles.stateTitle}>
              {searching
                ? "Không tìm thấy chủ đề phù hợp"
                : "Chưa có nội dung hỏi đáp"}
            </AppText>
            <AppText style={styles.muted}>
              {searching
                ? "Thử từ khóa khác hoặc chuyển vai trò."
                : "Danh mục này đang được cập nhật. Vui lòng quay lại sau."}
            </AppText>
          </View>
        ) : (
          <View style={styles.topicList}>
            {filtered.map((topic) => {
              const slug = topic.slug;
              const Icon = /thanh-toan/.test(slug)
                ? CreditCard
                : /nhan-tra|quan-ly-don|dat-xe/.test(slug)
                  ? CalendarCheck
                  : /tim-va-thue|dang-xe|quan-ly-xe/.test(slug)
                    ? CarFront
                    : /bat-dau|tong-quan/.test(slug)
                      ? BookOpen
                      : CircleHelp;
              return (
                <Pressable
                  key={topic.slug}
                  accessibilityRole="button"
                  onPress={() => setSelectedSlug(topic.slug)}
                  style={styles.topicCard}
                >
                  <View style={styles.topicIcon}>
                    <Icon color={theme.brand} size={26} strokeWidth={1.8} />
                  </View>
                  <View style={styles.topicInfo}>
                    <AppText
                      display
                      numberOfLines={2}
                      style={styles.topicTitle}
                    >
                      {topic.title}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {status === "ready" && !searching && (
          <SupportFaqPreview slug={topics[0]?.slug} onOpen={setSelectedSlug} />
        )}

        <View style={styles.supportCard}>
          <View style={styles.supportIcon}>
            <Headphones color={theme.brand} size={22} strokeWidth={2.3} />
          </View>
          <AppText display style={styles.supportTitle}>
            Vẫn cần hỗ trợ?
          </AppText>
          <AppText style={styles.supportDescription}>
            Đội ngũ MoveVN luôn sẵn sàng giải đáp thắc mắc của bạn.
          </AppText>
          <BrandButton
            title="Liên hệ hỗ trợ"
            onPress={() => openSupportTickets({ create: true })}
          />
          <TicketButton
            secondary
            title="Xem yêu cầu hỗ trợ của tôi"
            onPress={() => openSupportTickets()}
          />
          <View style={styles.supportActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void Linking.openURL(HOTLINE_URL);
              }}
              style={styles.primaryButton}
            >
              <Phone color={theme.onBrand} size={17} strokeWidth={2.4} />
              <AppText
                style={styles.primaryButtonText}
              >{`Gọi ${HOTLINE_DISPLAY}`}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
              }}
              style={styles.secondaryButton}
            >
              <Mail color={theme.brand} size={17} strokeWidth={2.4} />
              <AppText style={styles.secondaryButtonText}>Gửi email</AppText>
            </Pressable>
          </View>
        </View>

        {tab === "CUSTOMER" && onBecomeOwner ? (
          <View style={styles.ownerCard}>
            <AppText display style={styles.ownerTitle}>
              Cho thuê xe trên MoveVN.
            </AppText>
            <AppText numberOfLines={2} style={styles.ownerDescription}>
              Đăng xe nhàn rỗi để gia tăng thu nhập hàng tháng với quy trình
              kiểm duyệt minh bạch.
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={onBecomeOwner}
              style={styles.ownerButton}
            >
              <AppText style={styles.ownerButtonText}>Dành cho chủ xe</AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 32,
      gap: 16,
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
    },
    hero: { gap: 8 },
    eyebrow: {
      color: theme.brand,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 2,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 27,
      lineHeight: 37,
      fontWeight: "700",
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
    },
    searchBoxFocused: { borderColor: theme.brand },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontFamily: fontFamilyForWeight("500"),
      paddingVertical: 12,
    },
    clearButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 4,
    },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    sectionCount: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    topicList: { gap: 12, flexDirection: "row", flexWrap: "wrap" },
    topicCard: {
      flexBasis: "46%",
      flexGrow: 1,
      minHeight: 112,
      alignItems: "center",
      gap: 12,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    topicIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    topicInfo: { minWidth: 0, gap: 4, width: "100%" },
    topicTitle: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      textAlign: "center",
    },
    stateCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    skeletonLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.surfaceAlt,
    },
    skeletonShort: { width: "55%" },
    stateTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "500",
    },
    errorText: {
      color: theme.danger,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
    },
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
    supportCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.brandSoft,
      padding: 16,
      gap: 10,
      marginTop: 6,
    },
    supportIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    supportTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    supportDescription: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "500",
    },
    supportActions: { flexDirection: "row", gap: 10, marginTop: 2 },
    primaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: theme.brandSolid,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonText: {
      color: theme.onBrand,
      fontSize: 14,
      fontWeight: "800",
    },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    secondaryButtonText: {
      color: theme.brand,
      fontSize: 14,
      fontWeight: "800",
    },
    ownerCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      padding: 16,
      gap: 8,
    },
    ownerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    ownerDescription: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "500",
    },
    ownerButton: {
      alignSelf: "flex-start",
      minHeight: 40,
      borderRadius: 10,
      backgroundColor: theme.brandSolid,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    ownerButtonText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
  });
