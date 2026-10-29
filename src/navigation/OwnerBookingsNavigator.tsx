import PublicUserProfileScreen from "@/features/users/screens/PublicUserProfileScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import GpsTrackingScreen from "@/features/gps/screens/GpsTrackingScreen";
import GpsPlaybackScreen from "@/features/gps/screens/GpsPlaybackScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OwnerBookingDetailScreen from "@/features/booking/screens/OwnerBookingDetailScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import { useTheme } from "@/theme/useTheme";

export type OwnerBookingsStackParamList = {
  OwnerBookingList: undefined;
  OwnerBookingDetail: {
    bookingId: number;
  };
  OwnerBookingHandover: { bookingId: number; inspectionType: "CheckIn" | "CheckOut" };
  OwnerTracking: { bookingId: number; vehicleName?: string };
  OwnerPlayback: { bookingId: number; vehicleName?: string };
  VehicleDetail: { vehicleId: number; startDate?: string; endDate?: string };
  BookingUserProfile: { userId: number };
  BookingChat: { bookingId: number };
};

const Stack = createNativeStackNavigator<OwnerBookingsStackParamList>();

export default function OwnerBookingsNavigator({
  pendingBookingId,
  onRouteChange,
  onOpenDisputes,
  onOpenUserProfile,
}: {
  pendingBookingId?: number;
  onRouteChange?: (route: string) => void;
  onOpenDisputes?: (prefill: DisputeCreatePrefill) => void;
  onOpenUserProfile?: (userId: number) => void;
} = {}) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={pendingBookingId != null ? "OwnerBookingDetail" : "OwnerBookingList"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      screenListeners={({ route }) => ({ focus: () => onRouteChange?.(route.name) })}
    >
      <Stack.Screen name="OwnerBookingList">
        {(props) => <OwnerBookingListScreen {...props} onOpenUserProfile={onOpenUserProfile} />}
      </Stack.Screen>
      <Stack.Screen
        name="OwnerBookingDetail"
        initialParams={pendingBookingId != null ? { bookingId: pendingBookingId } : undefined}
      >
        {(props) => (
          <OwnerBookingDetailScreen {...props} onOpenDisputes={onOpenDisputes} onOpenUserProfile={onOpenUserProfile} />
        )}
      </Stack.Screen>
      <Stack.Screen name="OwnerBookingHandover">{(props) => <OwnerBookingDetailScreen {...props} onOpenDisputes={onOpenDisputes} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
      <Stack.Screen name="OwnerTracking" component={GpsTrackingScreen} />
      <Stack.Screen name="OwnerPlayback" component={GpsPlaybackScreen} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="BookingUserProfile">{({ route, navigation }) => <PublicUserProfileScreen userId={route.params.userId} onBack={() => navigation.goBack()} onOpenProfile={userId => navigation.push("BookingUserProfile", { userId })} onViewVehicle={vehicleId => navigation.navigate("VehicleDetail", { vehicleId })} onOpenBooking={bookingId => navigation.navigate("OwnerBookingDetail", { bookingId })} />}</Stack.Screen>
      <Stack.Screen name="BookingChat">{({ route, navigation }) => <ChatRoomScreen bookingId={route.params.bookingId} onBack={() => navigation.goBack()} onBookingPress={() => navigation.goBack()} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
