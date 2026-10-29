import { Image } from "expo-image";
import {
  CarFront,
  ChevronRight,
  EllipsisVertical,
  MessageSquareOff,
  RotateCw,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AlertButton,
} from "react-native";
import AppText from "@/components/AppText";
import ProfileAvatar from "@/features/users/components/ProfileAvatar";
import ProfileStars from "@/features/users/components/ProfileStars";
import {
  getPublicProfileReviews,
  type PublicProfileReview,
  type PublicProfileReviewRole,
  type PublicUserProfile,
} from "@/features/users/services/publicUserProfileService";
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
import { profileVehicleName } from "@/features/users/utils/profileVehicles";
import { canReport, openViolations } from "@/features/violations/violationNavigation";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;

type Props = {
  profile: PublicUserProfile;
  initialRole: PublicProfileReviewRole;
  allowRoleSwitch?: boolean;
  onRoleChange?: (role: PublicProfileReviewRole) => void;
  onOpenProfile?: (userId: number) => void;
  onOpenVehicle?: (vehicleId: number) => void;
};

/** Màn 3 (và phần đánh giá của khách thuê): tổng điểm, lọc sao, danh sách đánh giá. */
export default function OwnerReviewsPanel({
  profile,
  initialRole,
  allowRoleSwitch = false,
  onRoleChange,
  onOpenProfile,
  onOpenVehicle,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [role, setRole] = useState<PublicProfileReviewRole>(initialRole);
  const [filter, setFilter] = useState<number | null>(null);
  const [reviews, setReviews] = useState<PublicProfileReview[]>([]);
  const [total, setTotal] = useState(0);
  const [ratingCounts, setRatingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setPage(1);
    setReviews([]);
    setLoadMoreError(false);
  }, [role, filter]);

  useEffect(() => {
    let active = true;
    const firstPage = page === 1;
    if (firstPage) {
      setLoading(true);
      setError("");
    } else {
      setLoadingMore(true);
    }
    getPublicProfileReviews(profile.userId, role, page, filter, "recent")
      .then((result) => {
        if (!active) return;
        setReviews((current) => (firstPage ? result.reviews : [...current, ...result.reviews]));
        setTotal(result.total);
        setRatingCounts(result.ratingCounts);
        setLoadMoreError(false);
      })
      .catch(() => {
        if (!active) return;
        if (firstPage) setError("Không tải được đánh giá. Vui lòng thử lại.");
        else setLoadMoreError(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setLoadingMore(false);
      });
    return () => {
      active = false;
    };
  }, [profile.userId, role, filter, page, reloadKey]);

  const roleStats = useMemo(
    () =>
      role === "owner"
        ? { count: profile.ownerReviewCount, average: profile.ownerAverageRating }
        : { count: profile.customerReviewCount, average: profile.customerAverageRating },
    [
      role,
      profile.ownerReviewCount,
      profile.ownerAverageRating,
      profile.customerReviewCount,
      profile.customerAverageRating,
    ],
  );

  const vehicleById = useMemo(() => {
    const map = new Map<number, PublicUserProfile["vehicles"][number]>();
    for (const vehicle of profile.vehicles) map.set(vehicle.id, vehicle);
    return map;
  }, [profile.vehicles]);

  const remaining = Math.max(total - reviews.length, 0);
  const roleLabel = role === "owner" ? "chủ xe" : "khách thuê";

  function selectRole(next: PublicProfileReviewRole) {
    if (next === role) return;
    setFilter(null);
    setRole(next);
    onRoleChange?.(next);
  }

  function openReviewActions(review: PublicProfileReview) {
    const target = {
      targetType: "User" as const,
      targetId: review.reviewerId,
      label: review.reviewerName,
    };
    const buttons: AlertButton[] = [];
    if (onOpenProfile) {
      buttons.push({ text: "Xem hồ sơ", onPress: () => onOpenProfile(review.reviewerId) });
    }
    if (canReport(target)) {
      buttons.push({
        text: "Báo cáo vi phạm",
        style: "destructive",
        onPress: () => openViolations({ target }),
      });
    }
    if (buttons.length === 0) return;
    buttons.push({ text: "Đóng", style: "cancel" });
    Alert.alert("Tuỳ chọn đánh giá", review.reviewerName, buttons);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {allowRoleSwitch && profile.ownerReviewCount > 0 && profile.customerReviewCount > 0 ? (
        <View style={styles.roleRow}>
          <View style={styles.roleSwitch}>
            <RoleChip
              active={role === "owner"}
              count={profile.ownerReviewCount}
              label="Khi là chủ xe"
              onPress={() => selectRole("owner")}
              styles={styles}
            />
            <RoleChip
              active={role === "customer"}
              count={profile.customerReviewCount}
              label="Khi là khách thuê"
              onPress={() => selectRole("customer")}
              styles={styles}
            />
          </View>
          <AppText style={styles.roleHint}>
            {role === "owner"
              ? "Đánh giá từ khách thuê sau chuyến thuê xe."
              : "Đánh giá từ chủ xe sau chuyến thuê."}
          </AppText>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <AppText display style={styles.summaryScore}>
            {roleStats.average == null ? "—" : roleStats.average.toFixed(1)}
          </AppText>
          <ProfileStars rating={roleStats.average} size={11} />
          <AppText style={styles.summaryCount}>{roleStats.count} đánh giá</AppText>
        </View>
        <View style={styles.summaryChips}>
          <FilterChip
            active={filter == null}
            label={`Tất cả (${roleStats.count})`}
            onPress={() => setFilter(null)}
            styles={styles}
          />
          {STAR_FILTERS.map((star) => {
            const count = ratingCounts[String(star)] ?? 0;
            return (
              <FilterChip
                key={star}
                active={filter === star}
                label={`${star} sao (${count})`}
                disabled={count === 0}
                onPress={() => setFilter(star)}
                styles={styles}
              />
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.brand} size="small" />
          <AppText style={styles.stateText}>Đang tải đánh giá…</AppText>
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <AppText style={styles.stateText}>{error}</AppText>
          <Pressable
            onPress={() => setReloadKey((value) => value + 1)}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <RotateCw color={theme.brand} size={13} />
            <AppText style={styles.retryText}>Thử lại</AppText>
          </Pressable>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.stateIcon}>
            <MessageSquareOff color={theme.faint} size={20} />
          </View>
          <AppText style={styles.stateTitle}>
            {filter == null
              ? `Chưa có đánh giá với vai trò ${roleLabel}`
              : "Không có đánh giá phù hợp"}
          </AppText>
          <AppText style={styles.stateText}>
            {filter == null
              ? "Đánh giá công khai sẽ xuất hiện sau khi chuyến thuê hoàn tất."
              : `${filter} sao hiện chưa có đánh giá nào.`}
          </AppText>
          {filter != null ? (
            <Pressable onPress={() => setFilter(null)} accessibilityRole="button">
              <AppText style={styles.clearFilterText}>Xoá bộ lọc</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.listCard}>
          {reviews.map((review, index) => {
            const vehicle = review.vehicleId ? vehicleById.get(review.vehicleId) : undefined;
            return (
              <View
                key={review.id}
                style={[styles.reviewItem, index > 0 && styles.reviewDivider]}
              >
                <View style={styles.reviewHead}>
                  <Pressable
                    disabled={!onOpenProfile}
                    onPress={() => onOpenProfile?.(review.reviewerId)}
                    accessibilityRole={onOpenProfile ? "link" : undefined}
                    accessibilityLabel={`Xem hồ sơ ${review.reviewerName}`}
                  >
                    <ProfileAvatar
                      avatarUrl={review.reviewerAvatar}
                      fullName={review.reviewerName}
                      size={28}
                    />
                  </Pressable>
                  <View style={styles.reviewHeadText}>
                    <Pressable
                      disabled={!onOpenProfile}
                      onPress={() => onOpenProfile?.(review.reviewerId)}
                    >
                      <AppText style={styles.reviewerName} numberOfLines={1}>
                        {review.reviewerName}
                      </AppText>
                    </Pressable>
                    <View style={styles.reviewStars}>
                      <ProfileStars rating={review.rating} size={10} />
                      <AppText style={styles.reviewScore}>{review.rating}.0</AppText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => openReviewActions(review)}
                    style={styles.moreButton}
                    accessibilityRole="button"
                    accessibilityLabel="Tuỳ chọn đánh giá"
                    hitSlop={6}
                  >
                    <EllipsisVertical color={theme.muted} size={15} />
                  </Pressable>
                </View>

                {review.comment?.trim() ? (
                  <View style={styles.commentBox}>
                    <AppText style={styles.commentText}>{review.comment}</AppText>
                  </View>
                ) : (
                  <AppText style={styles.emptyComment}>Không có nhận xét.</AppText>
                )}

                {review.vehicleId ? (
                  <Pressable
                    disabled={!onOpenVehicle}
                    onPress={() => onOpenVehicle?.(review.vehicleId!)}
                    style={({ pressed }) => [styles.vehicleRef, pressed && styles.pressed]}
                    accessibilityRole={onOpenVehicle ? "link" : undefined}
                    accessibilityLabel={`Xem xe ${review.vehicleName ?? ""}`}
                  >
                    <View style={styles.vehicleThumb}>
                      {vehicle?.primaryImage ? (
                        <Image
                          source={{ uri: vehicle.primaryImage }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={120}
                        />
                      ) : (
                        <CarFront color={theme.faint} size={16} />
                      )}
                    </View>
                    <View style={styles.vehicleRefBody}>
                      <AppText style={styles.vehicleRefName} numberOfLines={1}>
                        {vehicle ? profileVehicleName(vehicle) : review.vehicleName ?? "Xe đã thuê"}
                      </AppText>
                      {vehicle ? (
                        <AppText style={styles.vehicleRefPrice}>
                          {formatMoney(vehicle.pricePerDay)}/ngày
                        </AppText>
                      ) : null}
                    </View>
                    {onOpenVehicle ? <ChevronRight color={theme.faint} size={14} /> : null}
                  </Pressable>
                ) : null}

                <AppText style={styles.reviewDate}>{formatDateTime(review.createdAt)}</AppText>
              </View>
            );
          })}

          {remaining > 0 ? (
            <Pressable
              onPress={() => {
                if (loadingMore || remaining === 0) return;
                setPage((current) => current + 1);
              }}
              disabled={loadingMore}
              style={styles.loadMore}
              accessibilityRole="button"
            >
              <AppText style={styles.loadMoreText}>
                {loadingMore ? "Đang tải…" : `Xem thêm đánh giá (+${remaining})`}
              </AppText>
            </Pressable>
          ) : null}

          {loadMoreError ? (
            <View style={styles.loadMoreError}>
              <AppText style={styles.stateText}>Chưa tải thêm được.</AppText>
              <Pressable
                onPress={() => setReloadKey((value) => value + 1)}
                accessibilityRole="button"
              >
                <AppText style={styles.clearFilterText}>Thử lại</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function RoleChip({
  active,
  count,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  count: number;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.roleChip, active && styles.roleChipActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <AppText
        style={[styles.roleChipText, active && styles.roleChipTextActive]}
        numberOfLines={1}
      >
        {label}
      </AppText>
      <View style={[styles.roleChipCount, active && styles.roleChipCountActive]}>
        <AppText style={[styles.roleChipCountText, active && styles.roleChipCountTextActive]}>
          {count}
        </AppText>
      </View>
    </Pressable>
  );
}

function FilterChip({
  active,
  label,
  disabled,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
        disabled && styles.filterChipDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
    >
      <AppText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 12, paddingBottom: 24, gap: 10 },
    pressed: { opacity: 0.7 },

    roleRow: { gap: 5 },
    roleSwitch: {
      flexDirection: "row",
      gap: 3,
      padding: 3,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    roleChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 8,
    },
    roleChipActive: { backgroundColor: theme.brandSoft },
    roleChipText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 11,
      flexShrink: 1,
    },
    roleChipTextActive: { color: theme.brand },
    roleChipCount: {
      minWidth: 18,
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
    },
    roleChipCountActive: { backgroundColor: theme.brand },
    roleChipCountText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 9,
    },
    roleChipCountTextActive: { color: theme.onBrand },
    roleHint: {
      color: theme.faint,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 10,
      paddingHorizontal: 2,
    },

    summaryCard: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    summaryLeft: {
      width: 80,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingRight: 10,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.border,
    },
    summaryScore: {
      color: theme.brand,
      fontFamily: "Quicksand_700Bold",
      fontSize: 24,
      lineHeight: 28,
    },
    summaryCount: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 10,
    },
    summaryChips: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      alignContent: "center",
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    filterChipActive: { borderColor: theme.brand, backgroundColor: theme.brand },
    filterChipDisabled: { opacity: 0.45 },
    filterChipText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 10.5,
    },
    filterChipTextActive: { color: theme.onBrand },

    stateBox: {
      alignItems: "center",
      gap: 7,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    stateIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    stateTitle: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
      textAlign: "center",
    },
    stateText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
      lineHeight: 15,
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
    },
    retryText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 11,
    },
    clearFilterText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 11,
    },

    listCard: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    reviewItem: { padding: 12, gap: 8 },
    reviewDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    reviewHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    reviewHeadText: { flex: 1, minWidth: 0, gap: 2 },
    reviewerName: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
    reviewScore: {
      color: "#F59E0B",
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 10,
    },
    moreButton: {
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 11,
    },
    commentBox: {
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      padding: 9,
    },
    commentText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    emptyComment: {
      color: theme.faint,
      fontFamily: "BeVietnamPro_400Regular_Italic",
      fontSize: 11,
      fontStyle: "italic",
    },
    vehicleRef: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 9,
      backgroundColor: theme.surfaceAlt,
      padding: 6,
    },
    vehicleThumb: {
      width: 40,
      height: 32,
      borderRadius: 7,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
    },
    vehicleRefBody: { flex: 1, minWidth: 0, gap: 1 },
    vehicleRefName: {
      color: theme.text,
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 11,
    },
    vehicleRefPrice: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 10.5,
    },
    reviewDate: {
      color: theme.faint,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 10,
    },
    loadMore: {
      alignItems: "center",
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    loadMoreText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 11.5,
    },
    loadMoreError: { alignItems: "center", gap: 3, paddingVertical: 9 },
  });
