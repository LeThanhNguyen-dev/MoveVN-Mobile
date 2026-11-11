import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Headphones,
  Mail,
  Phone,
  Search,
  X,
} from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import FaqDetailScreen from "@/features/cms/screens/FaqDetailScreen";
import { getCmsPageNavigation } from "@/features/cms/services/cmsService";
import type { CmsPageNavigationItem } from "@/features/cms/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { openSupportTickets } from "@/features/supportTickets/ticketNavigation";
import { TicketButton } from "@/features/supportTickets/TicketUi";

type FaqTab = "CUSTOMER" | "OWNER";

// Same slug -> image mapping as MoveVN-FrontEnd FaqPage TOPIC_IMAGES.
// Customer topics (top to bottom) use 1.png - 6.png, owner topics use
// 7.png - 12.png. Unknown slugs fall back to the CircleHelp vector icon.
const TOPIC_IMAGES: Record<string, number> = {
  "bat-dau": require("../../../../public/images/1.png"),
  "bat-dau-v2": require("../../../../public/images/1.png"),
  "tim-va-thue-xe": require("../../../../public/images/2.png"),
  "tim-va-thue-xe-v2": require("../../../../public/images/2.png"),
  "dat-xe": require("../../../../public/images/3.png"),
  "dat-xe-v2": require("../../../../public/images/3.png"),
  "thanh-toan-khach": require("../../../../public/images/4.png"),
  "thanh-toan-khach-v2": require("../../../../public/images/4.png"),
  "nhan-tra-xe-khach": require("../../../../public/images/5.png"),
  "nhan-tra-xe-khach-v2": require("../../../../public/images/5.png"),
  "khi-co-van-de": require("../../../../public/images/6.png"),
  "khi-co-van-de-v2": require("../../../../public/images/6.png"),
  "tong-quan-chu-xe": require("../../../../public/images/7.png"),
  "tong-quan-chu-xe-v2": require("../../../../public/images/7.png"),
  "dang-xe": require("../../../../public/images/8.png"),
  "dang-xe-v2": require("../../../../public/images/8.png"),
  "quan-ly-xe": require("../../../../public/images/9.png"),
  "quan-ly-xe-v2": require("../../../../public/images/9.png"),
  "quan-ly-don-thue": require("../../../../public/images/10.png"),
  "quan-ly-don-thue-v2": require("../../../../public/images/10.png"),
  "nhan-tra-xe-chu-xe": require("../../../../public/images/11.png"),
  "nhan-tra-xe-chu-xe-v2": require("../../../../public/images/11.png"),
  "thanh-toan-chu-xe": require("../../../../public/images/12.png"),
  "thanh-toan-chu-xe-v2": require("../../../../public/images/12.png"),
};

const TABS: Array<{ value: FaqTab; labelKey: string }> = [
  { value: "CUSTOMER", labelKey: "faq:tabs.customer" },
  { value: "OWNER", labelKey: "faq:tabs.owner" },
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
}: {
  onBack: () => void;
  onBecomeOwner?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeRole = useAuthStore((state) => state.activeRole);

  const [tab, setTab] = useState<FaqTab>(activeRole === "Owner" ? "OWNER" : "CUSTOMER");
  const [topics, setTopics] = useState<CmsPageNavigationItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const load = useCallback(async (category: FaqTab) => {
    setStatus("loading");
    try {
      setTopics(await getCmsPageNavigation("FAQ", category));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load(tab === "OWNER" ? "OWNER" : "CUSTOMER");
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
      normalizeText(`${topic.title} ${topic.description ?? ""}`).includes(keyword),
    );
  }, [query, topics]);

  const searching = query.trim().length > 0;

  if (selectedSlug) {
    return <FaqDetailScreen slug={selectedSlug} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel={t("mobile:cms.a11y.back")} accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <AppText display style={styles.topBarTitle}>{t("faq:title")}</AppText>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <AppText style={styles.eyebrow}>{t("faq:eyebrow")}</AppText>
          <AppText display style={styles.heroTitle}>{t("mobile:cms.support.heroTitle")}</AppText>
          <AppText style={styles.heroDescription}>
            {t("faq:description")}
          </AppText>
        </View>

        <View style={{ gap: 10 }}><TicketButton title={t("mobile:cms.support.createRequest")} onPress={() => openSupportTickets({ create: true })} /><TicketButton secondary title={t("mobile:cms.support.viewRequests")} onPress={() => openSupportTickets()} /></View>

        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Search color={theme.faint} size={19} strokeWidth={2.3} />
          <TextInput
            accessibilityLabel={t("mobile:cms.support.searchAria")}
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder={t("mobile:cms.support.searchPlaceholder")}
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel={t("mobile:cms.searchClearAria")}
              accessibilityRole="button"
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <X color={theme.muted} size={17} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.segmented}>
          {TABS.map((item) => {
            const selected = tab === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => switchTab(item.value)}
                style={[styles.segmentOption, selected && styles.segmentOptionSelected]}
              >
                <AppText style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{t(item.labelKey)}</AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <AppText display style={styles.sectionTitle}>{t("mobile:cms.support.sectionTitle")}</AppText>
          {status === "ready" ? (
            <AppText style={styles.sectionCount}>
              {searching
                ? t("mobile:cms.resultCount", { count: filtered.length })
                : t("mobile:cms.support.topicCount", { count: topics.length })}
            </AppText>
          ) : null}
        </View>

        {status === "loading" ? (
          <View style={styles.stateCard}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
            <AppText style={styles.muted}>{t("mobile:cms.support.loading")}</AppText>
          </View>
        ) : status === "error" ? (
          <View style={styles.stateCard}>
            <AppText style={styles.errorText}>{t("faq:error")}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => { void load(tab); }}
              style={styles.retryButton}
            >
              <AppText style={styles.retryText}>{t("common:retry")}</AppText>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <AppText display style={styles.stateTitle}>
              {searching ? t("mobile:cms.support.emptySearchTitle") : t("faq:empty.title")}
            </AppText>
            <AppText style={styles.muted}>
              {searching
                ? t("mobile:cms.support.emptySearchHint")
                : t("faq:empty.description")}
            </AppText>
          </View>
        ) : (
          <View style={styles.topicList}>
            {filtered.map((topic) => {
              const imageSource = TOPIC_IMAGES[topic.slug];
              return (
                <Pressable
                  key={topic.slug}
                  accessibilityRole="button"
                  onPress={() => setSelectedSlug(topic.slug)}
                  style={styles.topicCard}
                >
                  <View style={styles.topicIcon}>
                    {imageSource ? (
                      <Image
                        accessibilityIgnoresInvertColors
                        accessibilityLabel={topic.title}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        recyclingKey={topic.slug}
                        source={imageSource}
                        style={styles.topicImage}
                        transition={150}
                      />
                    ) : (
                      <CircleHelp color={theme.brand} size={21} strokeWidth={2.3} />
                    )}
                  </View>
                  <View style={styles.topicInfo}>
                    <AppText display numberOfLines={2} style={styles.topicTitle}>
                      {topic.title}
                    </AppText>
                    {topic.description ? (
                      <AppText numberOfLines={2} style={styles.topicDescription}>
                        {topic.description}
                      </AppText>
                    ) : null}
                  </View>
                  <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.supportCard}>
          <View style={styles.supportIcon}>
            <Headphones color={theme.brand} size={22} strokeWidth={2.3} />
          </View>
          <AppText display style={styles.supportTitle}>{t("promo:trapezoids.supportTitle")}</AppText>
          <AppText style={styles.supportDescription}>
            {t("mobile:cms.support.contact", { hotline: HOTLINE_DISPLAY, email: SUPPORT_EMAIL })}
          </AppText>
          <View style={styles.supportActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => { void Linking.openURL(HOTLINE_URL); }}
              style={styles.primaryButton}
            >
              <Phone color={theme.onBrand} size={17} strokeWidth={2.4} />
              <AppText style={styles.primaryButtonText}>{t("mobile:cms.support.call", { hotline: HOTLINE_DISPLAY })}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => { void Linking.openURL(`mailto:${SUPPORT_EMAIL}`); }}
              style={styles.secondaryButton}
            >
              <Mail color={theme.brand} size={17} strokeWidth={2.4} />
              <AppText style={styles.secondaryButtonText}>{t("mobile:cms.support.email")}</AppText>
            </Pressable>
          </View>
        </View>

        {tab === "CUSTOMER" && onBecomeOwner ? (
          <View style={styles.ownerCard}>
            <AppText display style={styles.ownerTitle}>{t("promo:trapezoids.ownerTitle")}</AppText>
            <AppText numberOfLines={2} style={styles.ownerDescription}>
              {t("promo:trapezoids.ownerDescription")}
            </AppText>
            <Pressable accessibilityRole="button" onPress={onBecomeOwner} style={styles.ownerButton}>
              <AppText style={styles.ownerButtonText}>{t("promo:trapezoids.ownerCta")}</AppText>
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
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14 },
    hero: { gap: 8 },
    eyebrow: { color: theme.brand, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
    heroTitle: { color: theme.text, fontSize: 22, lineHeight: 30, fontWeight: "800" },
    heroDescription: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
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
    searchInput: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "500", paddingVertical: 12 },
    clearButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    segmented: {
      flexDirection: "row",
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      padding: 4,
      gap: 4,
    },
    segmentOption: {
      flex: 1,
      minHeight: 40,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentOptionSelected: { backgroundColor: theme.brand },
    segmentLabel: { color: theme.muted, fontSize: 14, fontWeight: "700" },
    segmentLabelSelected: { color: theme.onBrand, fontWeight: "800" },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 4,
    },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    sectionCount: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    topicList: { gap: 11 },
    topicCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
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
    topicImage: { width: "100%", height: "100%" },
    topicInfo: { flex: 1, minWidth: 0, gap: 4 },
    topicTitle: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
    topicDescription: { color: theme.muted, fontSize: 12, lineHeight: 18, fontWeight: "500" },
    stateCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    skeletonLine: { height: 12, borderRadius: 6, backgroundColor: theme.surfaceAlt },
    skeletonShort: { width: "55%" },
    stateTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    errorText: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
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
      backgroundColor: theme.surface,
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
    supportDescription: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    supportActions: { flexDirection: "row", gap: 10, marginTop: 2 },
    primaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: theme.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
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
    secondaryButtonText: { color: theme.brand, fontSize: 14, fontWeight: "800" },
    ownerCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      padding: 16,
      gap: 8,
    },
    ownerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    ownerDescription: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    ownerButton: {
      alignSelf: "flex-start",
      minHeight: 40,
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    ownerButtonText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
  });
