import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { ArrowRight, BarChart3, CalendarCheck, CarFront, CheckCheck, ChevronRight, ClipboardList, MapPinned, Plus, RefreshCw, RotateCcw, Wallet } from "lucide-react-native";
import AppText from "@/components/AppText";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import { formatDateTime } from "@/features/booking/utils/format";
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
  onOpenAnalytics: () => void;
  onOpenFleet: () => void;
};

export default function OwnerOverviewScreen({ user, onAvatarPress, onOpenVehicles, onOpenVehicle, onOpenBookings, onOpenBooking, onOpenWallet, onOpenAnalytics, onOpenFleet }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createDashboardStyles(theme), [theme]);
  const { operations, business, operationsError, businessError, loading, refresh } = useOwnerDashboard(user.userId, true);

  const shortcuts = [
    { label: t("owner:home.actions.addVehicle"), icon: Plus, onPress: () => onOpenVehicles(true), color: theme.brand, background: theme.brandSoft },
    { label: t("owner:analytics.actions.bookings"), icon: CalendarCheck, onPress: onOpenBookings, color: theme.info, background: theme.infoSoft },
    { label: t("accountWallet:title"), icon: Wallet, onPress: onOpenWallet, color: theme.success, background: theme.successSoft },
    { label: t("mobile:ownerHome.shortcuts.analytics"), icon: BarChart3, onPress: onOpenAnalytics, color: theme.brand, background: theme.brandSoft },
    { label: t("mobile:ownerHome.shortcuts.fleet"), icon: MapPinned, onPress: onOpenFleet, color: theme.info, background: theme.infoSoft },
  ];

  return <View style={styles.root}>
    <View style={styles.header}><AppDashboardHeader user={user} onAvatarPress={onAvatarPress} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.brand} colors={[theme.brand]} />}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroDecoration} />
        <View style={styles.heroTop}>
          <AppText style={styles.eyebrow}>{t("mobile:ownerHome.hero.eyebrow")}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:ownerHome.hero.refreshAria")} onPress={refresh} disabled={loading} style={styles.iconButton}>
            {loading ? <ActivityIndicator size="small" color={theme.brand} /> : <RefreshCw size={17} color={theme.brand} />}
          </Pressable>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.flex}>
            <AppText display style={styles.heading}>{t("mobile:ownerHome.hero.title")}</AppText>
            <AppText style={styles.description}>{t("mobile:ownerHome.hero.description")}</AppText>
            <AppText style={styles.heroCaption}>{t("mobile:ownerHome.hero.caption")}</AppText>
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
        <AppText display style={styles.sectionTitle}>{t("mobile:ownerHome.operations.title")}</AppText>
        <Pressable accessibilityRole="button" onPress={onOpenBookings} style={styles.linkButton}><AppText style={styles.link}>{t("mobile:ownerHome.operations.viewAll")}</AppText><ArrowRight size={14} color={theme.brand} /></Pressable>
      </View>
      {operationsError ? <View style={styles.panel}><AppText accessibilityRole="alert" style={styles.error}>{operationsError}</AppText><Pressable onPress={refresh} accessibilityRole="button" style={styles.linkButton}><AppText style={styles.link}>{t("common:retry")}</AppText></Pressable></View> : <>
        <View style={styles.operationGrid}>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.brandSoft }]}><ClipboardList color={theme.brand} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.pendingCount) : "—"}</AppText><AppText style={styles.caption}>{t("mobile:ownerHome.operations.pending")}</AppText></View>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.infoSoft }]}><RotateCcw color={theme.info} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.returnedCount) : "—"}</AppText><AppText style={styles.caption}>{t("mobile:ownerHome.operations.returned")}</AppText></View>
          <View style={styles.operation}><View style={[styles.smallIcon, { backgroundColor: theme.successSoft }]}><CarFront color={theme.success} size={18} /></View><AppText style={styles.count}>{operations ? number(operations.activeCount) : "—"}</AppText><AppText style={styles.caption}>{t("mobile:ownerHome.operations.active")}</AppText></View>
        </View>
        {operations && (operations.tasks.length ? <View style={styles.panel}>
          {operations.tasks.map((booking, index) => <Pressable key={booking.id} accessibilityRole="button" accessibilityLabel={t("mobile:ownerHome.operations.viewBookingAria", { code: booking.bookingCode })} onPress={() => onOpenBooking(booking.id)} style={[styles.task, index > 0 && styles.taskDivider]}>
            <View style={styles.taskIcon}>{booking.vehicleImage ? <Image source={booking.vehicleImage} style={styles.taskImage} contentFit="cover" /> : <CarFront size={22} color={theme.brand} />}</View>
            <View style={styles.flex}>
              <AppText style={[styles.taskStatus, { color: booking.status === "Returned" ? theme.info : theme.brand }]}>{booking.status === "Returned" ? t("mobile:ownerHome.operations.confirmReturn") : t("mobile:ownerHome.operations.newRequest")}</AppText>
              <AppText numberOfLines={1} style={styles.taskTitle}>{booking.vehicleName || t("owner:home.worklists.vehicleFallback", { id: booking.vehicleId })}</AppText>
              <AppText numberOfLines={1} style={styles.caption}>{booking.customerName || booking.bookingCode}</AppText>
              <AppText style={styles.smallText}>{(booking.status === "Returned" ? t("mobile:ownerHome.operations.returnSchedule") : t("mobile:ownerHome.operations.pickupSchedule")) + " "}{formatDateTime(booking.status === "Returned" ? booking.endDate : booking.startDate)}</AppText>
            </View><ChevronRight size={17} color={theme.faint} />
          </Pressable>)}
          {operations.pendingCount + operations.returnedCount > operations.tasks.length && <Pressable accessibilityRole="button" onPress={onOpenBookings} style={styles.allTasks}><AppText style={styles.link}>{t("mobile:ownerHome.operations.moreTasks")}</AppText><ArrowRight size={14} color={theme.brand} /></Pressable>}
        </View> : <View style={styles.caughtUp}><View style={[styles.smallIcon, { backgroundColor: theme.successSoft }]}><CheckCheck size={22} color={theme.success} /></View><View style={styles.flex}><AppText style={styles.taskTitle}>{t("mobile:ownerHome.operations.emptyTitle")}</AppText><AppText style={styles.caption}>{t("mobile:ownerHome.operations.emptyHint")}</AppText></View></View>)}
      </>}

      <View style={styles.sectionHeading}><AppText display style={styles.sectionTitle}>{t("mobile:ownerHome.business.title")}</AppText><Pressable accessibilityRole="button" onPress={onOpenAnalytics} style={styles.linkButton}><AppText style={styles.link}>{t("mobile:ownerHome.business.viewAnalytics")}</AppText><ArrowRight size={14} color={theme.brand} /></Pressable></View>
      {businessError ? <View style={styles.panel}><AppText accessibilityRole="alert" style={styles.error}>{businessError}</AppText><Pressable accessibilityRole="button" onPress={refresh} style={styles.linkButton}><AppText style={styles.link}>{t("common:retry")}</AppText></Pressable></View> : <View style={styles.business}>
        <View style={styles.linkButton}><Wallet color={theme.brand} size={17} /><AppText style={styles.businessLabel}>{t("mobile:ownerHome.business.walletIncome")}</AppText></View>
        <AppText display style={styles.income}>{business ? money(business.summary.walletIncome) : "—"}</AppText>
        <AppText style={styles.caption}>{business ? comparison(business.summary.walletIncome, business.previousSummary.walletIncome) : t("mobile:ownerHome.business.loading")}</AppText>
        {business && <AppText style={styles.smallText}>{shortDate(business.period.fromDate)} – {shortDate(business.period.toDate)}</AppText>}
        <View style={styles.businessMetrics}>
          <View style={styles.flex}><AppText style={styles.metricValue}>{business ? number(business.summary.completedTrips) : "—"}</AppText><AppText style={styles.caption}>{t("owner:analytics.metrics.completedTrips")}</AppText></View>
          <View style={styles.metricDivider} />
          <View style={styles.flex}><AppText style={styles.metricValue}>{business ? (business.summary.averageRating == null ? t("owner:analytics.metrics.noRating") : `${number(business.summary.averageRating)}/5`) : "—"}</AppText><AppText style={styles.caption}>{t("owner:analytics.metrics.rating")}</AppText></View>
        </View>
        <AppText style={styles.smallText}>{t("mobile:ownerHome.business.disclaimer")}</AppText>
      </View>}

      <View style={styles.sectionHeading}><AppText display style={styles.sectionTitle}>{t("mobile:ownerHome.fleet.title")}{operations ? ` · ${operations.vehicleCount}` : ""}</AppText><Pressable accessibilityRole="button" onPress={() => onOpenVehicles()} style={styles.linkButton}><AppText style={styles.link}>{t("mobile:ownerHome.fleet.manage")}</AppText><ArrowRight size={14} color={theme.brand} /></Pressable></View>
      {operations && <View style={styles.panel}>
        {operations.vehicles.length ? operations.vehicles.map((vehicle, index) => <Pressable key={vehicle.id} accessibilityRole="button" onPress={() => onOpenVehicle(vehicle.id)} style={[styles.task, index > 0 && styles.taskDivider]}>
          <View style={styles.taskIcon}>{vehicle.featuredImage ? <Image source={vehicle.featuredImage} style={styles.taskImage} contentFit="cover" /> : <CarFront size={22} color={theme.brand} />}</View>
          <View style={styles.flex}><AppText numberOfLines={1} style={styles.taskTitle}>{vehicle.brandName} {vehicle.modelName}</AppText><AppText style={styles.caption}>{vehicle.licensePlate}</AppText></View><ChevronRight size={17} color={theme.faint} />
        </Pressable>) : <View style={styles.empty}><CarFront size={30} color={theme.brand} /><AppText style={styles.taskTitle}>{t("mobile:ownerHome.fleet.emptyTitle")}</AppText><AppText style={styles.caption}>{t("mobile:ownerHome.fleet.emptyHint")}</AppText><Pressable accessibilityRole="button" onPress={() => onOpenVehicles(true)} style={styles.addButton}><Plus color={theme.onBrand} size={17} /><AppText style={styles.addText}>{t("owner:home.actions.addVehicle")}</AppText></Pressable></View>}
      </View>}
    </ScrollView>
  </View>;
}
