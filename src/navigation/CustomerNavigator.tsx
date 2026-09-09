import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RoleHomeScreen from "@/features/app/screens/RoleHomeScreen";
import RoleFeatureScreen from "@/features/app/screens/RoleFeatureScreen";
import type { AuthUser } from "@/features/auth/types";

const Stack = createNativeStackNavigator();

export default function CustomerNavigator({ user }: { user: AuthUser }) {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerHome">{({ navigation }) => <RoleHomeScreen onPrimary={() => navigation.navigate("VehicleSearch")} onSecondary={() => navigation.navigate("MyTrips")} role="Customer" user={user} />}</Stack.Screen>
    <Stack.Screen name="VehicleSearch">{({ navigation }) => <RoleFeatureScreen description="Danh sách và bộ lọc xe sẽ được đặt ở màn này." onBack={() => navigation.goBack()} title="Tìm xe" />}</Stack.Screen>
    <Stack.Screen name="MyTrips">{({ navigation }) => <RoleFeatureScreen description="Các đơn thuê và lịch sử chuyến đi sẽ hiển thị ở đây." onBack={() => navigation.goBack()} title="Chuyến đi của tôi" />}</Stack.Screen>
  </Stack.Navigator>;
}
