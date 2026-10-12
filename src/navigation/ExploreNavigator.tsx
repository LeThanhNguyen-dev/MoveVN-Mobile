import { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomerExploreScreen from "@/features/app/screens/CustomerExploreScreen";
import CreateBookingScreen from "@/features/booking/screens/CreateBookingScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import VehicleListScreen from "@/features/vehicles/screens/VehicleListScreen";
import type { AuthUser } from "@/features/auth/types";
import type { ExploreStackParamList } from "./types";

import { useTheme } from "@/theme/useTheme";

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function ExploreNavigator({
  user,
  onAvatarPress,
  onRouteChange,
  onBookingCreated,
}: {
  user: AuthUser;
  onAvatarPress: () => void;
  onRouteChange?: (routeName: string) => void;
  onBookingCreated?: (bookingId: number) => void;
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
    </Stack.Navigator>
  );
}
