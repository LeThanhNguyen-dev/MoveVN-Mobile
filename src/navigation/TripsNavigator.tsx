import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripDetailScreen from "@/features/booking/screens/TripDetailScreen";
import TripListScreen from "@/features/booking/screens/TripListScreen";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import type { TripsStackParamList } from "./types";
import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<TripsStackParamList>();

export default function TripsNavigator({
  pendingBookingId,
  onConsumedPending,
  onRouteChange,
  onOpenUserProfile,
}: {
  pendingBookingId: number | null;
  onConsumedPending: () => void;
  onRouteChange?: (route: string) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const consumedRef = useRef(false);
  const hasPending = pendingBookingId != null;

  // Mở thẳng chi tiết khi vừa tạo booking xong (dùng initialParams thay vì
  // navigate tay lúc mount để tránh race "not handled by any navigator").
  useEffect(() => {
    if (hasPending && !consumedRef.current) {
      consumedRef.current = true;
      onConsumedPending();
    }
  }, [hasPending, onConsumedPending]);

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
        {(props) => <TripDetailScreen {...props} onOpenUserProfile={onOpenUserProfile} />}
      </Stack.Screen>
      <Stack.Screen name="BookingChat">{({ route, navigation }) => <ChatRoomScreen bookingId={route.params.bookingId} onBack={() => navigation.goBack()} onBookingPress={() => navigation.goBack()} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
