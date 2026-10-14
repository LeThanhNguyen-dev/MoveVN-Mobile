import { useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import CustomerExploreScreen from "@/features/app/screens/CustomerExploreScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import VehicleListScreen from "@/features/vehicles/screens/VehicleListScreen";
import CreateBookingScreen from "@/features/booking/screens/CreateBookingScreen";
import BookingDetailScreen from "@/features/booking/screens/BookingDetailScreen";
import type { QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import type { AuthUser } from "@/features/auth/types";
import type { ExploreStackParamList } from "./types";

import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<ExploreStackParamList>();

function QuickBookHandler({
  quickBook,
  onConsumed,
}: {
  quickBook: QuickBookParams | null;
  onConsumed?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<ExploreStackParamList>>();
  const consumedRef = useRef<QuickBookParams | null>(null);
  useEffect(() => {
    if (!quickBook || consumedRef.current === quickBook) return;
    consumedRef.current = quickBook;
    if (quickBook.vehicleId) {
      navigation.navigate("CreateBooking", {
        vehicleId: quickBook.vehicleId,
        startDate: quickBook.startAt ?? undefined,
        endDate: quickBook.endAt ?? undefined,
        promoCode: quickBook.promoCode ?? undefined,
        pickupAddress: quickBook.pickupAddress ?? undefined,
        returnAddress: quickBook.returnAddress ?? undefined,
        customerNote: quickBook.customerNote ?? undefined,
      });
    }
    onConsumed?.();
  }, [quickBook, navigation, onConsumed]);
  return null;
}

export default function ExploreNavigator({
  user,
  onAvatarPress,
  onRouteChange,
  onBookingCreated,
  quickBook,
  onConsumedQuickBook,
}: {
  user: AuthUser;
  onAvatarPress: () => void;
  onRouteChange?: (routeName: string) => void;
  onBookingCreated?: (bookingId: number) => void;
  quickBook?: QuickBookParams | null;
  onConsumedQuickBook?: () => void;
}) {
  const { theme } = useTheme();
  useEffect(() => {
    onRouteChange?.("ExploreMain");
  }, [onRouteChange]);

  return (
    <Stack.Navigator
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
      <Stack.Screen name="ExploreMain">
        {({ navigation }) => (
          <CustomerExploreScreen
            user={user}
            onAvatarPress={onAvatarPress}
            onSearch={(params) => navigation.navigate("VehicleList", params)}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="VehicleList" component={VehicleListScreen} />
      <Stack.Screen name="VehicleDetail">
        {(props) => <VehicleDetailScreen {...props} onBookPress={(p) => props.navigation.navigate("CreateBooking", p)} />}
      </Stack.Screen>
      <Stack.Screen name="CreateBooking">
        {(props) => <CreateBookingScreen {...props} onCreated={(bookingId) => onBookingCreated?.(bookingId)} />}
      </Stack.Screen>
      <QuickBookHandler quickBook={quickBook ?? null} onConsumed={onConsumedQuickBook} />
    </Stack.Navigator>
  );
}
