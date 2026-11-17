import { useAssistantUi } from "@/features/assistant/useAssistantUi";
import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import CustomerExploreScreen from "@/features/app/screens/CustomerExploreScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import VehicleListScreen from "@/features/vehicles/screens/VehicleListScreen";
import CreateBookingScreen from "@/features/booking/screens/CreateBookingScreen";
import type { QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import type { AuthUser } from "@/features/auth/types";
import { getDefaultRentalPeriod } from "@/features/vehicles/utils/rentalPeriod";
import type { ExploreStackParamList } from "./types";

import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreNavigator({
  user,
  onAvatarPress,
  onRouteChange,
  onBookingCreated,
  quickBook,
  onConsumedQuickBook,
  onGoDeals,
  pendingVehicleId,
  onConsumedVehicle,
  openVehicleListRequest,
  onConsumedVehicleListRequest,
  onOpenUserProfile,
}: {
  user: AuthUser;
  onAvatarPress: () => void;
  onRouteChange?: (routeName: string) => void;
  onBookingCreated?: (bookingId: number) => void;
  quickBook?: QuickBookParams | null;
  onConsumedQuickBook?: () => void;
  onGoDeals?: () => void;
  pendingVehicleId?: number | null;
  onConsumedVehicle?: () => void;
  /** Tăng lên 1 mỗi lần ví voucher bấm "Dùng ngay" → mở thẳng danh sách xe. */
  openVehicleListRequest?: number;
  onConsumedVehicleListRequest?: () => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  // Giữ navigation của stack để điều hướng đặt xe nhanh từ chatbot
  // (handler phải ở ngoài Navigator — Navigator chỉ render Screen).
  const exploreNavRef = useRef<NativeStackNavigationProp<ExploreStackParamList> | null>(null);
  const consumedQuickBookRef = useRef<QuickBookParams | null>(null);
  useEffect(() => {
    onRouteChange?.("ExploreMain");
  }, [onRouteChange]);
  useEffect(() => () => useAssistantUi.getState().setVehicleDetailId(null), []);
  useEffect(() => {
    if (!quickBook || consumedQuickBookRef.current === quickBook || !exploreNavRef.current) return;
    consumedQuickBookRef.current = quickBook;
    if (quickBook.vehicleId) {
      exploreNavRef.current.navigate("CreateBooking", {
        vehicleId: quickBook.vehicleId,
        startDate: quickBook.startAt ?? undefined,
        endDate: quickBook.endAt ?? undefined,
        promoCode: quickBook.promoCode ?? undefined,
        pickupAddress: quickBook.pickupAddress ?? undefined,
        returnAddress: quickBook.returnAddress ?? undefined,
        customerNote: quickBook.customerNote ?? undefined,
      });
    }
    onConsumedQuickBook?.();
  }, [quickBook, onConsumedQuickBook]);

  useEffect(() => {
    if (!pendingVehicleId || !exploreNavRef.current) return;
    exploreNavRef.current.navigate("VehicleDetail", { vehicleId: pendingVehicleId });
    onConsumedVehicle?.();
  }, [pendingVehicleId, onConsumedVehicle]);

  // Từ ví voucher: "Dùng ngay" → mở danh sách xe với khoảng thuê mặc định.
  useEffect(() => {
    if (!openVehicleListRequest) return;
    const nav = exploreNavRef.current;
    if (!nav) return;
    const period = getDefaultRentalPeriod();
    nav.navigate("VehicleList", {
      type: "",
      province: "",
      district: "",
      startDate: period.startDate,
      endDate: period.endDate,
    });
    onConsumedVehicleListRequest?.();
  }, [openVehicleListRequest, onConsumedVehicleListRequest]);

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      screenListeners={{
        state: (e) => {
          const state = e.data.state;
          if (!state) return;
          const route = state.routes[state.index];
          if (route?.name) onRouteChange?.(route.name);
          const vehicleId = (route?.params as { vehicleId?: unknown } | undefined)?.vehicleId;
          useAssistantUi.getState().setVehicleDetailId(route?.name === "VehicleDetail" && typeof vehicleId === "number" && Number.isSafeInteger(vehicleId) && vehicleId > 0 ? vehicleId : null);
        },
      }}
    >
      <Stack.Screen name="ExploreMain">
        {({ navigation }) => {
          exploreNavRef.current = navigation;
          return (
            <CustomerExploreScreen
              user={user}
              onAvatarPress={onAvatarPress}
              onSearch={(params) => navigation.navigate("VehicleList", params)}
              onVehiclePress={(params) => navigation.navigate("VehicleDetail", params)}
              onPromoSeeAll={onGoDeals}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="VehicleList" component={VehicleListScreen} />
      <Stack.Screen name="VehicleDetail">
        {(props) => (
          <VehicleDetailScreen
            {...props}
            onBookPress={(p) => props.navigation.navigate("CreateBooking", p)}
            onOpenUserProfile={onOpenUserProfile}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateBooking">
        {(props) => <CreateBookingScreen {...props} onCreated={(bookingId) => onBookingCreated?.(bookingId)} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
