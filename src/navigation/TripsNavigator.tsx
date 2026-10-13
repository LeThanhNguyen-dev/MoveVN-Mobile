import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripDetailScreen from "@/features/booking/screens/TripDetailScreen";
import TripListScreen from "@/features/booking/screens/TripListScreen";
import type { TripsStackParamList } from "./types";
import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<TripsStackParamList>();

export default function TripsNavigator({
  pendingBookingId,
  onConsumedPending,
  onRouteChange,
}: {
  pendingBookingId: number | null;
  onConsumedPending: () => void;
  onRouteChange?: (routeName: string) => void;
}) {
  const { theme } = useTheme();
  const consumedRef = useRef(false);
  const hasPending = pendingBookingId != null;

  // Mở thẳng chi tiết khi vừa tạo booking xong (dùng initialParams thay vì
  // navigate tay lúc mount để tránh race "not handled by any navigator").
  useEffect(() => {
    onRouteChange?.(hasPending ? "TripDetail" : "TripList");
    if (hasPending && !consumedRef.current) {
      consumedRef.current = true;
      onConsumedPending();
    }
  }, [hasPending, onConsumedPending, onRouteChange]);

  return (
    <Stack.Navigator
      initialRouteName={hasPending ? "TripDetail" : "TripList"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      screenListeners={{
        state: (e) => {
          const state = e.data.state;
          if (!state) return;
          const route = state.routes[state.index];
          if (route?.name) onRouteChange?.(route.name);
        },
      }}
    >

      <Stack.Screen name="TripList" component={TripListScreen} />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        initialParams={hasPending ? { bookingId: pendingBookingId! } : undefined}
      />
    </Stack.Navigator>
  );
}
