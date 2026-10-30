import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import AppText from "@/components/AppText";
import {
  Bell,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { BOOKING_STATUS_FILTERS } from "../constants";
import type { BookingResponse } from "../types";
import { formatDateTime } from "../utils/format";
import BookingCard from "./BookingCard";
import BookingCardSkeleton from "./BookingCardSkeleton";
import BookingSearchFilters, { EMPTY_SEARCH, type SearchFilters } from "./BookingSearchFilters";

type Variant = "customer" | "owner";
type Stage = "todo" | "ongoing" | "upcoming" | "finished";

type Section = {
  key: Stage;
  title: string;
  data: BookingResponse[];
};

type Reminder = {
  tone: "brand" | "warn";
  icon: "bell" | "clock";
  title: string;
  description: string;
  cta: string;
  booking: BookingResponse;
};

const CUSTOMER_GROUPS: { key: Stage; title: string }[] = [
  { key: "ongoing", title: "Đang diễn ra" },
  { key: "upcoming", title: "Sắp tới" },
  { key: "finished", title: "Đã kết thúc" },
];

const OWNER_GROUPS: { key: Stage; title: string }[] = [
  { key: "todo", title: "Cần xử lý" },
  { key: "upcoming", title: "Sắp tới" },
  { key: "ongoing", title: "Đang diễn ra" },
  { key: "finished", title: "Đã kết thúc" },
];

const PRIMARY_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "Pending", label: "Chờ duyệt" },
  { key: "DepositPaid", label: "Đã cọc" },
  { key: "InProgress", label: "Đang thuê" },
];

function stageOf(status: string, variant: Variant): Stage {
  if (variant === "owner") {
    if (status === "Pending") return "todo";
    if (status === "Approved" || status === "DepositPaid" || status === "Confirmed") return "upcoming";
    if (status === "InProgress" || status === "Returning" || status === "Returned") return "ongoing";
    return "finished";
  }
  if (status === "InProgress" || status === "Returning" || status === "Returned") return "ongoing";
  if (status === "Pending" || status === "Approved" || status === "DepositPaid" || status === "Confirmed") {
    return "upcoming";
  }
  return "finished";
}

function groupBookings(items: BookingResponse[], variant: Variant): Section[] {
  const defs = variant === "owner" ? OWNER_GROUPS : CUSTOMER_GROUPS;
  const buckets = new Map<Stage, BookingResponse[]>();
  for (const item of items) {
    const stage = stageOf(item.status, variant);
    const list = buckets.get(stage);
    if (list) list.push(item);
    else buckets.set(stage, [item]);
  }
  return defs
    .map((def) => ({ ...def, data: buckets.get(def.key) ?? [] }))
    .filter((section) => section.data.length > 0);
}

/** Chỉ một dải nhắc việc, chọn việc gấp nhất trong các item đã tải. */
function buildReminder(items: BookingResponse[], variant: Variant): Reminder | null {
  if (variant === "owner") {
    const pending = items.find((b) => b.status === "Pending");
    if (pending) {
      return {
        tone: "warn",
        icon: "clock",
        title: `${pending.bookingCode} · chờ bạn duyệt`,
        description: `${pending.customerName || "Khách"} đặt ${pending.vehicleName || "xe"} từ ${formatDateTime(pending.startDate)}.`,
        cta: "Xử lý",
        booking: pending,
      };
    }
    const handover = items.find((b) => b.status === "DepositPaid" || b.status === "Confirmed");
    if (handover) {
      return {
        tone: "brand",
        icon: "bell",
        title: `${handover.vehicleName || "Xe"} sắp bàn giao`,
        description: `Khách nhận xe ${formatDateTime(handover.startDate)}.`,
        cta: "Xem",
        booking: handover,
      };
    }
    const running = items.find((b) => b.status === "InProgress" || b.status === "Returning");
    if (running) {
      return {
        tone: "brand",
        icon: "bell",
        title: `${running.vehicleName || "Xe"} đang được thuê`,
        description: `Dự kiến trả xe ${formatDateTime(running.endDate)}.`,
        cta: "Xem",
        booking: running,
      };
    }
    return null;
  }

  const approved = items.find((b) => b.status === "Approved");
  if (approved) {
    return {
      tone: "warn",
      icon: "clock",
      title: `${approved.vehicleName || "Xe"} chờ đặt cọc`,
      description: approved.paymentDueAt
        ? `Hạn cọc ${formatDateTime(approved.paymentDueAt)} · quá hạn đơn sẽ tự hủy.`
        : "Hoàn tất cọc để giữ chuyến.",
      cta: "Thanh toán",
      booking: approved,
    };
  }
  const ready = items.find((b) => b.status === "DepositPaid" || b.status === "Confirmed");
  if (ready) {
    return {
      tone: "brand",
      icon: "bell",
      title: `${ready.vehicleName || "Xe"} sắp bắt đầu`,
      description: `Nhận xe ${formatDateTime(ready.startDate)} · nhớ mang CCCD và bằng lái.`,
      cta: "Xem",
      booking: ready,
    };
  }
  const running = items.find((b) => b.status === "InProgress" || b.status === "Returning");
  if (running) {
    return {
      tone: "brand",
      icon: "bell",
      title: `${running.vehicleName || "Xe"} đang diễn ra`,
      description: `Dự kiến trả xe ${formatDateTime(running.endDate)}.`,
      cta: "Xem",
      booking: running,
    };
  }
  return null;
}

export default function BookingListShell({
  variant,
  items,
  totalCount,
  status,
  onStatusChange,
  search,
  onSearchChange,
  loading,
  loadingMore,
  refreshing,
  error,
  hasMore,
  remaining,
  onRefresh,
  onLoadMore,
  onPressBooking,
  onOpenUserProfile,
}: {
  variant: Variant;
  items: BookingResponse[];
  totalCount: number;
  status: string;
  onStatusChange: (key: string) => void;
  search: SearchFilters;
  onSearchChange: (filters: SearchFilters) => void;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string;
  hasMore: boolean;
  remaining: number;
  onRefresh: () => void;
  onLoadMore: () => void;
  onPressBooking: (booking: BookingResponse) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const sections = useMemo(() => groupBookings(items, variant), [items, variant]);
  const reminder = useMemo(() => buildReminder(items, variant), [items, variant]);
  const searchActive = Boolean(search.keyword || search.fromDate || search.toDate);

  const stat =
    variant === "owner"
      ? items.filter((b) => b.status === "Pending").length
      : items.filter((b) => b.status === "InProgress" || b.status === "Returning").length;
  const statLabel = variant === "owner" ? "chờ duyệt" : "đang diễn ra";

  const customFilter = PRIMARY_FILTERS.some((f) => f.key === status)
    ? null
    : BOOKING_STATUS_FILTERS.find((f) => f.key === status)?.label ?? null;

  const title = variant === "owner" ? "Đơn thuê xe của tôi" : "Chuyến đi của tôi";
  const kicker = variant === "owner" ? "Cho thuê" : "Chuyến đi";
  const countLabel = variant === "owner" ? "đơn" : "chuyến";

  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.kicker}>{kicker}</AppText>
          <AppText display style={styles.title}>
            {title}
          </AppText>
          <View style={styles.metaRow}>
            <AppText style={styles.metaText}>
              {loading && items.length === 0 ? "Đang tải..." : `${totalCount} ${countLabel}`}
            </AppText>
            {stat > 0 ? (
              <>
                <View style={styles.metaDot} />
                <AppText style={styles.metaText}>
                  {stat} {statLabel}
                </AppText>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm"
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Search color={theme.text} size={17} strokeWidth={2.2} />
            {searchActive ? <View style={styles.iconDot} /> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bộ lọc trạng thái"
            onPress={() => setFilterOpen(true)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <SlidersHorizontal color={theme.text} size={17} strokeWidth={2.2} />
            {status ? <View style={styles.iconDot} /> : null}
          </Pressable>
        </View>
      </View>

      {reminder ? (
        <Pressable
          onPress={() => onPressBooking(reminder.booking)}
          accessibilityRole="button"
          accessibilityLabel={`${reminder.title}. ${reminder.cta}`}
          style={({ pressed }) => [
            styles.alertBand,
            reminder.tone === "warn" ? styles.alertBandWarn : styles.alertBandBrand,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.alertIcon, reminder.tone === "warn" ? styles.alertIconWarn : styles.alertIconBrand]}>
            {reminder.icon === "clock" ? (
              <Clock
                color={reminder.tone === "warn" ? (theme.mode === "dark" ? "#FBBF24" : "#D97706") : theme.brand}
                size={15}
                strokeWidth={2.2}
              />
            ) : (
              <Bell color={theme.brand} size={15} strokeWidth={2.2} />
            )}
          </View>
          <View style={styles.alertCopy}>
            <AppText numberOfLines={1} style={styles.alertTitle}>
              {reminder.title}
            </AppText>
            <AppText numberOfLines={2} style={styles.alertDesc}>
              {reminder.description}
            </AppText>
          </View>
          <AppText style={[styles.alertCta, reminder.tone === "warn" && styles.alertCtaWarn]}>{reminder.cta}</AppText>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipBar}
      >
        {PRIMARY_FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <Pressable
              key={f.key || "all"}
              onPress={() => onStatusChange(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</AppText>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Mở bộ lọc trạng thái"
          style={[styles.chip, styles.filterChip, customFilter !== null && styles.chipActive]}
        >
          {customFilter !== null ? (
            <Check color={theme.onBrand} size={12} strokeWidth={2.6} />
          ) : (
            <SlidersHorizontal color={theme.brand} size={12} strokeWidth={2.2} />
          )}
          <AppText style={[styles.chipText, styles.filterChipText, customFilter !== null && styles.chipTextActive]}>
            {customFilter ?? "Bộ lọc"}
          </AppText>
        </Pressable>
      </ScrollView>

      {searchActive ? (
        <View style={styles.searchTag}>
          <Search color={theme.brand} size={12} strokeWidth={2.2} />
          <AppText numberOfLines={1} style={styles.searchTagText}>
            {search.keyword
              ? search.keyword
              : `${search.fromDate || "…"} → ${search.toDate || "…"}`}
          </AppText>
          <Pressable
            onPress={() => onSearchChange(EMPTY_SEARCH)}
            accessibilityRole="button"
            accessibilityLabel="Xóa tìm kiếm"
            hitSlop={8}
          >
            <X color={theme.brand} size={13} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <BookingCard
              booking={item}
              variant={variant}
              onPress={() => onPressBooking(item)}
              onOpenUserProfile={onOpenUserProfile}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.groupHead}>
            <AppText style={styles.groupTitle}>{section.title}</AppText>
            <View style={styles.groupCount}>
              <AppText style={styles.groupCountText}>{section.data.length}</AppText>
            </View>
            <View style={styles.groupLine} />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <AppText style={styles.errorText}>{error}</AppText>
              <Pressable onPress={onRefresh} style={styles.retryBtn}>
                <AppText style={styles.retryText}>Thử lại</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                {variant === "owner" ? (
                  <ClipboardList color={theme.brand} size={26} strokeWidth={1.8} />
                ) : (
                  <CalendarCheck color={theme.brand} size={26} strokeWidth={1.8} />
                )}
              </View>
              <AppText display style={styles.emptyTitle}>
                {variant === "owner" ? "Chưa có đơn thuê nào" : "Chưa có chuyến đi nào"}
              </AppText>
              <AppText style={styles.emptyDesc}>
                {variant === "owner"
                  ? "Khi khách đặt xe của bạn, đơn sẽ hiện ở đây."
                  : "Các chuyến bạn đặt sẽ hiện ở đây để dễ theo dõi."}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          loading || items.length === 0 ? undefined : loadingMore ? (
            <ActivityIndicator color={theme.brand} style={styles.more} />
          ) : hasMore ? (
            <View style={styles.moreWrap}>
              <Pressable onPress={onLoadMore} style={styles.moreButton}>
                <AppText style={styles.moreText}>Xem thêm ({remaining})</AppText>
              </Pressable>
              <AppText style={styles.endText}>
                Đã hiển thị {items.length}/{totalCount} {countLabel}
              </AppText>
            </View>
          ) : (
            <AppText style={styles.endText}>Đã hiển thị hết</AppText>
          )
        }
      />

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Đóng bộ lọc"
            onPress={() => setFilterOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadCopy}>
                <AppText display style={styles.sheetTitle}>
                  {variant === "owner" ? "Bộ lọc đơn thuê" : "Bộ lọc chuyến đi"}
                </AppText>
                <AppText style={styles.sheetSub}>Chọn một trạng thái · áp dụng ngay</AppText>
              </View>
              <Pressable
                onPress={() => setFilterOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                style={styles.sheetClose}
              >
                <X color={theme.muted} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
            <View style={styles.sheetChips}>
              {BOOKING_STATUS_FILTERS.map((f) => {
                const active = status === f.key;
                return (
                  <Pressable
                    key={f.key || "all"}
                    onPress={() => {
                      onStatusChange(f.key);
                      setFilterOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.sheetChip, active && styles.sheetChipActive]}
                  >
                    <AppText style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>{f.label}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => {
                onStatusChange("");
                setFilterOpen(false);
              }}
              style={styles.sheetReset}
            >
              <AppText style={styles.sheetResetText}>Xóa lọc</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalRoot}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Đóng tìm kiếm"
            onPress={() => setSearchOpen(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadCopy}>
                <AppText display style={styles.sheetTitle}>
                  {variant === "owner" ? "Tìm đơn thuê" : "Tìm chuyến đi"}
                </AppText>
                <AppText style={styles.sheetSub}>Lọc theo mã đơn, tên xe và khoảng ngày.</AppText>
              </View>
              <Pressable
                onPress={() => setSearchOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                style={styles.sheetClose}
              >
                <X color={theme.muted} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
            {searchOpen ? (
              <BookingSearchFilters
                initial={search}
                onApply={(filters) => {
                  onSearchChange(filters);
                  setSearchOpen(false);
                }}
              />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    list: { paddingHorizontal: 16, paddingTop: 4 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 2, paddingTop: 8 },
    headerCopy: { flex: 1, minWidth: 0 },
    kicker: {
      color: theme.brand,
      fontFamily: font.extraBold,
      fontSize: 8.5,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      color: theme.text,
      fontFamily: font.display,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.4,
      marginTop: 3,
    },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    metaText: { color: theme.muted, fontFamily: font.medium, fontSize: 10.5 },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.faint },
    headerActions: { flexDirection: "row", gap: 7, paddingTop: 2 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconDot: {
      position: "absolute",
      top: 7,
      right: 8,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.brand,
    },
    alertBand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 12,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 18,
      borderWidth: 1,
    },
    alertBandBrand: { borderColor: theme.brandBorder, backgroundColor: theme.brandSoft },
    alertBandWarn: {
      borderColor: theme.mode === "dark" ? "#5A4318" : "#F5E0B8",
      backgroundColor: theme.mode === "dark" ? "#3A2A0F" : "#FFF7E6",
    },
    alertIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      flexShrink: 0,
    },
    alertIconBrand: { borderColor: theme.brandBorder },
    alertIconWarn: { borderColor: theme.mode === "dark" ? "#5A4318" : "#F5E0B8" },
    alertCopy: { flex: 1, minWidth: 0 },
    alertTitle: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, lineHeight: 15 },
    alertDesc: { color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14, marginTop: 1 },
    alertCta: { color: theme.brand, fontFamily: font.bold, fontSize: 10.5, flexShrink: 0 },
    alertCtaWarn: { color: theme.mode === "dark" ? "#FBBF24" : "#D97706" },
    chipBar: { flexGrow: 0, flexShrink: 0, marginTop: 12 },
    chipRow: { flexDirection: "row", gap: 7, paddingRight: 4, paddingBottom: 12 },
    chip: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 13,
      flexDirection: "row",
      gap: 5,
      flexShrink: 0,
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.muted, fontFamily: font.bold, fontSize: 11 },
    chipTextActive: { color: theme.onBrand },
    filterChip: { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder },
    filterChipText: { color: theme.brand },
    searchTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      maxWidth: "100%",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 10,
    },
    searchTagText: { color: theme.brand, fontFamily: font.semibold, fontSize: 10, flexShrink: 1 },
    groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, marginBottom: 8 },
    groupTitle: {
      color: theme.faint,
      fontFamily: font.extraBold,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    groupCount: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    groupCountText: { color: theme.muted, fontFamily: font.bold, fontSize: 9.5 },
    groupLine: { flex: 1, height: 1, backgroundColor: theme.border },
    cardWrap: { marginBottom: 11 },
    skeletons: { gap: 11, paddingTop: 2 },
    center: { alignItems: "center", paddingVertical: 48, gap: 8, paddingHorizontal: 12 },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { color: theme.text, fontFamily: font.display, fontSize: 15 },
    emptyDesc: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16, textAlign: "center" },
    errorText: { color: theme.danger, fontFamily: font.semibold, fontSize: 12, textAlign: "center" },
    retryBtn: {
      marginTop: 8,
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    retryText: { color: theme.onBrand, fontFamily: font.bold, fontSize: 12 },
    more: { marginVertical: 12 },
    moreWrap: { alignItems: "center", gap: 6, paddingTop: 4, paddingBottom: 6 },
    moreButton: {
      minHeight: 38,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    moreText: { color: theme.brand, fontFamily: font.bold, fontSize: 11 },
    endText: { color: theme.faint, fontFamily: font.regular, fontSize: 9.5, textAlign: "center", marginTop: 8 },
    pressed: { opacity: 0.78 },
    modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 12,
    },
    grabber: { width: 34, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center" },
    sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    sheetHeadCopy: { flex: 1, minWidth: 0 },
    sheetTitle: { color: theme.text, fontFamily: font.display, fontSize: 16, letterSpacing: -0.2 },
    sheetSub: { color: theme.muted, fontFamily: font.regular, fontSize: 10, marginTop: 2 },
    sheetClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sheetChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    sheetChip: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetChipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    sheetChipText: { color: theme.muted, fontFamily: font.semibold, fontSize: 10.5 },
    sheetChipTextActive: { color: theme.onBrand },
    sheetReset: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetResetText: { color: theme.muted, fontFamily: font.bold, fontSize: 11.5 },
  });
