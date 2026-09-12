import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useThemeStore } from "./src/theme/useThemeStore";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  const mode = useThemeStore((state) => state.mode);
  return <SafeAreaProvider>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    <RootNavigator />
  </SafeAreaProvider>;
}
