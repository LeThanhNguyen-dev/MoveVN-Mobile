import Constants from "expo-constants";
import { Platform } from "react-native";
import { AppApiError, googleLogin } from "./authService";

export const googleAvailable = Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient"
  && Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
  && (Platform.OS !== "ios" || Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID));

export async function signInWithGoogle() {
  if (!googleAvailable) throw new AppApiError({ code: "GOOGLE_UNAVAILABLE", message: "Đăng nhập Google chưa sẵn sàng trên bản ứng dụng này." });
  // Load only in a native build; Expo Go does not contain the Google native module.
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ["email", "profile"],
  });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) return null;
    try {
      const { accessToken } = await GoogleSignin.getTokens();
      return await googleLogin(accessToken);
    } finally {
      await GoogleSignin.signOut().catch(() => undefined);
    }
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  }
}
