import { Image } from "expo-image";
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  MapPin,
  MessageSquareOff,
  RotateCw,
  ShieldCheck,
  UserX,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import ProfileAvatar from "@/features/users/components/ProfileAvatar";
import ProfileStars from "@/features/users/components/ProfileStars";
import {
  getPublicUserProfile,
  isPublicProfileNotFound,
  type PublicProfileReview,
  type PublicProfileVehicle,
  type PublicUserProfile,
} from "@/features/users/services/publicUserProfileService";
import { buildCustomerStats, buildOwnerStats } from "@/features/users/utils/profileStats";
import { memberYear, relativeTime } from "@/features/users/utils/profileTime";

type PublicUserProfileScreenProps = {
  onBack: () => void;
  /** Mở hồ sơ người khác (ví dụ người viết đánh giá). */
  onOpenProfile?: (userId: number) => void;
  userId: number;
};

type ProfileTab = "vehicles" | "reviews";

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  Car: "Ô tô",
  Motorbike: "Xe máy",
  Motorcycle: "Xe máy",
};

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

/** Card xe nhỏ gọn: ảnh + tên + năm/địa chỉ + giá/ngày. */
function ProfileVehicleCard({ vehicle }: { vehicle: PublicProfileVehicle }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.vehicleCard}>
      <View style={styles.vehicleMedia}>
        {vehicle.primaryImage ? (
          <Image
            source={{ uri: vehicle.primaryImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Car color={theme.faint} size={22} />
        )}
      </View>
      <View style={styles.vehicleInfo}>
        <AppText style={styles.vehicleName} numberOfLines={1}>
          {[vehicle.brandName, vehicle.modelName, vehicle.variantName].filter(Boolean).join(" ")}
        </AppText>
        <View style={styles.vehicleMeta}>
          <AppText style={styles.vehicleMetaText}>{vehicle.year}</AppText>
          {vehicle.address ? (
            <>
              <AppText style={styles.dot}>•</AppText>
              <MapPin color={theme.faint} size={11} />
              <AppText style={styles.vehicleMetaText} numberOfLines={1}>
                {vehicle.address}
              </AppText>
            </>
          ) : null}
        </View>
        <View style={styles.vehicleFooter}>
          <AppText style={styles.vehiclePrice}>{formatPrice(vehicle.pricePerDay)}</AppText>
          <AppText style={styles.vehicleUnit}>/ngày</AppText>
          {VEHICLE_TYPE_LABEL[vehicle.vehicleType] ? (
            <View style={styles.vehicleTypeBadge}>
              <AppText style={styles.vehicleTypeText}>
                {VEHICLE_TYPE_LABEL[vehicle.vehicleType]}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const MemoVehicleCard = memo(ProfileVehicleCard);

/** Một đánh giá: avatar + tên người viết (bấm được) + sao + thời gian + nhận xét. */
function ProfileReviewCard({
  review,
  onOpenProfile,
}: {
  review: PublicProfileReview;
  onOpenProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const time = relativeTime(review.createdAt);

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHead}>
        <ProfileAvatar
          avatarUrl={review.reviewerAvatar}
          fullName={review.reviewerName}
          size={32}
        />
        <View style={styles.reviewHeadText}>
          <Pressable
            onPress={() => onOpenProfile?.(review.reviewerId)}
            disabled={!onOpenProfile}
            accessibilityRole="link"
            accessibilityLabel={`Xem hồ sơ ${review.reviewerName}`}
          >
            <AppText style={styles.reviewerName} numberOfLines={1}>
              {review.reviewerName}
            </AppText>
          </Pressable>
          <View style={styles.reviewMeta}>
            <ProfileStars rating={review.rating} size={11} />
            <AppText style={styles.reviewRating}>{review.rating}.0</AppText>
          </View>
        </View>
        {time ? <AppText style={styles.reviewTime}>{time}</AppText> : null}
      </View>
      <AppText style={styles.reviewComment}>
        {review.comment?.trim() || "Không có nhận xét."}
      </AppText>
    </View>
  );
}

const MemoReviewCard = memo(ProfileReviewCard);

/**
 * Hồ sơ công khai của người dùng (mirror web /users/:id) — bản mobile gọn:
 * thẻ hồ sơ (avatar, vai trò, số liệu) + tab xe/đánh giá.
 */
export default function PublicUserProfileScreen({
  onBack,
  onOpenProfile,
  userId,
}: PublicUserProfileScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [tab, setTab] = useState<ProfileTab>("vehicles");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isInteger(userId) || userId <= 0) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const data = await getPublicUserProfile(userId);
      setProfile(data);
      setTab(data.isOwner ? "vehicles" : "reviews");
      setStatus("ready");
    } catch (error) {
      if (isPublicProfileNotFound(error)) {
        setStatus("notfound");
        return;
      }
      setErrorMessage("Không thể tải hồ sơ. Vui lòng thử lại.");
      setStatus("error");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const stats = useMemo(
    () => (profile ? (profile.isOwner ? buildOwnerStats(profile) : buildCustomerStats(profile)) : []),
    [profile],
  );

  const year = profile ? memberYear(profile.createdAt) : null;

  if (status === "loading") {
    return (
      <View style={styles.root}>
        <Header onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.brand} size="large" />
        </View>
      </View>
    );
  }

  if (status === "notfound") {
    return (
      <View style={styles.root}>
        <Header onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <View style={styles.stateIcon}>
            <UserX color={theme.faint} size={30} />
          </View>
          <AppText display style={styles.stateTitle}>
            Không tìm thấy người dùng
          </AppText>
          <AppText style={styles.stateDesc}>
            Người dùng không tồn tại hoặc đã bị vô hiệu hoá.
          </AppText>
        </View>
      </View>
    );
  }

  if (status === "error" || !profile) {
    return (
      <View style={styles.root}>
        <Header onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <View style={styles.stateIcon}>
            <RotateCw color={theme.faint} size={28} />
          </View>
          <AppText display style={styles.stateTitle}>
            Chưa tải được hồ sơ
          </AppText>
          <AppText style={styles.stateDesc}>{errorMessage}</AppText>
          <Pressable
            onPress={() => setReloadKey((value) => value + 1)}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <RotateCw color="#FFFFFF" size={14} />
            <AppText style={styles.retryText}>Thử lại</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  const showVehicles = profile.isOwner && tab === "vehicles";
  const hasVehicles = profile.vehicles.length > 0;

  return (
    <View style={styles.root}>
      <Header onBack={onBack} title="Hồ sơ người dùng" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <ProfileAvatar avatarUrl={profile.avatarUrl} fullName={profile.fullName} size={64} />
            <View style={styles.profileHeadText}>
              <AppText display style={styles.profileName} numberOfLines={2}>
                {profile.fullName}
              </AppText>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.roleBadge,
                    profile.isOwner ? styles.roleBadgeOwner : styles.roleBadgeCustomer,
                  ]}
                >
                  <AppText
                    style={[
                      styles.roleBadgeText,
                      profile.isOwner ? styles.roleBadgeTextOwner : styles.roleBadgeTextCustomer,
                    ]}
                  >
                    {profile.isOwner ? "Chủ xe" : "Khách thuê"}
                  </AppText>
                </View>
                {profile.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <BadgeCheck color={theme.mode === "dark" ? "#34D399" : "#059669"} size={12} />
                    <AppText
                      style={[
                        styles.verifiedText,
                        { color: theme.mode === "dark" ? "#34D399" : "#059669" },
                      ]}
                    >
                      Đã xác minh
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.profileMeta}>
                {profile.isOnline ? <View style={styles.onlineDot} /> : null}
                <AppText style={styles.profileMetaText}>
                  {profile.isOnline ? "Đang hoạt động" : "Không hoạt động"}
                </AppText>
                {year ? (
                  <>
                    <AppText style={styles.dot}>•</AppText>
                    <AppText style={styles.profileMetaText}>Thành viên từ {year}</AppText>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.statGrid}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statTile}>
                <View style={styles.statValueRow}>
                  <AppText display style={styles.statValue}>
                    {stat.value}
                  </AppText>
                  {stat.star ? <AppText style={styles.statStar}>★</AppText> : null}
                </View>
                <AppText style={styles.statLabel}>{stat.label}</AppText>
              </View>
            ))}
          </View>
        </View>

        {profile.isOwner ? (
          <View style={styles.verifiedNote}>
            <ShieldCheck color={theme.brand} size={16} />
            <AppText style={styles.verifiedNoteText}>
              MoveVN đã xác minh hồ sơ của chủ xe này.
            </AppText>
          </View>
        ) : null}

        {profile.isOwner ? (
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setTab("vehicles")}
              style={[styles.tab, tab === "vehicles" && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "vehicles" }}
            >
              <AppText style={[styles.tabText, tab === "vehicles" && styles.tabTextActive]}>
                Xe đang cho thuê ({profile.vehicles.length})
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setTab("reviews")}
              style={[styles.tab, tab === "reviews" && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "reviews" }}
            >
              <AppText style={[styles.tabText, tab === "reviews" && styles.tabTextActive]}>
                Đánh giá ({profile.totalReviewsReceived})
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {showVehicles ? (
          hasVehicles ? (
            <View style={styles.section}>
              {profile.vehicles.map((vehicle) => (
                <MemoVehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Car color={theme.faint} size={24} />
              <AppText style={styles.emptyText}>Chưa có xe được công khai</AppText>
            </View>
          )
        ) : (
          <View style={styles.section}>
            {profile.averageRating != null ? (
              <View style={styles.ratingSummary}>
                <View style={styles.ratingScoreCol}>
                  <AppText display style={styles.ratingScore}>
                    {profile.averageRating.toFixed(1)}
                  </AppText>
                  <ProfileStars rating={profile.averageRating} size={13} />
                  <AppText style={styles.ratingCount}>
                    {profile.totalReviewsReceived} đánh giá
                  </AppText>
                </View>
              </View>
            ) : null}

            {profile.reviews.length === 0 ? (
              <View style={styles.emptyBox}>
                <MessageSquareOff color={theme.faint} size={24} />
                <AppText style={styles.emptyText}>Chưa có đánh giá công khai</AppText>
              </View>
            ) : (
              profile.reviews.map((review) => (
                <MemoReviewCard
                  key={review.id}
                  review={review}
                  onOpenProfile={onOpenProfile}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={8}
      >
        <ArrowLeft color={theme.text} size={20} />
      </Pressable>
      <AppText style={styles.headerTitle}>{title}</AppText>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    headerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },

    profileCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 14,
      overflow: "hidden",
    },
    profileTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    profileHeadText: { flex: 1, minWidth: 0, gap: 6 },
    profileName: { color: theme.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    roleBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    roleBadgeOwner: { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder },
    roleBadgeCustomer: { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
    roleBadgeText: { fontSize: 11, fontWeight: "800" },
    roleBadgeTextOwner: { color: theme.brand },
    roleBadgeTextCustomer: { color: theme.muted },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(52,211,153,0.3)" : "#A7F3D0",
      backgroundColor: theme.mode === "dark" ? "rgba(52,211,153,0.12)" : "#ECFDF5",
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    verifiedText: { fontSize: 11, fontWeight: "800" },
    profileMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
    profileMetaText: { color: theme.muted, fontSize: 11 },
    dot: { color: theme.faint, fontSize: 11 },

    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statTile: {
      flexGrow: 1,
      flexBasis: "46%",
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F8FAFC",
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 2,
    },
    statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    statValue: { color: theme.text, fontSize: 18, fontWeight: "900" },
    statStar: { color: "#FBBF24", fontSize: 13 },
    statLabel: { color: theme.muted, fontSize: 11, fontWeight: "600" },

    verifiedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    verifiedNoteText: { flex: 1, color: theme.brand, fontSize: 11, lineHeight: 16, fontWeight: "600" },

    tabRow: {
      flexDirection: "row",
      gap: 6,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 4,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    tabActive: { backgroundColor: theme.brand },
    tabText: { color: theme.muted, fontSize: 12, fontWeight: "700", textAlign: "center" },
    tabTextActive: { color: "#FFFFFF" },

    section: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    ratingSummary: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F8FAFC",
    },
    ratingScoreCol: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14 },
    ratingScore: { color: theme.text, fontSize: 30, fontWeight: "900" },
    ratingCount: { color: theme.muted, fontSize: 11 },

    vehicleCard: {
      flexDirection: "row",
      gap: 10,
      padding: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    vehicleMedia: {
      width: 84,
      height: 66,
      borderRadius: 10,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    vehicleInfo: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
    vehicleName: { color: theme.text, fontSize: 13, fontWeight: "800" },
    vehicleMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
    vehicleMetaText: { color: theme.muted, fontSize: 11, flexShrink: 1 },
    vehicleFooter: { flexDirection: "row", alignItems: "baseline", gap: 3 },
    vehiclePrice: { color: theme.brand, fontSize: 14, fontWeight: "900" },
    vehicleUnit: { color: theme.muted, fontSize: 11 },
    vehicleTypeBadge: {
      marginLeft: "auto",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    vehicleTypeText: { color: theme.brand, fontSize: 10, fontWeight: "800" },

    reviewItem: {
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: 8,
    },
    reviewHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    reviewHeadText: { flex: 1, minWidth: 0, gap: 2 },
    reviewerName: { color: theme.text, fontSize: 13, fontWeight: "800" },
    reviewMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    reviewRating: { color: "#F59E0B", fontSize: 11, fontWeight: "700" },
    reviewTime: { color: theme.faint, fontSize: 10 },
    reviewComment: { color: theme.muted, fontSize: 12, lineHeight: 17 },

    emptyBox: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 28,
      paddingHorizontal: 16,
    },
    emptyText: { color: theme.muted, fontSize: 12, textAlign: "center" },

    centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
    stateIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    stateTitle: { color: theme.text, fontSize: 15, fontWeight: "900", textAlign: "center" },
    stateDesc: { color: theme.muted, fontSize: 13, textAlign: "center" },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  });
