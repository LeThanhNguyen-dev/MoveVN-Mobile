import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "./types";
import ForgotPasswordScreen from "@/features/auth/screens/ForgotPasswordScreen";
import LoginScreen from "@/features/auth/screens/LoginScreen";
import OwnerRegisterScreen from "@/features/auth/screens/OwnerRegisterScreen";
import RegisterScreen from "@/features/auth/screens/RegisterScreen";
import ResetPasswordScreen from "@/features/auth/screens/ResetPasswordScreen";
import VerifyEmailScreen from "@/features/auth/screens/VerifyEmailScreen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
    <Stack.Screen component={LoginScreen} name="Login" />
    <Stack.Screen component={RegisterScreen} name="Register" />
    <Stack.Screen component={OwnerRegisterScreen} name="OwnerRegister" />
    <Stack.Screen component={ForgotPasswordScreen} name="ForgotPassword" />
    <Stack.Screen component={ResetPasswordScreen} name="ResetPassword" />
    <Stack.Screen component={VerifyEmailScreen} name="VerifyEmail" />
  </Stack.Navigator>;
}
