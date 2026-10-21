import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatListScreen from "@/features/chat/screens/ChatListScreen";
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import TripsNavigator from "./TripsNavigator";
import OwnerBookingsNavigator from "./OwnerBookingsNavigator";
import { useTheme } from "@/theme/useTheme";

type ChatStack = {
  ChatList: undefined;
  ChatRoom: { roomId: string };
  ChatBooking: { bookingId: number };
};
const Stack = createNativeStackNavigator<ChatStack>();

export default function ChatNavigator({
  owner = false,
  onRouteChange,
}: {
  owner?: boolean;
  onRouteChange: (route: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
      screenListeners={({ route }) => ({
        focus: () => onRouteChange(route.name),
      })}
    >
      <Stack.Screen name="ChatList">
        {({ navigation }) => (
          <ChatListScreen
            onOpen={(roomId) => navigation.navigate("ChatRoom", { roomId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ChatRoom">
        {({ route, navigation }) => (
          <ChatRoomScreen
            roomId={route.params.roomId}
            onBack={() => navigation.goBack()}
            onBookingPress={(bookingId) =>
              navigation.navigate("ChatBooking", { bookingId })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ChatBooking">
        {({ route }) =>
          owner ? (
            <OwnerBookingsNavigator pendingBookingId={route.params.bookingId} />
          ) : (
            <TripsNavigator
              pendingBookingId={route.params.bookingId}
              onConsumedPending={() => undefined}
            />
          )
        }
      </Stack.Screen>
    </Stack.Navigator>
  );
}
