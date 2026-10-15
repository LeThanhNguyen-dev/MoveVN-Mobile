import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FavoriteVehiclesScreen from "@/features/favorites/screens/FavoriteVehiclesScreen";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import CreateBookingScreen from "@/features/booking/screens/CreateBookingScreen";
import { useTheme } from "@/theme/useTheme";
import type { ExploreStackParamList } from "./types";

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export default function FavoritesNavigator({
  onClose,
  onExplore,
  onBookingCreated,
}: {
  onClose: () => void;
  onExplore: () => void;
  onBookingCreated: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="FavoriteVehicles"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="FavoriteVehicles">
        {({ navigation }) => (
          <FavoriteVehiclesScreen
            onBack={onClose}
            onExplore={onExplore}
            onOpen={(vehicleId) =>
              navigation.navigate("VehicleDetail", { vehicleId })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="VehicleDetail">
        {(props) => (
          <VehicleDetailScreen
            {...props}
            onBookPress={(params) =>
              props.navigation.navigate("CreateBooking", params)
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateBooking">
        {(props) => (
          <CreateBookingScreen {...props} onCreated={onBookingCreated} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
