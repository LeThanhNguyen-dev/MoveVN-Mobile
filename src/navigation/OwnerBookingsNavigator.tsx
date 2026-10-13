import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OwnerBookingDetailScreen from "@/features/booking/screens/OwnerBookingDetailScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import { useTheme } from "@/theme/useTheme";

export type OwnerBookingsStackParamList = {
  OwnerBookingList: undefined;
  OwnerBookingDetail: {
    bookingId: number;
  };
};

const Stack = createNativeStackNavigator<OwnerBookingsStackParamList>();

export default function OwnerBookingsNavigator({
  pendingBookingId,
  onConsumedPending,
}: {
  pendingBookingId: number | null;
  onConsumedPending: () => void;
}) {
  const { theme } = useTheme();
  const consumedRef = useRef(false);
  const hasPending = pendingBookingId != null;

  useEffect(() => {
    if (hasPending && !consumedRef.current) {
      consumedRef.current = true;
      onConsumedPending();
    }
  }, [hasPending, onConsumedPending]);

  return (
    <Stack.Navigator
      initialRouteName={hasPending ? "OwnerBookingDetail" : "OwnerBookingList"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
    >
      <Stack.Screen name="OwnerBookingList" component={OwnerBookingListScreen} />
      <Stack.Screen
        name="OwnerBookingDetail"
        component={OwnerBookingDetailScreen}
        initialParams={hasPending ? { bookingId: pendingBookingId! } : undefined}
      />
    </Stack.Navigator>
  );
}
