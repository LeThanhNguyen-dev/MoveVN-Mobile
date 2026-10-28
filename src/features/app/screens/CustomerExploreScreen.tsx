import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  Copy,
  MapPin,
  Motorbike,
  Search,
  TicketPercent,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import * as Clipboard from "expo-clipboard";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { HomepageBanner } from "@/features/banners/types";
import { getHomepageBanners } from "@/features/banners/services/bannerService";
import { showToast } from "@/features/notifications/toastStore";
import OwnerVerificationScreen from "@/features/owner/screens/OwnerVerificationScreen";
import VehicleListCard from "@/features/vehicles/components/VehicleListCard";
import VehicleCardSkeleton from "@/features/vehicles/components/VehicleCardSkeleton";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import AreaPickerSheet from "@/features/vehicles/components/AreaPickerSheet";
import { getPublicVehicles } from "@/features/vehicles/services/publicVehicleService";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import {
  calculateRentalDays,
  formatPeriodSummary,
  getDefaultRentalPeriod,
} from "@/features/vehicles/utils/rentalPeriod";
import { loadSearchPrefs, saveSearchPrefs } from "@/features/vehicles/utils/searchPrefs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type VehicleTab = "Car" | "Motorbike";

// Ảnh nền phủ tràn cả topbar, theo mode sáng/tối:
// - Sáng: cầu Rồng Đà Nẵng ban ngày; - Tối: cùng khung cảnh ban đêm.
// Bố cục đối xứng nên căn giữa, màn hẹp crop đều 2 bên.
const HERO_IMAGE_LIGHT = require("../../../../public/images/Gemini_Generated_Image_rpsnyhrpsnyhrpsn.png");
const HERO_IMAGE_DARK = require("../../../../public/images/Gemini_Generated_Image_rpsnyhrpsnyhrpsn (1).png");

// Khối top (nền + header + card) cao theo nội dung — ảnh absolute-fill nên
// luôn phủ hết card tới tận ô giờ giấc, không cần tính overlap thủ công.

// Accent cố định của search card (giữ nguyên cả 2 mode).
// Riêng nền card / tabs / ô nhập theo theme: sáng nền trắng đặc,
// tối nền tím-than để không bị chói trên ảnh nền.
const HERO = {
  tabActiveBg: "#7c3aed",
  tabActiveText: "#ffffff",
  tabIdleTextLight: "#5215a2",
  tabIdleTextDark: "#C4B5FD",
  fieldIcon: "#7c3aed",
  ctaFrom: "#6b19ff",
  ctaVia: "#7c3aed",
  ctaTo: "#d946ef",
  ctaText: "#ffffff",
} as const;

// Section khuyến mãi render đúng dữ liệu bảng Banners (PostgreSQL) qua
// GET /api/banners/homepage — mirror web HomePage + PromotionCarousel:
// Admin upload ảnh Cloudinary tại /admin/banners, backend lọc IsActive +
// StartAt/EndAt và sort DisplayOrder, frontend giữ nguyên thứ tự trả về.

// Mirror web HomePage.tsx: destinations (Địa Điểm Nổi Bật) —
// name/description/image y hệt web, bấm vào tìm xe theo tỉnh tương ứng.
const FEATURED_DESTINATIONS = [
  {
    name: "Hà Nội",
    description: "Những chuyến đi qua phố cổ và ngoại ô xanh mát.",
    image:
      "https://images.unsplash.com/photo-1529369623266-f5264b696110?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "TP. Hồ Chí Minh",
    description: "Khám phá nhịp sống sôi động theo cách riêng của bạn.",
    image:
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Đà Nẵng",
    description: "Từ biển xanh đến những cung đường quanh bán đảo.",
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Nha Trang",
    description: "Chủ động hành trình biển nắng cùng chiếc xe phù hợp.",
    image:
      "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Đà Lạt",
    description: "Đón sương sớm và những cung đèo đầy cảm hứng.",
    image:
      "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Phú Quốc",
    description: "Tự do đi dọc bờ biển và khám phá đảo ngọc.",
    image:
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=800&q=80",
  },
];

// 2 dịch vụ thuê xe tự lái thật của MoveVN (không có thuê tài xế):
// bấm CTA đi thẳng màn danh sách đã lọc sẵn Ô tô / Xe máy.
const HIGHLIGHT_SERVICES = [
  {
    key: "car",
    vehicleType: "Car" as const,
    title: "Thuê Xe Ô Tô",
    desc: "Tự do điều khiển hành trình riêng tư bên gia đình, phong cách, tiện dụng với kho xe đa dạng.",
    cta: "Tìm xe ô tô",
    image:
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "motorbike",
    vehicleType: "Motorbike" as const,
    title: "Thuê Xe Máy",
    desc: "Gọn nhẹ, tiết kiệm chi phí — linh hoạt cho di chuyển nội thành và những chuyến phượt ngắn ngày.",
    cta: "Tìm xe máy",
    image:
      "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
  },
];

// Mirror web HomePage.tsx: features (Sự Khác Biệt Cho Trải Nghiệm Thuê Xe) —
// web dùng ảnh minh họa riêng, mobile dùng icon Lucide tương ứng đặt bên trái.
const ADVANTAGES = [
  {
    key: "shield",
    title: "An Toàn Tuyệt Đối",
    desc: "Xe được kiểm tra kỹ thuật và hỗ trợ bảo hiểm trước mỗi hành trình.",
  },
  {
    key: "card",
    title: "Thanh Toán Đa Dạng",
    desc: "Thanh toán rõ ràng, linh hoạt qua các phương thức bảo mật trên MoveVN.",
  },
  {
    key: "pin",
    title: "Giao Xe Tận Nơi",
    desc: "Chọn điểm nhận xe thuận tiện tại sân bay, nhà ga hoặc ngay tại nhà.",
  },
  {
    key: "car",
    title: "Đa Dạng Dòng Xe",
    desc: "Từ xe máy gọn nhẹ đến sedan và SUV cho mọi nhu cầu di chuyển.",
  },
  {
    key: "file",
    title: "Thủ Tục Đơn Giản",
    desc: "Xác thực nhanh, hợp đồng rõ ràng và mọi thông tin đều được lưu trên ứng dụng.",
  },
  {
    key: "support",
    title: "Hỗ Trợ Trọn Hành Trình",
    desc: "Theo dõi lịch nhận trả xe và nhận hỗ trợ xuyên suốt chuyến đi của bạn.",
  },
] as const;

const HOST_BANNER_IMAGE = require("../../../../public/images/Gemini_Generated_Image_g3r482g3r482g3r4.png");

function formatBannerDiscount(banner: HomepageBanner): string | null {
  if (banner.discountValue == null) return null;
  if (banner.discountType === "Fixed")
    return `${Number(banner.discountValue).toLocaleString("vi-VN")}đ`;
  return `${banner.discountValue}%`;
}

function formatBannerVehicleType(vehicleType?: string | null): string | null {
  if (vehicleType === "Motorbike") return "Xe máy";
  if (vehicleType === "Car") return "Ô tô";
  if (vehicleType === "All") return "Tất cả xe";
  return null;
}

function formatBannerEndDate(endAt?: string | null): string | null {
  if (!endAt) return null;
  const d = new Date(endAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Popup chi tiết banner — mirror web PromotionDetailModal:
 * ảnh 16:9 + popupTitle/Description + chips (mã, giảm giá, loại xe, HSD) +
 * CTA popupCtaLabel (chỉ hiện khi banner gắn Promotion hợp lệ).
 */
function BannerDetailSheet({
  banner,
  onClose,
  onCtaPress,
}: {
  banner: HomepageBanner | null;
  onClose: () => void;
  onCtaPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    setCodeCopied(false);
  }, [banner?.id]);

  if (!banner) return null;
  const discount = formatBannerDiscount(banner);
  const vehicleLabel = formatBannerVehicleType(banner.vehicleType);
  const endLabel = formatBannerEndDate(banner.endAt);
  const code = banner.promotionCode ?? null;
  // Banner gắn Promotion: Promotion là source of truth cho tiêu đề (giống backend/web).
  const effectiveTitle =
    banner.promotionName || banner.popupTitle || banner.title || "Chi tiết khuyến mãi";
  // CTA chỉ hiện khi có promotion hợp lệ (tránh orphan PromotionId).
  const hasPromotion =
    banner.promotionId != null && (banner.promotionCode != null || banner.promotionName != null);

  function handleCopyCode() {
    if (!code) return;
    void Clipboard.setStringAsync(code).then(() => setCodeCopied(true));
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng chi tiết khuyến mãi"
        />
        <View style={styles.sheetCard}>
          <Pressable
            onPress={onClose}
            style={styles.sheetClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            hitSlop={8}
          >
            <X color={theme.muted} size={18} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!!banner.imageUrl && (
              <Image
                source={{ uri: banner.imageUrl }}
                style={styles.sheetImage}
                contentFit="cover"
                transition={250}
                accessibilityLabel={banner.title}
              />
            )}

            <View style={styles.sheetBody}>
              <AppText display style={styles.sheetTitle}>{effectiveTitle}</AppText>
              <View style={styles.sheetDivider} />

              {!!banner.popupDescription && (
                <AppText style={styles.sheetDesc}>{banner.popupDescription}</AppText>
              )}

              <View style={styles.chipRow}>
                {!!code && (
                  <Pressable
                    onPress={handleCopyCode}
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityLabel={`Sao chép mã ${code}`}
                  >
                    {codeCopied ? (
                      <Check color={theme.brand} size={13} />
                    ) : (
                      <Copy color={theme.brand} size={13} />
                    )}
                    <AppText style={styles.chipText}>{codeCopied ? "Đã sao chép!" : code}</AppText>
                  </Pressable>
                )}
                {!!discount && (
                  <View style={styles.chip}>
                    <TicketPercent color={theme.brand} size={13} />
                    <AppText style={styles.chipText}>Giảm {discount}</AppText>
                  </View>
                )}
                {!!vehicleLabel && (
                  <View style={styles.chip}>
                    <Car color={theme.brand} size={13} />
                    <AppText style={styles.chipText}>{vehicleLabel}</AppText>
                  </View>
                )}
                {!!endLabel && (
                  <View style={styles.chip}>
                    <CalendarDays color={theme.brand} size={13} />
                    <AppText style={styles.chipText}>HSD: {endLabel}</AppText>
                  </View>
                )}
              </View>

              {hasPromotion ? (
                <Pressable
                  style={styles.sheetCta}
                  onPress={onCtaPress}
                  accessibilityRole="button"
                  accessibilityLabel={banner.popupCtaLabel || "Nhận voucher"}
                >
                  <AppText style={styles.sheetCtaText}>{banner.popupCtaLabel || "Nhận voucher"}</AppText>
                  <ArrowRight color={theme.onBrand} size={16} />
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <AppText display style={styles.sectionTitle}>{title}</AppText>
        <View style={styles.sectionAccent} />
        {subtitle ? <AppText style={styles.sectionSubtitle}>{subtitle}</AppText> : null}
      </View>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={styles.sectionAction}
          hitSlop={8}
        >
          <AppText style={styles.sectionActionText}>{actionLabel}</AppText>
          <ChevronRight color={theme.brand} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const ADV_SHIELD_LOGO = require("../../../../public/images/adv-safety.png");
const ADV_PAYMENT_LOGO = require("../../../../public/images/adv-payment.png");
const ADV_DELIVERY_LOGO = require("../../../../public/images/adv-delivery.png");
const ADV_VARIETY_LOGO = require("../../../../public/images/adv-variety.png");
const ADV_PAPERWORK_LOGO = require("../../../../public/images/adv-paperwork.png");
const ADV_SUPPORT_LOGO = require("../../../../public/images/adv-support.png");

function AdvLogo({ source, label }: { source: number; label: string }) {
  return (
    <Image
      source={source}
      style={{ width: 40, height: 40, borderRadius: 10 }}
      contentFit="contain"
      transition={200}
      accessibilityLabel={label}
    />
  );
}

function AdvantageIcon({ iconKey }: { iconKey: string }) {
  switch (iconKey) {
    case "shield":
      return <AdvLogo source={ADV_SHIELD_LOGO} label="An toàn tuyệt đối" />;
    case "card":
      return <AdvLogo source={ADV_PAYMENT_LOGO} label="Thanh toán đa dạng" />;
    case "pin":
      return <AdvLogo source={ADV_DELIVERY_LOGO} label="Giao xe tận nơi" />;
    case "car":
      return <AdvLogo source={ADV_VARIETY_LOGO} label="Đa dạng dòng xe" />;
    case "file":
      return <AdvLogo source={ADV_PAPERWORK_LOGO} label="Thủ tục đơn giản" />;
    default:
      return <AdvLogo source={ADV_SUPPORT_LOGO} label="Hỗ trợ trọn hành trình" />;
  }
}

export default function CustomerExploreScreen({
  onAvatarPress,
  onBellPress,
  onSearch,
  onVehiclePress,
  onPromoSeeAll,
  user,
}: {
  onAvatarPress?: () => void;
  onBellPress?: () => void;
  onSearch?: (params: ExploreStackParamList["VehicleList"]) => void;
  onVehiclePress?: (params: ExploreStackParamList["VehicleDetail"]) => void;
  /** Chuyển sang tab Ưu đãi (màn Khuyến mãi). Không truyền thì fallback danh sách xe. */
  onPromoSeeAll?: () => void;
  user: AuthUser;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  // Kéo nội dung lên dưới status bar để ảnh nền phủ từ top:0 kịch đỉnh máy.
  const topInset = insets.top;

  const [searchTab, setSearchTab] = useState<VehicleTab>("Car");
  // Mặc định TP. Hồ Chí Minh theo thiết kế; địa điểm đã lưu trên máy sẽ ghi đè khi focus.
  const [province, setProvince] = useState("TP. Hồ Chí Minh");
  const [district, setDistrict] = useState("");
  const [areaId, setAreaId] = useState<number | undefined>(undefined);
  const [defaultPeriod] = useState(() => getDefaultRentalPeriod());
  const [startDate, setStartDate] = useState(defaultPeriod.startDate);
  const [endDate, setEndDate] = useState(defaultPeriod.endDate);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [areaVisible, setAreaVisible] = useState(false);
  const [error, setError] = useState("");

  const [featured, setFeatured] = useState<VehicleListItemResponse[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState<HomepageBanner | null>(null);
  const [showOwnerVerify, setShowOwnerVerify] = useState(false);
  const activeRole = useAuthStore((state) => state.activeRole);
  const setActiveRole = useAuthStore((state) => state.setActiveRole);

  // Hiện sẵn địa điểm đã chọn lần gần nhất (lưu trên máy).
  // Dùng focus (không chỉ mount) để quay về từ màn List vẫn thấy chỗ mới chọn.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadSearchPrefs().then((prefs) => {
        if (cancelled || !prefs) return;
        setProvince(prefs.province);
        setDistrict(prefs.district);
        setAreaId(prefs.areaId);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    async function loadFeatured() {
      setFeaturedLoading(true);
      setFeaturedError("");
      try {
        const result = await getPublicVehicles({ page: 1, pageSize: 6, sortBy: "rating_desc" });
        if (!cancelled) setFeatured(result.items);
      } catch {
        if (!cancelled) setFeaturedError("Không tải được xe nổi bật. Kiểm tra mạng rồi thử lại.");
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }
    async function loadBanners() {
      setBannersLoading(true);
      try {
        const data = await getHomepageBanners();
        if (!cancelled) setBanners(Array.isArray(data) ? data : []);
      } catch {
        // API lỗi: ẩn section để không hiện ảnh tĩnh cũ (giống web HomePage).
        if (!cancelled) setBanners([]);
      } finally {
        if (!cancelled) setBannersLoading(false);
      }
    }
    void loadFeatured();
    void loadBanners();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rentalDays = calculateRentalDays(startDate, endDate);
  const periodText = formatPeriodSummary(startDate, endDate);
  const areaText = province ? `${province}${district ? ` · ${district}` : ""}` : "";
  const tabIdleColor = theme.mode === "dark" ? HERO.tabIdleTextDark : HERO.tabIdleTextLight;
  function buildSearchParams(
    provinceOverride?: string,
    typeOverride?: "Car" | "Motorbike",
  ): ExploreStackParamList["VehicleList"] {
    if (provinceOverride) {
      return {
        type: typeOverride ?? searchTab,
        province: provinceOverride,
        district: "",
        areaId: undefined,
        startDate,
        endDate,
      };
    }
    return {
      type: typeOverride ?? searchTab,
      province,
      district,
      areaId,
      startDate,
      endDate,
    };
  }

  function handleSearch() {
    if (!province) {
      setError("Vui lòng chọn địa điểm thuê xe.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Vui lòng chọn thời gian thuê xe.");
      return;
    }
    if (rentalDays <= 0) {
      setError("Thời gian trả xe phải sau thời gian nhận xe.");
      return;
    }
    setError("");
    void saveSearchPrefs({ province, district, areaId });
    onSearch?.(buildSearchParams());
  }

  // Card thành phố / sân bay / "Xem tất cả": đi thẳng màn danh sách xe.
  function handleQuickSearch(targetProvince: string) {
    onSearch?.(buildSearchParams(targetProvince));
  }

  function handleSeeAllVehicles() {
    onSearch?.(buildSearchParams());
  }

  // CTA card dịch vụ: đi thẳng màn danh sách đã lọc sẵn Ô tô / Xe máy (link thật).
  function handleServiceSearch(vehicleType: "Car" | "Motorbike") {
    onSearch?.(buildSearchParams(undefined, vehicleType));
  }

  // "Săn tất cả" + CTA popup banner -> tab Ưu đãi (màn Khuyến mãi);
  // fallback danh sách xe nếu chưa đấu nối tab.
  function handlePromoSeeAll() {
    if (onPromoSeeAll) {
      onPromoSeeAll();
      return;
    }
    handleSeeAllVehicles();
  }

  function handleBannerCta() {
    setSelectedBanner(null);
    handlePromoSeeAll();
  }

  // Bố cục hero kiểu ảnh mẫu:
  // - Nền cao cố định 360px từ kịch đỉnh màn hình, bo góc dưới ôm card.
  // - Card hạ thấp để lộ 70% ảnh nền, chỉ đè 30% rìa dưới.
  // - Card trong suốt để nhìn xuyên thấy ảnh đằng sau.
  const TOP_BG_HEIGHT = 360;
  const BG_VISIBLE_RATIO = 0.7;
  const cardOverlap = Math.round(TOP_BG_HEIGHT * (1 - BG_VISIBLE_RATIO));

  function handleOpenVehicle(vehicleId: number) {
    onVehiclePress?.({
      vehicleId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }

  // Banner chủ xe: đã là chủ xe -> chuyển thẳng sang khu vực chủ xe;
  // chưa phải -> toast + mở màn xác thực CCCD để đăng ký làm chủ xe
  // (mirror AccountTabScreen.handleRoleAction).
  function handleHostPress() {
    if (user.roles.includes("Owner") && activeRole !== "Owner") {
      void setActiveRole("Owner");
      return;
    }
    if (activeRole === "Owner") return;
    showToast({
      type: "info",
      title: "Bạn chưa là chủ xe",
      message: "Hãy xác thực CCCD để đăng ký trở thành chủ xe, sau đó bổ sung GPLX và giấy tờ xe.",
    });
    setShowOwnerVerify(true);
  }

  return (
    <View style={[styles.root, { marginTop: -topInset }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: hero full-bleed + search card đè nhẹ rìa dưới nền */}
        <View style={[styles.topBg, { height: TOP_BG_HEIGHT }]}>
          <Image
            source={theme.mode === "dark" ? HERO_IMAGE_DARK : HERO_IMAGE_LIGHT}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            transition={250}
            accessibilityLabel="MoveVN"
          />
          {theme.mode === "dark" ? <View style={styles.topBgVeil} /> : null}
          {/* padding-top cho status bar nằm TRONG khối nền, nền phủ từ top:0 */}
          <View style={{ height: topInset }} />
          <View style={styles.headerPad}>
            <AppDashboardHeader onAvatarPress={onAvatarPress} user={user} />
          </View>
        </View>

        <View style={[styles.searchCard, { marginTop: -cardOverlap }]}>
            <View style={styles.tabs}>
              <Pressable
                onPress={() => setSearchTab("Car")}
                style={[styles.tab, searchTab === "Car" && styles.tabActive]}
              >
                <Car color={searchTab === "Car" ? HERO.tabActiveText : tabIdleColor} size={16} />
                <AppText style={[styles.tabText, searchTab === "Car" && styles.tabTextActive]}>
                  Ô tô
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => setSearchTab("Motorbike")}
                style={[styles.tab, searchTab === "Motorbike" && styles.tabActive]}
              >
              <Motorbike
                color={searchTab === "Motorbike" ? HERO.tabActiveText : tabIdleColor}
                size={16}
              />
                <AppText style={[styles.tabText, searchTab === "Motorbike" && styles.tabTextActive]}>
                  Xe máy
                </AppText>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Pressable style={styles.fieldRow} onPress={() => setAreaVisible(true)}>
                <MapPin color={HERO.fieldIcon} size={18} />
                <View style={styles.fieldTextWrap}>
                  <AppText style={styles.fieldLabel}>Địa điểm</AppText>
                  <AppText
                    style={[styles.fieldValue, !areaText && styles.fieldPlaceholder]}
                    numberOfLines={1}
                  >
                    {areaText || "Chọn tỉnh / thành phố, phường / xã"}
                  </AppText>
                </View>
              </Pressable>

              <View style={styles.fieldDivider} />

              <Pressable style={styles.fieldRow} onPress={() => setSheetVisible(true)}>
                <CalendarDays color={HERO.fieldIcon} size={18} />
                <View style={styles.fieldTextWrap}>
                  <AppText style={styles.fieldLabel}>Thời gian thuê</AppText>
                  <AppText
                    style={[
                      styles.fieldValue,
                      !startDate && !endDate && styles.fieldPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {periodText}
                  </AppText>
                </View>
              </Pressable>
            </View>

            {error ? <AppText style={styles.error}>{error}</AppText> : null}

            <Pressable
              onPress={handleSearch}
              style={styles.searchButton}
              accessibilityRole="button"
              accessibilityLabel="Tìm xe"
            >
              <LinearGradient
                colors={[HERO.ctaFrom, HERO.ctaVia, HERO.ctaTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.searchButtonBg}
              >
                <Search color={HERO.ctaText} size={18} />
                <AppText style={styles.searchButtonText}>TÌM XE</AppText>
              </LinearGradient>
            </Pressable>
        </View>

        {/* SECTION 2: KHUYẾN MÃI — ảnh 16:9 từ bảng Banners, bấm mở popup chi tiết */}
        {bannersLoading || banners.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionPad}>
              <SectionHeader
                title="Chương trình khuyến mãi"
                actionLabel="Săn tất cả"
                onAction={handlePromoSeeAll}
              />
            </View>
            {bannersLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoContent}
              >
                <View style={styles.promoSkeleton} />
                <View style={styles.promoSkeleton} />
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={292}
                snapToAlignment="start"
                disableIntervalMomentum
                contentContainerStyle={styles.promoContent}
              >
                {banners.map((banner) => (
                  <Pressable
                    key={banner.id}
                    accessibilityRole="button"
                    accessibilityLabel={banner.title}
                    onPress={() => setSelectedBanner(banner)}
                    style={styles.promoCard}
                  >
                    <Image
                      source={{ uri: banner.imageUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={250}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.62)"]}
                      style={styles.promoShade}
                    />
                    <AppText display style={styles.promoTitle} numberOfLines={1}>
                      {banner.title}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* SECTION 3: ĐỊA ĐIỂM NỔI BẬT — mirror web destinations */}
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader
              title="Địa Điểm Nổi Bật"
              actionLabel="Xem tất cả xe"
              onAction={handleSeeAllVehicles}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityContent}
          >
            {FEATURED_DESTINATIONS.map((dest) => (
              <Pressable
                key={dest.name}
                accessibilityRole="button"
                accessibilityLabel={`Tìm xe tại ${dest.name}`}
                onPress={() => handleQuickSearch(dest.name)}
                style={styles.cityCard}
              >
                <Image
                  source={{ uri: dest.image }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.9)"]}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cityTextWrap}>
                  <View style={styles.cityBadge}>
                    <MapPin color="#E9D5FF" size={12} />
                    <AppText style={styles.cityBadgeText}>Điểm đến được yêu thích</AppText>
                  </View>
                  <AppText style={styles.cityName}>{dest.name}</AppText>
                  <AppText style={styles.cityDesc} numberOfLines={2}>
                    {dest.description}
                  </AppText>
                </View>
                <View style={styles.cityArrow}>
                  <ArrowRight color="#FFFFFF" size={16} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* SECTION 4: DỊCH VỤ NỔI BẬT — mirror web SERVICES, kéo ngang */}
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Dịch Vụ Nổi Bật Của MoveVN" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serviceList}
          >
              {HIGHLIGHT_SERVICES.map((service) => (
                <View key={service.key} style={styles.serviceCard}>
                  <Image
                    source={{ uri: service.image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={250}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.serviceBody}>
                    <AppText display style={styles.serviceTitle}>{service.title}</AppText>
                    <AppText style={styles.serviceDesc} numberOfLines={3}>
                      {service.desc}
                    </AppText>
                    <Pressable
                      onPress={() => handleServiceSearch(service.vehicleType)}
                      style={styles.serviceCtaTouch}
                      accessibilityRole="button"
                      accessibilityLabel={service.cta}
                    >
                      <LinearGradient
                        colors={[HERO.ctaFrom, HERO.ctaVia, HERO.ctaTo]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.serviceCtaGradient}
                      >
                        <AppText style={styles.serviceCtaTextLight}>{service.cta}</AppText>
                        <ArrowRight color="#FFFFFF" size={15} />
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
        </View>

        {/* SECTION 5: ƯU ĐIỂM MOVEVN — mirror web FEATURES, icon trái cùng hàng chữ */}
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Ưu Điểm Của MoveVN" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.advList}
          >
            {ADVANTAGES.map((item) => (
              <View key={item.key} style={styles.advCard}>
                  <View style={styles.advIcon}>
                    <AdvantageIcon iconKey={item.key} />
                  </View>
                  <View style={styles.advTextWrap}>
                    <AppText display style={styles.advTitle}>{item.title}</AppText>
                    <AppText style={styles.advDesc}>{item.desc}</AppText>
                  </View>
                </View>
              ))}
            </ScrollView>
        </View>

        {/* SECTION 6: XE NỔI BẬT */}
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader
              title="Xe nổi bật dành cho bạn"
              actionLabel="Xem tất cả"
              onAction={handleSeeAllVehicles}
            />
          </View>
          {featuredLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehicleContent}
            >
              <View style={styles.vehicleItem}>
                <VehicleCardSkeleton />
              </View>
              <View style={styles.vehicleItem}>
                <VehicleCardSkeleton />
              </View>
            </ScrollView>
          ) : featuredError ? (
            <View style={styles.sectionPad}>
              <View style={styles.inlineErrorBox}>
                <AppText style={styles.inlineErrorText}>{featuredError}</AppText>
                <Pressable style={styles.retryButton} onPress={() => setReloadKey((k) => k + 1)}>
                  <AppText style={styles.retryButtonText}>Thử lại</AppText>
                </Pressable>
              </View>
            </View>
          ) : featured.length === 0 ? (
            <View style={styles.sectionPad}>
              <AppText style={styles.emptyText}>Chưa có xe nổi bật. Hãy thử tìm xe theo địa điểm.</AppText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehicleContent}
            >
              {featured.map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleItem}>
                  <VehicleListCard
                    vehicle={vehicle}
                    onOpen={handleOpenVehicle}
                    onBook={handleOpenVehicle}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* SECTION 7: BANNER CHỦ XE */}
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <Pressable
              onPress={handleHostPress}
              style={styles.hostCard}
              accessibilityRole="button"
              accessibilityLabel="Đăng ký cho thuê xe"
            >
              <Image
                source={HOST_BANNER_IMAGE}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="center"
                transition={250}
                accessibilityLabel="Cho thuê xe cùng MoveVN"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.72)"]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.hostContent}>
                <AppText style={styles.hostEyebrow}>DÀNH CHO CHỦ XE</AppText>
                <AppText display style={styles.hostTitle}>Bạn muốn cho thuê xe?</AppText>
                <AppText style={styles.hostDesc}>
                  Hơn 15.000 chủ xe đang cho thuê hiệu quả trên MoveVN.
                </AppText>
                <View style={styles.hostButton}>
                  <AppText style={styles.hostButtonText}>Đăng ký ngay</AppText>
                  <ArrowRight color="#FFFFFF" size={15} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {showOwnerVerify ? (
        <View style={styles.ownerOverlay}>
          <OwnerVerificationScreen onBack={() => setShowOwnerVerify(false)} />
        </View>
      ) : null}

      <BannerDetailSheet
        banner={selectedBanner}
        onClose={() => setSelectedBanner(null)}
        onCtaPress={handleBannerCta}
      />

      <RentalPeriodSheet
        visible={sheetVisible}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClose={() => setSheetVisible(false)}
      />

      <AreaPickerSheet
        visible={areaVisible}
        province={province}
        district={district}
        onApply={(p, d, id) => {
          setProvince(p);
          setDistrict(d);
          setAreaId(id);
          void saveSearchPrefs({ province: p, district: d, areaId: id });
        }}
        onClose={() => setAreaVisible(false)}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    headerPad: { paddingHorizontal: 20, paddingTop: 8 },
    scroll: { flex: 1 },
    // Vừa đủ để card cuối không bị Bottom Bar nổi che (bar trong suốt nên 96 là fit).
    scrollContent: { paddingBottom: 96 },
    // 24px giữa đáy form và section kế tiếp để có khoảng thở.
    section: { marginTop: 24 },
    sectionPad: { paddingHorizontal: 20 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitleWrap: { flex: 1, marginRight: 12 },
    sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    sectionAccent: {
      width: 30,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.brand,
      marginTop: 6,
    },
    ownerOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.background,
    },
    sectionSubtitle: { color: theme.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
    sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
    sectionActionText: { color: theme.brand, fontSize: 13, fontWeight: "700" },

    // --- Section 1: hero full-bleed 360px, bo góc dưới ôm card ---
    topBg: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: "#f4efff",
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    topBgVeil: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(19, 16, 34, 0.35)",
    },
    searchCard: {
      marginHorizontal: 20,
      backgroundColor: "rgba(248,250,252,0.5)",
      borderRadius: 18,
      borderWidth: 0,
      borderColor: "transparent",
      padding: 12,
      gap: 10,
    },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.25)" : "rgba(255,255,255,0.6)",
    },
    tabActive: { backgroundColor: HERO.tabActiveBg },
    tabText: {
      color: theme.mode === "dark" ? HERO.tabIdleTextDark : HERO.tabIdleTextLight,
      fontSize: 13,
      fontWeight: "700",
    },
    tabTextActive: { color: HERO.tabActiveText },
    fieldGroup: {
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.border : "#E2E8F0",
      borderRadius: 12,
      backgroundColor: theme.mode === "dark" ? "rgba(38,32,64,0.65)" : "rgba(255,255,255,0.7)",
      overflow: "hidden",
    },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    fieldDivider: {
      height: 1,
      backgroundColor: theme.mode === "dark" ? theme.divider : "#EEF2F7",
      marginLeft: 40,
    },
    fieldTextWrap: { flex: 1 },
    fieldLabel: {
      color: theme.mode === "dark" ? theme.placeholder : "#6B7280",
      fontSize: 10,
      fontWeight: "700",
    },
    fieldValue: {
      color: theme.mode === "dark" ? theme.text : "#111827",
      fontSize: 13,
      fontWeight: "700",
      marginTop: 2,
    },
    fieldPlaceholder: {
      color: theme.mode === "dark" ? theme.placeholder : "#6B7280",
      fontWeight: "500",
    },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    searchButton: {
      borderRadius: 12,
      shadowColor: "#a855f7",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
    searchButtonBg: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 46,
      borderRadius: 12,
    },
    searchButtonText: { color: HERO.ctaText, fontSize: 14, fontWeight: "800", letterSpacing: 1 },

    // --- Section 2: homepage banners (bảng Banners, ảnh 16:9) ---
    promoContent: { paddingHorizontal: 20, gap: 12 },
    promoSkeleton: {
      width: 280,
      aspectRatio: 16 / 9,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
    },
    promoCard: {
      width: 280,
      aspectRatio: 16 / 9,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: theme.surfaceAlt,
    },
    promoShade: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    promoTitle: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 10,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },

    // --- Banner detail sheet (mirror web PromotionDetailModal) ---
    sheetOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.overlay,
      paddingHorizontal: 20,
    },
    sheetBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    sheetCard: {
      width: "100%",
      maxHeight: "82%",
      borderRadius: 20,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    sheetClose: {
      position: "absolute",
      right: 12,
      top: 12,
      zIndex: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    sheetImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.surfaceAlt },
    sheetBody: { padding: 18, gap: 10 },
    sheetTitle: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    sheetDivider: {
      alignSelf: "center",
      width: 64,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.brand,
    },
    sheetDesc: { color: theme.muted, fontSize: 13, lineHeight: 20 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipText: { color: theme.brand, fontSize: 12, fontWeight: "700" },
    sheetCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 46,
      borderRadius: 12,
      backgroundColor: theme.brand,
      marginTop: 4,
    },
    sheetCtaText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },

    // --- Section 3: destinations (mirror web) ---
    cityContent: { paddingHorizontal: 20, gap: 12 },
    cityCard: {
      width: 280,
      aspectRatio: 16 / 10,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: "#0F172A",
    },
    cityTextWrap: {
      position: "absolute",
      left: 14,
      right: 64,
      bottom: 12,
      gap: 4,
    },
    cityBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    cityBadgeText: { color: "#E9D5FF", fontSize: 11, fontWeight: "700" },
    cityName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
    cityDesc: { color: "#E2E8F0", fontSize: 12, lineHeight: 17 },
    cityArrow: {
      position: "absolute",
      right: 12,
      bottom: 12,
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },

    // --- Section 4: highlight services (mirror web SERVICES, kéo ngang) ---
    serviceList: { paddingHorizontal: 20, gap: 12 },
    serviceCard: {
      width: 300,
      height: 212,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#0F172A",
    },
    serviceBody: { flex: 1, justifyContent: "flex-end", padding: 16, gap: 6 },
    serviceTitle: { color: "#E9D5FF", fontSize: 20, fontWeight: "800" },
    serviceDesc: { color: "#D1D5DB", fontSize: 12, lineHeight: 17 },
    serviceCtaTouch: { alignSelf: "flex-start", marginTop: 6, borderRadius: 12 },
    serviceCtaGradient: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 12,
    },
    serviceCtaTextLight: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },

    // --- Section 5: advantages (mirror web FEATURES, icon trái, kéo ngang) ---
    advList: { paddingHorizontal: 20, gap: 12 },
    advCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: 280,
      backgroundColor: theme.brandSoft,
      borderRadius: 16,
      padding: 14,
    },
    advIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    advTextWrap: { flex: 1, gap: 3 },
    advTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    advDesc: { color: theme.muted, fontSize: 12, lineHeight: 17 },

    // --- Section 6: featured vehicles ---
    vehicleContent: { paddingHorizontal: 20, gap: 12 },
    vehicleItem: { width: 264 },
    inlineErrorBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 14,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
      alignItems: "flex-start",
    },
    inlineErrorText: { color: theme.muted, fontSize: 13 },
    retryButton: {
      height: 38,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    retryButtonText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
    emptyText: { color: theme.muted, fontSize: 13 },

    // --- Section 7: host banner ---
    hostCard: {
      minHeight: 232,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#1F2937",
    },
    hostContent: { flex: 1, justifyContent: "flex-end", padding: 20, gap: 8 },
    hostEyebrow: { color: "#E9D5FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    hostTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "800" },
    hostDesc: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 19 },
    hostButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      gap: 6,
      marginTop: 4,
      height: 42,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: theme.brand,
    },
    hostButtonText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
