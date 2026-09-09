import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RoleHomeScreen from "@/features/app/screens/RoleHomeScreen";
import RoleFeatureScreen from "@/features/app/screens/RoleFeatureScreen";
import type { AuthUser } from "@/features/auth/types";

const Stack = createNativeStackNavigator();

export default function OwnerNavigator({ user }: { user: AuthUser }) {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerHome">{({ navigation }) => <RoleHomeScreen onPrimary={() => navigation.navigate("ManageVehicles")} onSecondary={() => navigation.navigate("OwnerProfile")} role="Owner" user={user} />}</Stack.Screen>
    <Stack.Screen name="ManageVehicles">{({ navigation }) => <RoleFeatureScreen description="Danh sách xe, tạo xe và trạng thái cho thuê sẽ được đặt ở đây." onBack={() => navigation.goBack()} title="Quản lý xe" />}</Stack.Screen>
    <Stack.Screen name="OwnerProfile">{({ navigation }) => <RoleFeatureScreen description="Hồ sơ và quy trình xác minh chủ xe sẽ hiển thị ở đây." onBack={() => navigation.goBack()} title="Hồ sơ chủ xe" />}</Stack.Screen>
  </Stack.Navigator>;
}
