import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/** Uses native secure storage on mobile and browser storage for the Expo web preview. */
export const appStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS !== "web") return SecureStore.getItemAsync(key);
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};
