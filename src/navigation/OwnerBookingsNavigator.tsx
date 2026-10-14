import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OwnerBookingDetailScreen from "@/features/booking/screens/OwnerBookingDetailScreen";
import OwnerBookingListScreen from "@/features/booking/screens/OwnerBookingListScreen";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import { useTheme } from "@/theme/useTheme";

export type OwnerBookingsStackParamList = {
  OwnerBookingList: undefined;
  OwnerBookingDetail: {
    bookingId: number;
  };
};

const Stack = createNativeStackNavigator<OwnerBookingsStackParamList>();

export default function OwnerBookingsNavigator({
  onOpenDisputes,
}: {
  onOpenDisputes?: (prefill: DisputeCreatePrefill) => void;
}) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
    >
      <Stack.Screen name="OwnerBookingList" component={OwnerBookingListScreen} />
      <Stack.Screen name="OwnerBookingDetail">
        {(props) => <OwnerBookingDetailScreen {...props} onOpenDisputes={onOpenDisputes} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
