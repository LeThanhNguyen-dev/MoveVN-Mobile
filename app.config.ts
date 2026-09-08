import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return {
    ...config,
    name: config.name ?? "MoveVN Mobile",
    slug: config.slug ?? "movevn-mobile",
    ios: { ...config.ios, ...(process.env.MOVEVN_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.MOVEVN_IOS_BUNDLE_IDENTIFIER } : {}) },
    android: { ...config.android, ...(process.env.MOVEVN_ANDROID_PACKAGE ? { package: process.env.MOVEVN_ANDROID_PACKAGE } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      "expo-secure-store",
      ...(iosClientId ? [["@react-native-google-signin/google-signin", {
        iosUrlScheme: iosClientId.split(".").reverse().join("."),
      }] as [string, { iosUrlScheme: string }]] : []),
    ],
  };
};
