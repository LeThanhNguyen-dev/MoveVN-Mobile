import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CarFront,
  Check,
  ClipboardCheck,
  Plus,
  RotateCcw,
} from "lucide-react-native";
import type { AuthUser } from "@/features/auth/types";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import OwnerAnalyticsScreen from "@/features/ownerAnalytics/OwnerAnalyticsScreen";
import {
  getOwnerOverview,
  type OwnerOverview,
} from "@/features/owner/services/ownerOverviewService";
import AppText from "@/components/AppText";
import AppAvatar from "@/components/ui/AppAvatar";
import AppButton from "@/components/ui/AppButton";
import BrandButton from "@/components/ui/BrandButton";
import AppSegmentedControl from "@/components/ui/AppSegmentedControl";
import MobileBrandHeader, {
  type ExperiencePage,
} from "../components/MobileBrandHeader";
import MobilityGuideScreen from "./MobilityGuideScreen";
import SupportCenterScreen from "./SupportCenterScreen";
import useExperienceBack from "../components/useExperienceBack";
import { useTheme } from "@/theme/useTheme";

const empty: OwnerOverview = {
  fleet: null,
  pending: null,
  returned: null,
  errors: {},
};
export default function OwnerOverviewScreen({
  user,
  onAvatarPress,
  onAddVehicle,
  onVehicles,
  onBookings,
}: {
  user: AuthUser;
  onAvatarPress?: () => void;
  onAddVehicle: () => void;
  onVehicles: () => void;
  onBookings: (status?: string, bookingId?: number) => void;
}) {
  const { theme } = useTheme();
  const [page, setPage] = useState<ExperiencePage | "analytics">("home");
  useExperienceBack(page !== "home", () => setPage("home"));
  const [data, setData] = useState<OwnerOverview>(empty);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const setActiveRole = useAuthStore((state) => state.setActiveRole);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void getOwnerOverview(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  const summary = data.fleet?.summary;
  const count = (value?: number) => (loading ? "…" : (value ?? "—"));
  const metrics = [
    {
      label: "Chờ duyệt",
      value: data.pending?.totalCount,
      icon: ClipboardCheck,
      color: "#F08419",
      bg: theme.warningSoft,
      status: "Pending",
    },
    {
      label: "Chờ nhận lại",
      value: data.returned?.totalCount,
      icon: RotateCcw,
      color: theme.info,
      bg: theme.infoSoft,
      status: "Returned",
    },
    {
      label: "Giao trong 24h",
      value: summary?.pickupsNext24Hours,
      icon: CarFront,
      color: theme.brand,
      bg: theme.brandSoft,
    },
    {
      label: "Nhận trong 24h",
      value: summary?.returnsNext24Hours,
      icon: CalendarDays,
      color: theme.success,
      bg: theme.successSoft,
    },
  ];
  if (page === "analytics")
    return (
      <OwnerAnalyticsScreen
        user={user}
        onAvatarPress={onAvatarPress}
        onBack={() => setPage("home")}
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MobileBrandHeader
        onNavigate={setPage}
        activePage={page}
        onAccount={onAvatarPress}
        onBack={page !== "home" ? () => setPage("home") : undefined}
      />
      {page === "support" ? (
        <SupportCenterScreen embedded onBack={() => setPage("home")} />
      ) : page !== "home" ? (
        <MobilityGuideScreen
          key={page}
          owner={page === "owners"}
          registeredOwner
          onSearch={() => {
            void setActiveRole("Customer");
          }}
          onBecomeOwner={onAddVehicle}
          onShowOwners={() => setPage("owners")}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => setReload((n) => n + 1)}
              tintColor={theme.brand}
              colors={[theme.brandSolid]}
            />
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem hồ sơ tài khoản"
            onPress={onAvatarPress}
            style={styles.greeting}
          >
            <AppAvatar name={user.fullName} uri={user.avatarUrl} size={38} />
            <View style={styles.flex}>
              <AppText style={{ color: theme.muted, fontSize: 12 }}>
                Xin chào!
              </AppText>
              <AppText
                numberOfLines={1}
                style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}
              >
                {user.fullName}
              </AppText>
            </View>
          </Pressable>
          {user.roles.includes("Customer") && (
            <AppSegmentedControl<"Customer" | "Owner">
              value="Owner"
              onChange={(role) => {
                if (role !== "Owner") void setActiveRole(role);
              }}
              items={[
                { value: "Customer", label: "Khách thuê" },
                { value: "Owner", label: "Chủ xe" },
              ]}
            />
          )}
          <View style={[styles.overview, panel]}>
            <View style={styles.greeting}>
              <View style={[styles.icon, { backgroundColor: theme.brandSoft }]}>
                <BarChart3 size={24} color={theme.brand} />
              </View>
              <View style={styles.flex}>
                <AppText
                  display
                  style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}
                >
                  Tổng quan chủ xe
                </AppText>
                <AppText style={{ color: theme.muted, fontSize: 12 }}>
                  Công việc hôm nay, trong tầm tay.
                </AppText>
              </View>
            </View>
            <BrandButton
              title="Thêm xe"
              onPress={onAddVehicle}
              icon={<Plus size={20} color="#FFFFFF" />}
            />
          </View>
          <View style={styles.grid}>
            {metrics.map(({ icon: Icon, ...item }) => (
              <Pressable
                key={item.label}
                accessibilityRole={item.status ? "button" : undefined}
                accessibilityLabel={`${item.label}: ${count(item.value)}`}
                onPress={
                  item.status ? () => onBookings(item.status) : undefined
                }
                style={[styles.metric, panel]}
              >
                <View style={[styles.icon, { backgroundColor: item.bg }]}>
                  <Icon size={21} color={item.color} />
                </View>
                <AppText style={{ color: theme.muted, fontSize: 12, flex: 1 }}>
                  {item.label}
                </AppText>
                <AppText
                  display
                  style={{
                    color: theme.text,
                    fontSize: 25,
                    fontWeight: "700",
                    width: "100%",
                    paddingLeft: 46,
                  }}
                >
                  {count(item.value)}
                </AppText>
              </Pressable>
            ))}
          </View>
          {!loading && Object.keys(data.errors).length > 0 && (
            <View
              style={[
                styles.overview,
                {
                  backgroundColor: theme.warningSoft,
                  borderColor: theme.warningSoft,
                },
              ]}
            >
              <AppText style={{ color: theme.warning, fontSize: 13 }}>
                {Object.values(data.errors).join("\n")}
              </AppText>
              <AppButton
                title="Thử lại"
                variant="secondary"
                onPress={() => setReload((n) => n + 1)}
              />
            </View>
          )}
          <View style={styles.sectionHead}>
            <AppText
              display
              style={[styles.sectionTitle, { color: theme.text }]}
            >
              Cần xử lý
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => onBookings()}
              style={styles.link}
            >
              <AppText style={{ color: theme.brand, fontSize: 12 }}>
                Xem tất cả →
              </AppText>
            </Pressable>
          </View>
          {loading ? (
            <AppText style={{ color: theme.muted }}>
              Đang tải công việc...
            </AppText>
          ) : data.pending &&
            data.returned &&
            data.pending.totalCount + data.returned.totalCount === 0 ? (
            <View style={[styles.empty, panel]}>
              <View
                style={[styles.check, { backgroundColor: theme.brandSoft }]}
              >
                <Check color={theme.brand} size={26} />
              </View>
              <AppText
                style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}
              >
                Bạn đã xử lý hết công việc
              </AppText>
              <AppText
                style={{
                  color: theme.muted,
                  textAlign: "center",
                  fontSize: 12,
                }}
              >
                Không có yêu cầu chờ duyệt hay chuyến chờ nhận lại xe.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {[
                ...(data.pending?.items ?? []).map((booking) => ({
                  booking,
                  label: "Chờ duyệt",
                  color: theme.warning,
                })),
                ...(data.returned?.items ?? []).map((booking) => ({
                  booking,
                  label: "Chờ nhận lại xe",
                  color: theme.info,
                })),
              ].map(({ booking, label, color }) => (
                <Pressable
                  key={booking.id}
                  accessibilityRole="button"
                  onPress={() => onBookings(undefined, booking.id)}
                  style={[styles.work, panel]}
                >
                  <View style={styles.flex}>
                    <AppText style={{ color, fontSize: 11, fontWeight: "600" }}>
                      {label}
                    </AppText>
                    <AppText
                      style={{
                        color: theme.text,
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {booking.vehicleName || booking.bookingCode}
                    </AppText>
                    <AppText style={{ color: theme.muted, fontSize: 12 }}>
                      {booking.customerName || booking.bookingCode}
                    </AppText>
                  </View>
                  <ArrowRight size={19} color={theme.brand} />
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.sectionHead}>
            <AppText
              display
              style={[styles.sectionTitle, { color: theme.text }]}
            >
              Đội xe của bạn
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem đội xe"
              onPress={onVehicles}
              style={styles.link}
            >
              <ArrowRight size={19} color={theme.brand} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {[
              {
                label: "Đang trống",
                value: summary?.available,
                color: theme.success,
              },
              {
                label: "Đang thuê",
                value: summary?.rented,
                color: theme.brand,
              },
              {
                label: "Quá giờ trả",
                value: summary?.overdue,
                color: theme.danger,
              },
              { label: "Chặn lịch", value: summary?.blocked, color: "#F08419" },
            ].map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={onVehicles}
                style={[styles.fleet, panel]}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <View style={styles.flex}>
                  <AppText style={{ color: theme.muted, fontSize: 12 }}>
                    {item.label}
                  </AppText>
                  <AppText
                    style={{
                      color: theme.text,
                      fontSize: 19,
                      fontWeight: "700",
                    }}
                  >
                    {count(item.value)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
          {!loading && summary?.vehicles === 0 && (
            <View style={[styles.empty, panel]}>
              <CarFront size={30} color={theme.brand} />
              <AppText style={{ color: theme.text, fontWeight: "700" }}>
                Chưa có xe nào
              </AppText>
              <AppText style={{ color: theme.muted, fontSize: 12 }}>
                Thêm chiếc xe đầu tiên để bắt đầu.
              </AppText>
              <AppButton
                title="Thêm xe đầu tiên"
                variant="secondary"
                onPress={onAddVehicle}
              />
            </View>
          )}
          <AppButton
            title="Thống kê hiệu quả đội xe"
            variant="secondary"
            icon={<BarChart3 size={20} color={theme.brand} />}
            onPress={() => setPage("analytics")}
          />
          <AppText
            style={{ color: theme.faint, fontSize: 11, textAlign: "center" }}
          >
            Số liệu vận hành · Giờ Việt Nam UTC+7
          </AppText>
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  flex: { flex: 1, minWidth: 0 },
  greeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  overview: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 14 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexBasis: "46%",
    flexGrow: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 10,
    rowGap: 4,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  link: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  work: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fleet: {
    flexBasis: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
});
