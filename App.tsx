import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthFlow from "./src/features/auth/components/AuthFlow";

export default function App() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <AuthFlow />
  </SafeAreaProvider>;
}
