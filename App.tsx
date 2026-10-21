import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useThemeStore } from "./src/theme/useThemeStore";
import { useAppFonts } from "./src/theme/useAppFonts";
import RootNavigator from "./src/navigation/RootNavigator";

// Lỗi kết nối realtime (mất mạng, token hết hạn, server timeout) đã được xử lý
// bên trong (tự reconnect + fallback API); ẩn redbox để không che màn hình dev.
LogBox.ignoreLogs([
  "Failed to complete negotiation with the server",
  "Failed to start the connection",
  "Server timeout elapsed without receiving a message",
  "Connection disconnected with error",
]);

export default function App() {
  const mode = useThemeStore((state) => state.mode);
  // Font Be Vietnam Pro + Quicksand đồng bộ web — giữ màn hình chờ tới khi load xong
  // để chữ không bị nháy từ font hệ thống sang font brand.
  const [fontsLoaded] = useAppFonts();
  if (!fontsLoaded) return null;
  return <SafeAreaProvider>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    <RootNavigator />
  </SafeAreaProvider>;
}
