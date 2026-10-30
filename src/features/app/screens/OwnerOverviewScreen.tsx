import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { ArrowRight, BarChart3, CalendarCheck, CarFront, CheckCheck, ChevronRight, ClipboardList, Plus, RefreshCw, RotateCcw, Wallet } from "lucide-react-native";
import AppText from "@/components/AppText";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import { formatDateTime } from "@/features/booking/utils/format";
import OwnerAnalyticsScreen from "@/features/ownerAnalytics/OwnerAnalyticsScreen";
import { comparison, money, number, shortDate } from "@/features/ownerAnalytics/types";
import { useOwnerDashboard } from "@/features/ownerDashboard/useOwnerDashboard";
import { createDashboardStyles } from "@/features/ownerDashboard/styles";
import { useTheme } from "@/theme/useTheme";

const OWNER_FLEET_ILLUSTRATION = require("../../../../public/images/1.png");

type Props = {
  user: AuthUser;
  onAvatarPress?: () => void;
  onOpenVehicles: (add?: boolean) => void;
  onOpenVehicle: (vehicleId: number) => void;
  onOpenBookings: () => void;
  onOpenBooking: (bookingId: number) => void;
  onOpenWallet: () => void;
};

export default function OwnerOverviewScreen({ user, onAvatarPress, onOpenVehicles, onOpenVehicle, onOpenBookings, onOpenBooking, onOpenWallet }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { operations, business, operationsError, businessError, loading, refresh } = useOwnerDashboard(user.userId, !showAnalytics);

  useEffect(() => {
    if (!showAnalytics) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { setShowAnalytics(false); return true; });
    return () => listener.remove();
  }, [showAnalytics]);

  if (showAnalytics) return <OwnerAnalyticsScreen user={user} onBack={() => setShowAnalytics(false)} />;

  const shortcuts = [
    { label: "Thêm xe", icon: Plus, onPress: () => onOpenVehicles(true), color: theme.brand, background: theme.brandSoft },
    { label: "Đơn thuê", icon: CalendarCheck, onPress: onOpenBookings, color: theme.info, background: theme.infoSoft },
    { label: "Ví của tôi", icon: Wallet, onPress: onOpenWallet, color: theme.success, background: theme.successSoft },
    { label: "Thống kê", icon: BarChart3, onPress: () => setShowAnalytics(true), color: theme.brand, background: theme.brandSoft },
  ];

  return <View style={styles.root}>
    <View style={styles.header}><AppDashboardHeader user={user} onAvatarPress={onAvatarPress} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.brand} colors={[theme.brand]} />}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroDecoration} />
        <View style={styles.heroTop}>
          <AppText style={styles.eyebrow}>KHÔNG GIAN CHỦ XE</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Làm mới tổng quan" onPress={refresh} disabled={loading} style={styles.iconButton}>
            {loading ? <ActivityIndicator size="small" color={theme.brand} /> : <RefreshCw size={17} color={theme.brand} />}
          </Pressable>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.flex}>
            <AppText display style={styles.heading}>Quản lý cho thuê</AppText>
            <AppText style={styles.description}>Chủ động lịch thuê, chăm chút đội xe.</AppText>
            <AppText style={styles.heroCaption}>Mọi việc trong tầm tay bạn.</AppText>
          </View>
          <View style={styles.heroArtwork} pointerEvents="none" accessible={false}>
            <Image source={OWNER_FLEET_ILLUSTRATION} style={styles.heroImage} contentFit="contain" accessible={false} />
          </View>
        </View>
      </View>
      <View style={styles.shortcuts}>
        {shortcuts.map(({ label, icon: Icon, onPress, color, background }) => <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.shortcut}>
          <View style={[styles.shortcutIcon, { backgroundColor: background }]}><Icon size={21} color={color} /></View>
          <AppText style={styles.shortcutLabel}>{label}</AppText>
        </Pressable>)}
      </View>

      <View style={styles.sectionHeading}>
        <AppText display style={styles.sectionTitle}>Cần bạn xử lý</AppText>
        <Pressable accessibilityRole="button" onPress={onOpenBookings} style={styles.linkButton}><AppText style={styles.link}>Tất cả đơn</AppText><ArrowRight size={14} color={theme.brand} /></Pressable>
      </View>
      {operationsError ? <View style={styles.panel}><AppText accessibilityRole="alert" style={styles.error}>{operationsError}</AppText><Pressable onPress={refresh} accessibilityRole="button" style={styles.linkButton}><AppText style={styles.link}>Thử lại</AppText></Pressable></View> : <>
        <View style={styles.operationGrid}>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.brandSoft }]}><ClipboardList color={theme.brand} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.pendingCount) : "—"}</AppText><AppText style={styles.caption}>Đơn chờ duyệt</AppText></View>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.infoSoft }]}><RotateCcw color={theme.info} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.returnedCount) : "—"}</AppText><AppText style={styles.caption}>Chờ nhận lại xe</AppText></View>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.successSoft }]}><CarFront color={theme.success} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.activeCount) : "—"}</AppText><AppText style={styles.caption}>Đang thuê</AppText></View>
        </View>
        {operations && (operations.tasks.length ? <View style={styles.panel}>
          {operations.tasks.map((booking, index) => <Pressable key={booking.id} accessibilityRole="button" accessibilityLabel={`Xem đơn ${booking.bookingCode}`} onPress={() => onOpenBooking(booking.id)} style={[styles.task, index > 0 && styles.taskDivider]}>
            <View style={styles.taskIcon}>{booking.vehicleImage ? <Image source={booking.vehicleImage} style={styles.taskImage} contentFit="cover" /> : <CarFront size={22} color={theme.brand} />}</View>
            <View style={styles.flex}>
              <AppText style={[styles.taskStatus, { color: booking.status === "Returned" ? theme.info : theme.brand }]}>{booking.status === "Returned" ? "Xác nhận nhận lại xe" : "Yêu cầu thuê mới"}</AppText>
              <AppText numberOfLines={1} style={styles.taskTitle}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</AppText>
              <AppText numberOfLines={1} style={styles.caption}>{booking.customerName || booking.bookingCode}</AppText>
              <AppText style={styles.smallText}>{booking.status === "Returned" ? "Lịch trả: " : "Lịch nhận: "}{formatDateTime(booking.status === "Returned" ? booking.endDate : booking.startDate)}</AppText>
            </View><ChevronRight size={17} color={theme.faint} />
          </Pressable>)}
          {operations.pendingCount + operations.returnedCount > operations.tasks.length && <Pressable accessibilityRole="button" onPress={onOpenBookings} style={styles.allTasks}><AppText style={styles.link}>Xem các đơn cần xử lý khác</AppText><ArrowRight size={14} color={theme.brand} /></Pressable>}
        </View> : <View style={styles.caughtUp}><View style={[styles.smallIcon, { backgroundColor: theme.successSoft }]}><CheckCheck size={22} color={theme.success} /></View><View style={styles.flex}><AppText style={styles.taskTitle}>Không có đơn chờ xử lý</AppText><AppText style={styles.caption}>Hiện không có đơn chờ duyệt hoặc chờ nhận lại.</AppText></View></View>)}
      </>}

      <View style={styles.sectionHeading}><AppText display style={styles.sectionTitle}>Kinh doanh tháng này</AppText><Pressable accessibilityRole="button" onPress={() => setShowAnalytics(true)} style={styles.linkButton}><AppText style={styles.link}>Xem thống kê</AppText><ArrowRight size={14} color={theme.brand} /></Pressable></View>
      {businessError ? <View style={styles.panel}><AppText accessibilityRole="alert" style={styles.error}>{businessError}</AppText><Pressable accessibilityRole="button" onPress={refresh} style={styles.linkButton}><AppText style={styles.link}>Thử lại</AppText></Pressable></View> : <View style={styles.business}>
        <View style={styles.linkButton}><Wallet color={theme.brand} size={17} /><AppText style={styles.businessLabel}>Thu nhập ghi nhận qua ví</AppText></View>
        <AppText display style={styles.income}>{business ? money(business.summary.walletIncome) : "—"}</AppText>
        <AppText style={styles.caption}>{business ? comparison(business.summary.walletIncome, business.previousSummary.walletIncome) : "Đang tổng hợp số liệu…"}</AppText>
        {business && <AppText style={styles.smallText}>{shortDate(business.period.fromDate)} – {shortDate(business.period.toDate)}</AppText>}
        <View style={styles.businessMetrics}>
          <View style={styles.flex}><AppText style={styles.metricValue}>{business ? number(business.summary.completedTrips) : "—"}</AppText><AppText style={styles.caption}>Chuyến hoàn tất</AppText></View>
          <View style={styles.metricDivider} />
          <View style={styles.flex}><AppText style={styles.metricValue}>{business ? (business.summary.averageRating == null ? "Chưa có" : `${number(business.summary.averageRating)}/5`) : "—"}</AppText><AppText style={styles.caption}>Đánh giá xe</AppText></View>
        </View>
        <AppText style={styles.smallText}>Theo giờ Việt Nam. Thu nhập qua ví không phải lợi nhuận hay số tiền đã rút.</AppText>
      </View>}

      <View style={styles.sectionHeading}><AppText display style={styles.sectionTitle}>Đội xe của bạn{operations ? ` · ${operations.vehicleCount}` : ""}</AppText><Pressable accessibilityRole="button" onPress={() => onOpenVehicles()} style={styles.linkButton}><AppText style={styles.link}>Quản lý</AppText><ArrowRight size={14} color={theme.brand} /></Pressable></View>
      {operations && <View style={styles.panel}>
        {operations.vehicles.length ? operations.vehicles.map((vehicle, index) => <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onOpenVehicle(vehicle.id)} style={[styles.task, index > 0 && styles.taskDivider]}>
          <View style={styles.taskIcon}>{vehicle.featuredImage ? <Image source={vehicle.featuredImage} style={styles.taskImage} contentFit="cover" /> : <CarFront size={22} color={theme.brand} />}</View>
          <View style={styles.flex}><AppText numberOfLines={1} style={styles.taskTitle}>{vehicle.brandName} {vehicle.modelName}</AppText><AppText style={styles.caption}>{vehicle.licensePlate}</AppText></View><ChevronRight size={17} color={theme.faint} />
        </Pressable>) : <View style={styles.empty}><CarFront size={30} color={theme.brand} /><AppText style={styles.taskTitle}>Bắt đầu với chiếc xe đầu tiên</AppText><AppText style={styles.caption}>Đăng xe để khách hàng tìm thấy bạn.</AppText><Pressable accessibilityRole="button" onPress={() => onOpenVehicles(true)} style={styles.addButton}><Plus color={theme.onBrand} size={17} /><AppText style={styles.addText}>Thêm xe</AppText></Pressable></View>}
      </View>}
    </ScrollView>
  </View>;
}
