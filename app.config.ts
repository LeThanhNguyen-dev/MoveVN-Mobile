import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const remotePushEnabled = process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH === "true";
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (remotePushEnabled && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(projectId ?? "")) {
    throw new Error("Remote push requires a valid EAS project ID. Run eas init, set EXPO_PUBLIC_EAS_PROJECT_ID, then npm run push:check.");
  }

  return {
    ...config,
    name: config.name ?? "MoveVN Mobile",
    slug: config.slug ?? "movevn-mobile",
    extra: { ...config.extra, remotePushEnabled, eas: { ...config.extra?.eas, ...(projectId ? { projectId } : {}) } },
    ios: { ...config.ios, ...(process.env.MOVEVN_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.MOVEVN_IOS_BUNDLE_IDENTIFIER } : {}) },
    android: { ...config.android, ...(process.env.MOVEVN_ANDROID_PACKAGE ? { package: process.env.MOVEVN_ANDROID_PACKAGE } : {}), ...(process.env.MOVEVN_GOOGLE_SERVICES_FILE ? { googleServicesFile: process.env.MOVEVN_GOOGLE_SERVICES_FILE } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      "expo-font",
      "expo-secure-store",
      "expo-sharing",
      "expo-image",
      "expo-status-bar",
      ["expo-notifications", { defaultChannel: "bookings" }],
      ["expo-camera", {
        cameraPermission: "MoveVN cần camera để chụp ảnh check-in/check-out xe.",
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      }],
      ["expo-location", {
        // Chỉ xin location khi app mở (MVP tracking foreground, không xin background).
        locationWhenInUsePermission: "MoveVN cần vị trí của bạn để chủ xe theo dõi chuyến đi khi thuê xe.",
      }],
      ...(iosClientId ? [["@react-native-google-signin/google-signin", {
        iosUrlScheme: iosClientId.split(".").reverse().join("."),
      }] as [string, { iosUrlScheme: string }]] : []),
    ],
  };
};
