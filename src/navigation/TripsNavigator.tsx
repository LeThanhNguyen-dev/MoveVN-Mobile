import PublicUserProfileScreen from "@/features/users/screens/PublicUserProfileScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import WalletScreen from "@/features/wallets/screens/WalletScreen";
import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripDetailScreen from "@/features/booking/screens/TripDetailScreen";
import TripListScreen from "@/features/booking/screens/TripListScreen";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import ContractDetailScreen from "@/features/contracts/screens/ContractDetailScreen";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import type { TripsStackParamList } from "./types";
import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<TripsStackParamList>();

export default function TripsNavigator({
  pendingBookingId,
  onConsumedPending,
  onRouteChange,
  onOpenDisputes,
  onOpenUserProfile,
}: {
  pendingBookingId: number | null;
  onConsumedPending: () => void;
  onRouteChange?: (route: string) => void;
  onOpenDisputes?: (prefill: DisputeCreatePrefill) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const consumedRef = useRef(false);
  const hasPending = pendingBookingId != null;

  // Mở thẳng chi tiết khi vừa tạo booking xong (dùng initialParams thay vì
  // navigate tay lúc mount để tránh race "not handled by any navigator").
  useEffect(() => {
    if (hasPending && !consumedRef.current) {
      onRouteChange?.("TripDetail");
      consumedRef.current = true;
      onConsumedPending();
    }
  }, [hasPending, onConsumedPending, onRouteChange]);

  return (
    <Stack.Navigator
      initialRouteName={hasPending ? "TripDetail" : "TripList"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      screenListeners={({ route }) => ({ focus: () => onRouteChange?.(route.name) })}
    >

      <Stack.Screen name="TripList" component={TripListScreen} />
      <Stack.Screen
        name="TripDetail"
        initialParams={hasPending ? { bookingId: pendingBookingId! } : undefined}
      >
        {(props) => (
          <TripDetailScreen {...props} onOpenDisputes={onOpenDisputes} onOpenUserProfile={onOpenUserProfile} />
        )}
      </Stack.Screen>
      <Stack.Screen name="TripHandover">{(props) => <TripDetailScreen {...props} onOpenDisputes={onOpenDisputes} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
      <Stack.Screen name="BookingWallet">{({ navigation }) => <WalletScreen onBack={() => navigation.goBack()} />}</Stack.Screen>
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="BookingUserProfile">{({ route, navigation }) => <PublicUserProfileScreen userId={route.params.userId} onBack={() => navigation.goBack()} onOpenProfile={userId => navigation.push("BookingUserProfile", { userId })} onViewVehicle={vehicleId => navigation.navigate("VehicleDetail", { vehicleId })} onOpenBooking={bookingId => navigation.navigate("TripDetail", { bookingId })} />}</Stack.Screen>
      <Stack.Screen name="BookingChat">{({ route, navigation }) => <ChatRoomScreen bookingId={route.params.bookingId} onBack={() => navigation.goBack()} onBookingPress={() => navigation.goBack()} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
      <Stack.Screen name="ContractDetail">
        {({ route, navigation }) => (
          <ContractDetailScreen contract={route.params.contract} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
