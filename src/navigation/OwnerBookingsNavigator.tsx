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
  BookingChat: { bookingId: number };
};

const Stack = createNativeStackNavigator<OwnerBookingsStackParamList>();

export default function OwnerBookingsNavigator({ pendingBookingId, onRouteChange, onOpenDisputes }: { pendingBookingId?: number; onRouteChange?: (route: string) => void; onOpenDisputes?: (prefill: DisputeCreatePrefill) => void } = {}) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={pendingBookingId != null ? "OwnerBookingDetail" : "OwnerBookingList"}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      screenListeners={({ route }) => ({ focus: () => onRouteChange?.(route.name) })}
    >
      <Stack.Screen name="OwnerBookingList" component={OwnerBookingListScreen} />
      <Stack.Screen name="OwnerBookingDetail" initialParams={pendingBookingId != null ? { bookingId: pendingBookingId } : undefined}>
        {(props) => <OwnerBookingDetailScreen {...props} onOpenDisputes={onOpenDisputes} />}
      </Stack.Screen>
      <Stack.Screen name="BookingChat">{({ route, navigation }) => <ChatRoomScreen bookingId={route.params.bookingId} onBack={() => navigation.goBack()} onBookingPress={() => navigation.goBack()} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
