import { Image } from "expo-image";
import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BadgeCheck,
  Bike,
  CarFront,
  ChevronRight,
  Flag,
  MapPin,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Search,
  Share2,
  Star,
  UserX,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import ProfileHeader from "@/features/users/components/ProfileHeader";
import ProfileAvatar from "@/features/users/components/ProfileAvatar";
import ProfileStars from "@/features/users/components/ProfileStars";
import OwnerProfileDetail from "@/features/users/components/ownerProfile/OwnerProfileDetail";
import OwnerReviewsPanel from "@/features/users/components/ownerProfile/OwnerReviewsPanel";
import {
  getPublicUserProfile,
  isPublicProfileNotFound,
  type PublicProfileReviewRole,
  type PublicProfileVehicle,
  type PublicUserProfile,
} from "@/features/users/services/publicUserProfileService";
import {
  PROFILE_VEHICLE_GROUP_LABEL,
  countProfileVehiclesByGroup,
  filterProfileVehicles,
  profileVehicleGroup,
  profileVehicleName,
  sortProfileVehicles,
  type ProfileVehicleGroup,
  type ProfileVehicleSort,
} from "@/features/users/utils/profileVehicles";
import { formatMoney } from "@/features/booking/utils/format";
import { getChatRooms } from "@/features/chat/chatService";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { canReport, openViolations } from "@/features/violations/violationNavigation";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PublicUserProfileScreenProps = {
  onBack: () => void;
  /** Mở hồ sơ người khác (ví dụ người viết đánh giá). */
  onOpenProfile?: (userId: number) => void;
  /** Mở chi tiết xe liên quan. */
  onViewVehicle?: (vehicleId: number) => void;
  /** Mở đơn thuê khi bấm "Xem đơn" trong cửa sổ chat. */
  onOpenBooking?: (bookingId: number) => void;
  userId: number;
};

type ProfileView = "main" | "detail" | "reviews" | "category";

type ContentTab = "products" | "categories";

const CATEGORY_ORDER: ProfileVehicleGroup[] = ["motorbike", "car"];

const SORT_LABEL: Record<ProfileVehicleSort, string> = {
  popular: "Phổ biến",
  recent: "Mới nhất",
  priceDesc: "Giá: Cao → Thấp",
  priceAsc: "Giá: Thấp → Cao",
};

/** Thẻ xe 1 cột: ảnh 84px + tên + khu vực + giá thuê/ngày. */
function ProfileVehicleCard({
  vehicle,
  onViewVehicle,
}: {
  vehicle: PublicProfileVehicle;
  onViewVehicle?: (vehicleId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={({ pressed }) => [styles.vehicleCard, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`Xem xe ${profileVehicleName(vehicle)}`}
      disabled={!onViewVehicle}
      onPress={() => onViewVehicle?.(vehicle.id)}
    >
      <View style={styles.vehicleMedia}>
        {vehicle.primaryImage ? (
          <Image
            source={{ uri: vehicle.primaryImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <CarFront color={theme.faint} size={22} />
        )}
      </View>
      <View style={styles.vehicleInfo}>
        <AppText style={styles.vehicleName} numberOfLines={1}>
          {profileVehicleName(vehicle)}
        </AppText>
        <View style={styles.vehicleMeta}>
          <MapPin color={theme.faint} size={11} />
          <AppText style={styles.vehicleMetaText} numberOfLines={1}>
            {vehicle.address || "Chưa cập nhật khu vực"}
          </AppText>
        </View>
        <View style={styles.vehicleFooter}>
          <View style={styles.vehiclePriceRow}>
            <AppText style={styles.vehiclePrice}>{formatMoney(vehicle.pricePerDay)}</AppText>
            <AppText style={styles.vehicleUnit}>/ngày</AppText>
          </View>
          <View style={styles.vehicleTypeBadge}>
            <AppText style={styles.vehicleTypeText}>
              {vehicle.vehicleType === "Car" ? "Ô tô" : "Xe máy"}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const MemoVehicleCard = memo(ProfileVehicleCard);

/** Thanh sắp xếp dùng chung cho tab Sản phẩm và trang danh mục. */
function VehicleSortBar({
  sort,
  onChange,
  styles,
}: {
  sort: ProfileVehicleSort;
  onChange: (sort: ProfileVehicleSort) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const priceActive = sort === "priceDesc" || sort === "priceAsc";
  const priceIcon = priceActive
    ? sort === "priceAsc"
      ? ArrowUpNarrowWide
      : ArrowDownWideNarrow
    : ArrowDownUp;

  return (
    <View style={styles.filterRow}>
      <SortCell
        label="Phổ biến"
        active={sort === "popular"}
        onPress={() => onChange("popular")}
        styles={styles}
      />
      <SortCell
        label="Mới nhất"
        active={sort === "recent"}
        onPress={() => onChange("recent")}
        styles={styles}
        divider
      />
      <SortCell
        label="Giá"
        active={priceActive}
        icon={priceIcon}
        onPress={() =>
          onChange(priceActive && sort === "priceDesc" ? "priceAsc" : "priceDesc")
        }
        styles={styles}
        divider
      />
    </View>
  );
}

function SortCell({
  label,
  active,
  icon: Icon,
  divider,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  icon?: typeof ArrowDownUp;
  divider?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterCell, divider && styles.filterCellDivider]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Sắp xếp ${label}`}
    >
      <AppText
        style={[styles.filterText, active && styles.filterTextActive]}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {Icon ? (
        <Icon color={active ? theme.brand : theme.muted} size={12} strokeWidth={2.2} />
      ) : null}
    </Pressable>
  );
}

/** Màn 1: hồ sơ công khai của chủ xe (avatar, điểm, chat, sản phẩm/danh mục). */
export default function PublicUserProfileScreen({
  onBack,
  onOpenProfile,
  onViewVehicle,
  onOpenBooking,
  userId,
}: PublicUserProfileScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((state) => state.user?.userId ?? null);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<ProfileView>("main");
  const [contentTab, setContentTab] = useState<ContentTab>("products");
  const [vehicleSort, setVehicleSort] = useState<ProfileVehicleSort>("popular");
  const [categoryGroup, setCategoryGroup] = useState<ProfileVehicleGroup>("motorbike");
  const [reviewRole, setReviewRole] = useState<PublicProfileReviewRole>("owner");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!Number.isInteger(userId) || userId <= 0) {
        setStatus("notfound");
        return;
      }
      if (!silent) {
        setStatus("loading");
        setErrorMessage("");
      }
      try {
        const data = await getPublicUserProfile(userId);
        setProfile(data);
        setStatus("ready");
      } catch (error) {
        if (isPublicProfileNotFound(error)) {
          setStatus("notfound");
          return;
        }
        if (silent) {
          Alert.alert("Không thể làm mới hồ sơ", "Vui lòng kiểm tra kết nối và thử lại.");
          return;
        }
        setErrorMessage("Không thể tải hồ sơ. Vui lòng thử lại.");
        setStatus("error");
      } finally {
        if (silent) setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    setProfile(null);
    setView("main");
    setContentTab("products");
    setVehicleSort("popular");
    setCategoryGroup("motorbike");
    setReviewRole("owner");
    setSearchQuery("");
    setChatRoomId(null);
  }, [userId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  useEffect(() => {
    if (chatRoomId == null && view === "main") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (chatRoomId != null) {
        setChatRoomId(null);
        return true;
      }
      if (view === "reviews") {
        setView(profile?.isOwner ? "detail" : "main");
        return true;
      }
      if (view === "detail" || view === "category") {
        setView("main");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [chatRoomId, view, profile?.isOwner]);

  /** Đếm số đánh giá gắn với từng xe từ dữ liệu công khai của hồ sơ. */
  const vehicleReviewCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const review of profile?.reviews ?? []) {
      if (review.vehicleId == null) continue;
      counts.set(review.vehicleId, (counts.get(review.vehicleId) ?? 0) + 1);
    }
    return counts;
  }, [profile?.reviews]);

  const sortedVehicles = useMemo(
    () =>
      sortProfileVehicles(
        filterProfileVehicles(profile?.vehicles ?? [], searchQuery),
        vehicleSort,
        vehicleReviewCounts,
      ),
    [profile?.vehicles, searchQuery, vehicleSort, vehicleReviewCounts],
  );

  const categoryCounts = useMemo(
    () => countProfileVehiclesByGroup(profile?.vehicles ?? []),
    [profile?.vehicles],
  );

  const categoryVehicles = useMemo(
    () =>
      sortProfileVehicles(
        (profile?.vehicles ?? []).filter(
          (vehicle) => profileVehicleGroup(vehicle) === categoryGroup,
        ),
        vehicleSort,
        vehicleReviewCounts,
      ),
    [profile?.vehicles, categoryGroup, vehicleSort, vehicleReviewCounts],
  );

  const target = profile
    ? { targetType: "User" as const, targetId: profile.userId, label: profile.fullName }
    : null;

  function openReviews(role: PublicProfileReviewRole) {
    setReviewRole(role);
    setView("reviews");
  }

  function openCategory(group: ProfileVehicleGroup) {
    if (categoryCounts[group] === 0) return;
    setCategoryGroup(group);
    setSearchQuery("");
    setView("category");
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    if (value) setContentTab("products");
  }

  async function handleOpenChat() {
    if (!profile || chatLoading) return;
    setChatLoading(true);
    try {
      const result = await getChatRooms({ page: 1, pageSize: 50 });
      const me = useAuthStore.getState().user?.userId;
      if (!me) return;
      const room = result.items
        .filter(
          (item) =>
            (item.customerId === me && item.ownerId === profile.userId) ||
            (item.ownerId === me && item.customerId === profile.userId),
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
      if (room) {
        setChatRoomId(room.id);
        return;
      }
      Alert.alert(
        "Chưa có phòng chat",
        "Hiện chỉ hỗ trợ mở phòng chat có sẵn từ đơn thuê. Hãy đặt xe hoặc mở chi tiết chuyến đi để nhắn tin.",
      );
    } catch {
      Alert.alert("Không mở được trò chuyện", "Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleShare() {
    if (!profile) return;
    setMenuOpen(false);
    try {
      const role = profile.isOwner ? "Chủ xe" : "Khách thuê";
      await Share.share({
        message: `${profile.fullName} · ${role} trên MoveVN${
          profile.isOwner ? ` · ${profile.totalVehicles} xe đang cho thuê` : ""
        }`,
      });
    } catch {
      // Người dùng đóng hộp thoại chia sẻ — không cần báo lỗi.
    }
  }

  function handleReport() {
    if (!target) return;
    setMenuOpen(false);
    openViolations({ target });
  }

  if (status === "loading") {
    return (
      <View style={styles.root}>
        <ProfileHeader onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.brand} size="large" />
        </View>
      </View>
    );
  }

  if (status === "notfound") {
    return (
      <View style={styles.root}>
        <ProfileHeader onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <View style={styles.stateIcon}>
            <UserX color={theme.faint} size={28} />
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
        <ProfileHeader onBack={onBack} title="Hồ sơ người dùng" />
        <View style={styles.centerBox}>
          <View style={styles.stateIcon}>
            <RotateCw color={theme.faint} size={26} />
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
            <RotateCw color={theme.onBrand} size={13} />
            <AppText style={styles.retryText}>Thử lại</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (chatRoomId) {
    return (
      <ChatRoomScreen
        roomId={chatRoomId}
        onBack={() => setChatRoomId(null)}
        onBookingPress={(bookingId) => {
          setChatRoomId(null);
          onOpenBooking?.(bookingId);
        }}
        onOpenUserProfile={onOpenProfile}
      />
    );
  }

  if (view === "detail" && profile.isOwner) {
    return (
      <View style={styles.root}>
        <ProfileHeader onBack={() => setView("main")} title="Chi tiết Chủ xe" />
        <OwnerProfileDetail
          profile={profile}
          onOpenReviews={() => openReviews("owner")}
          onOpenVehicles={() => {
            setContentTab("products");
            setView("main");
          }}
        />
      </View>
    );
  }

  if (view === "reviews") {
    return (
      <View style={styles.root}>
        <ProfileHeader
          onBack={() => setView(profile.isOwner ? "detail" : "main")}
          title={reviewRole === "owner" ? "Đánh giá chủ xe" : "Đánh giá khách thuê"}
        />
        <OwnerReviewsPanel
          profile={profile}
          initialRole={reviewRole}
          allowRoleSwitch={profile.isOwner}
          onRoleChange={setReviewRole}
          onOpenProfile={onOpenProfile}
          onOpenVehicle={onViewVehicle}
        />
      </View>
    );
  }

  if (view === "category" && profile.isOwner) {
    return (
      <View style={styles.root}>
        <ProfileHeader
          onBack={() => setView("main")}
          title={`Danh mục: ${PROFILE_VEHICLE_GROUP_LABEL[categoryGroup]}`}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <VehicleSortBar sort={vehicleSort} onChange={setVehicleSort} styles={styles} />

          <View style={styles.contentPad}>
            <View style={styles.sectionHead}>
              <AppText style={styles.sectionTitle} numberOfLines={1}>
                Tổng số xe trong danh mục ({categoryVehicles.length})
              </AppText>
              <AppText style={styles.sectionHint} numberOfLines={1}>
                {`Sắp xếp: ${SORT_LABEL[vehicleSort]}`}
              </AppText>
            </View>

            {categoryVehicles.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.stateIcon}>
                  <CarFront color={theme.faint} size={20} />
                </View>
                <AppText style={styles.emptyTitle}>Danh mục chưa có xe</AppText>
                <AppText style={styles.emptyText}>
                  Xe đã được duyệt thuộc danh mục này sẽ xuất hiện tại đây.
                </AppText>
              </View>
            ) : (
              <View style={styles.vehicleList}>
                {categoryVehicles.map((vehicle) => (
                  <MemoVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onViewVehicle={onViewVehicle}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  const rating = profile.isOwner ? profile.ownerAverageRating : profile.customerAverageRating;
  const ratingCount = profile.isOwner ? profile.ownerReviewCount : profile.customerReviewCount;
  const tripCount = profile.isOwner
    ? profile.completedTripsAsOwner
    : profile.completedTripsAsCustomer;
  const chatLabel = profile.isOwner ? "Chat với chủ xe này" : "Chat với khách thuê này";
  const showChat = currentUserId != null && currentUserId !== profile.userId;
  const verifiedColor = theme.mode === "dark" ? "#34D399" : "#059669";

  return (
    <View style={styles.root}>
      <ProfileHeader
        onBack={onBack}
        title={profile.isOwner ? undefined : "Hồ sơ người dùng"}
        search={
          profile.isOwner
            ? {
                value: searchQuery,
                onChangeText: handleSearch,
                placeholder: "Tìm xe trong Shop…",
              }
            : undefined
        }
        onMenuPress={() => setMenuOpen(true)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        }
      >
        <View style={styles.ownerCard}>
          <Pressable
            disabled={!profile.isOwner}
            onPress={() => setView("detail")}
            accessibilityRole={profile.isOwner ? "button" : undefined}
            accessibilityLabel={profile.isOwner ? "Xem chi tiết chủ xe" : undefined}
            style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
          >
            <View style={styles.avatarWrap}>
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                fullName={profile.fullName}
                size={48}
              />
              {profile.isOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={styles.ownerBody}>
              <View style={styles.ownerNameRow}>
                <AppText display style={styles.ownerName} numberOfLines={1}>
                  {profile.fullName}
                </AppText>
                {profile.isVerified ? (
                  <View style={styles.verifiedPill}>
                    <BadgeCheck color={verifiedColor} size={10} />
                    <AppText style={[styles.verifiedPillText, { color: verifiedColor }]}>
                      Đã xác minh
                    </AppText>
                  </View>
                ) : null}
                {profile.isOwner ? (
                  <ChevronRight
                    color={theme.faint}
                    size={16}
                    style={styles.ownerChevron}
                  />
                ) : null}
              </View>
              <View style={styles.statsRow}>
                {rating == null ? (
                  <AppText style={styles.statMuted}>Chưa có đánh giá</AppText>
                ) : (
                  <View style={styles.statGroup}>
                    <Star color="#FBBF24" fill="#FBBF24" size={12} />
                    <AppText style={styles.statStrong}>{rating.toFixed(1)}</AppText>
                    <AppText style={styles.statMuted}>({ratingCount})</AppText>
                  </View>
                )}
                <View style={styles.statDivider} />
                <AppText style={styles.statMuted}>
                  <AppText style={styles.statStrong}>{tripCount}</AppText> Chuyến
                </AppText>
                {profile.isOwner ? (
                  <>
                    <View style={styles.statDivider} />
                    <AppText style={styles.statMuted}>
                      <AppText style={styles.statStrong}>{profile.totalVehicles}</AppText> Xe
                    </AppText>
                  </>
                ) : null}
              </View>
            </View>
          </Pressable>

          {showChat ? (
            <Pressable
              onPress={handleOpenChat}
              disabled={chatLoading}
              style={({ pressed }) => [styles.chatBar, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={chatLabel}
            >
              <MessageCircle color={theme.brand} size={15} />
              <AppText style={styles.chatLabel}>{chatLabel}</AppText>
              {chatLoading ? (
                <ActivityIndicator color={theme.brand} size="small" />
              ) : (
                <ChevronRight color={theme.brand} size={14} />
              )}
            </Pressable>
          ) : null}
        </View>

        {profile.isOwner ? (
          <>
            <View style={styles.shopBar}>
              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => setContentTab("products")}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: contentTab === "products" }}
                >
                  <AppText
                    style={[
                      styles.tabText,
                      contentTab === "products" && styles.tabTextActive,
                    ]}
                  >
                    Sản phẩm
                  </AppText>
                  {contentTab === "products" ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
                <Pressable
                  onPress={() => setContentTab("categories")}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: contentTab === "categories" }}
                >
                  <AppText
                    style={[
                      styles.tabText,
                      contentTab === "categories" && styles.tabTextActive,
                    ]}
                  >
                    Danh mục
                  </AppText>
                  {contentTab === "categories" ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
              </View>

              {contentTab === "products" ? (
                <VehicleSortBar sort={vehicleSort} onChange={setVehicleSort} styles={styles} />
              ) : null}
            </View>

            {contentTab === "products" ? (
              <View style={styles.contentPad}>
                <View style={styles.sectionHead}>
                  <AppText style={styles.sectionTitle}>
                    Tổng số xe ({profile.totalVehicles})
                  </AppText>
                  <AppText style={styles.sectionHint}>
                    {searchQuery.trim()
                      ? `${sortedVehicles.length} kết quả`
                      : `Sắp xếp: ${SORT_LABEL[vehicleSort]}`}
                  </AppText>
                </View>

                {sortedVehicles.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <View style={styles.stateIcon}>
                      <Search color={theme.faint} size={20} />
                    </View>
                    <AppText style={styles.emptyTitle}>
                      {searchQuery.trim()
                        ? "Không tìm thấy xe phù hợp"
                        : "Chưa có xe được công khai"}
                    </AppText>
                    <AppText style={styles.emptyText}>
                      {searchQuery.trim()
                        ? `Không có kết quả cho "${searchQuery.trim()}".`
                        : "Các xe đã được duyệt sẽ xuất hiện tại đây."}
                    </AppText>
                    {searchQuery.trim() ? (
                      <Pressable onPress={() => setSearchQuery("")} accessibilityRole="button">
                        <AppText style={styles.clearSearchText}>Xoá tìm kiếm</AppText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.vehicleList}>
                    {sortedVehicles.map((vehicle) => (
                      <MemoVehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onViewVehicle={onViewVehicle}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.contentPad}>
                <View style={styles.categoryList}>
                  {CATEGORY_ORDER.map((group) => {
                    const count = categoryCounts[group];
                    const empty = count === 0;
                    return (
                      <Pressable
                        key={group}
                        onPress={() => openCategory(group)}
                        disabled={empty}
                        style={({ pressed }) => [
                          styles.categoryCard,
                          empty && styles.categoryCardEmpty,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${PROFILE_VEHICLE_GROUP_LABEL[group]} ${count} xe`}
                      >
                        <View style={[styles.categoryIcon, empty && styles.categoryIconEmpty]}>
                          {group === "car" ? (
                            <CarFront color={empty ? theme.faint : theme.brand} size={17} />
                          ) : (
                            <Bike color={empty ? theme.faint : theme.brand} size={17} />
                          )}
                        </View>
                        <View style={styles.categoryBody}>
                          <AppText style={styles.categoryLabel}>
                            {PROFILE_VEHICLE_GROUP_LABEL[group]}
                          </AppText>
                          <AppText style={styles.categoryCount}>
                            {empty ? "0 xe" : `${count} xe đang cho thuê`}
                          </AppText>
                        </View>
                        <ChevronRight color={theme.faint} size={16} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.contentPad}>
            <View style={styles.sectionHead}>
              <AppText style={styles.sectionTitle}>Đánh giá nhận được</AppText>
            </View>
            <Pressable
              onPress={() => openReviews("customer")}
              style={({ pressed }) => [styles.reviewEntry, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Xem ${profile.customerReviewCount} đánh giá`}
            >
              <View style={styles.reviewEntryIcon}>
                <Star color="#F59E0B" fill="#F59E0B" size={15} />
              </View>
              <View style={styles.reviewEntryBody}>
                <AppText style={styles.reviewEntryTitle}>Đánh giá từ chủ xe</AppText>
                <AppText style={styles.reviewEntryHint}>
                  {profile.customerReviewCount > 0
                    ? `${profile.customerReviewCount} đánh giá sau các chuyến thuê`
                    : "Chưa có đánh giá nào"}
                </AppText>
              </View>
              {profile.customerAverageRating != null ? (
                <View style={styles.reviewEntryScore}>
                  <AppText style={styles.reviewEntryScoreValue}>
                    {profile.customerAverageRating.toFixed(1)}
                  </AppText>
                  <ProfileStars rating={profile.customerAverageRating} size={9} />
                </View>
              ) : null}
              <ChevronRight color={theme.faint} size={16} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuCard, { top: insets.top + 52 }]}>
            <MenuItem
              icon={RefreshCw}
              label="Làm mới hồ sơ"
              onPress={() => {
                setMenuOpen(false);
                handleRefresh();
              }}
              theme={theme}
            />
            <MenuItem icon={Share2} label="Chia sẻ hồ sơ" onPress={handleShare} theme={theme} />
            {target && canReport(target) ? (
              <MenuItem
                icon={Flag}
                label="Báo cáo vi phạm"
                onPress={handleReport}
                danger
                theme={theme}
              />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onPress,
  danger,
  theme,
}: {
  icon: typeof RefreshCw;
  label: string;
  onPress: () => void;
  danger?: boolean;
  theme: Theme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color = danger ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon color={color} size={16} />
      <AppText style={[styles.menuItemText, { color }]}>{label}</AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
    pressed: { opacity: 0.7 },

    ownerCard: {
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      marginBottom: 6,
    },
    ownerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarWrap: { width: 48, height: 48 },
    onlineDot: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.surface,
      backgroundColor: theme.success,
    },
    ownerBody: { flex: 1, minWidth: 0, gap: 4 },
    ownerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    ownerName: {
      flexShrink: 1,
      color: theme.text,
      fontFamily: "Quicksand_700Bold",
      fontSize: 15,
      lineHeight: 20,
    },
    ownerChevron: { marginLeft: "auto" },
    verifiedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(52,211,153,0.3)" : "#A7F3D0",
      backgroundColor: theme.mode === "dark" ? "rgba(52,211,153,0.12)" : "#ECFDF5",
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    verifiedPillText: {
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 9.5,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    statGroup: { flexDirection: "row", alignItems: "center", gap: 3 },
    statStrong: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    statMuted: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 11,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 10,
      marginHorizontal: 1,
      backgroundColor: theme.border,
    },

    chatBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 34,
      marginTop: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
    },
    chatLabel: {
      flex: 1,
      color: theme.brand,
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 12,
    },

    shopBar: { backgroundColor: theme.surface },
    tabRow: {
      flexDirection: "row",
      height: 40,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
    tabText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 12,
    },
    tabTextActive: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
    },
    tabIndicator: {
      position: "absolute",
      bottom: 0,
      width: 56,
      height: 2.5,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
      backgroundColor: theme.brand,
    },

    filterRow: {
      flexDirection: "row",
      height: 36,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    filterCell: {
      flex: 1,
      height: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    filterCellDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.border,
    },
    filterText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 12,
    },
    filterTextActive: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
    },

    contentPad: { paddingHorizontal: 12, paddingTop: 10, gap: 10 },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      flexShrink: 1,
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    sectionHint: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 11,
    },

    categoryList: { gap: 8 },
    categoryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    categoryCardEmpty: { opacity: 0.6 },
    categoryIcon: {
      width: 36,
      height: 36,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    categoryIconEmpty: { backgroundColor: theme.surfaceAlt },
    categoryBody: { flex: 1, minWidth: 0, gap: 1 },
    categoryLabel: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    categoryCount: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
    },

    vehicleList: { gap: 8 },
    vehicleCard: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 8,
    },
    vehicleMedia: {
      width: 84,
      height: 84,
      borderRadius: 8,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    vehicleInfo: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
    vehicleName: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 13,
      lineHeight: 17,
    },
    vehicleMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
    vehicleMetaText: {
      flexShrink: 1,
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
    },
    vehicleFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    vehiclePriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2, flexShrink: 1 },
    vehiclePrice: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_800ExtraBold",
      fontSize: 14,
    },
    vehicleUnit: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
    },
    vehicleTypeBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    vehicleTypeText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 10,
    },

    emptyBox: {
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    emptyTitle: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
      textAlign: "center",
    },
    emptyText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
      lineHeight: 15,
      textAlign: "center",
    },
    clearSearchText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 11,
    },

    reviewEntry: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    reviewEntryIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.mode === "dark" ? "#34280F" : "#FFF6E2",
    },
    reviewEntryBody: { flex: 1, minWidth: 0, gap: 2 },
    reviewEntryTitle: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    reviewEntryHint: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 11,
    },
    reviewEntryScore: { alignItems: "flex-end", gap: 2 },
    reviewEntryScoreValue: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },

    centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
    stateIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
    },
    stateTitle: {
      color: theme.text,
      fontFamily: "Quicksand_700Bold",
      fontSize: 16,
      textAlign: "center",
    },
    stateDesc: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      borderRadius: 9,
      backgroundColor: theme.brand,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    retryText: {
      color: theme.onBrand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },

    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(16, 25, 54, 0.18)",
    },
    menuCard: {
      position: "absolute",
      right: 12,
      minWidth: 200,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 4,
      shadowColor: theme.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    menuItemPressed: { backgroundColor: theme.surfaceAlt },
    menuItemText: {
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 12,
    },
  });
