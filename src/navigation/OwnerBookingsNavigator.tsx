import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OwnerBookingDetailScreen from "@/features/booking/screens/OwnerBookingDetailScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import { useTheme } from "@/theme/useTheme";

export type OwnerBookingsStackParamList = {
  OwnerBookingList: undefined;
  OwnerBookingDetail: {
    bookingId: number;
  };
  BookingChat: { bookingId: number };
};

const Stack = createNativeStackNavigator<OwnerBookingsStackParamList>();

export default function OwnerBookingsNavigator({
  pendingBookingId,
  onRouteChange,
  onOpenUserProfile,
}: {
  pendingBookingId?: number;
  onRouteChange?: (route: string) => void;
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
        {(props) => <OwnerBookingDetailScreen {...props} onOpenUserProfile={onOpenUserProfile} />}
      </Stack.Screen>
      <Stack.Screen name="BookingChat">{({ route, navigation }) => <ChatRoomScreen bookingId={route.params.bookingId} onBack={() => navigation.goBack()} onBookingPress={() => navigation.goBack()} onOpenUserProfile={onOpenUserProfile} />}</Stack.Screen>
    </Stack.Navigator>
  );
}
