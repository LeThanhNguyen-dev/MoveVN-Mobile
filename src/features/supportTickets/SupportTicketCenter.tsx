import { useCallback, useEffect, useRef } from "react";
import { Modal } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { closeSupportTickets, useTicketNavigation } from "./ticketNavigation";
import SupportTicketsScreen from "./SupportTicketsScreen";

export default function SupportTicketCenter({ userId }: { userId: number }) {
  const navigation = useTicketNavigation(); const role = useAuthStore(s => s.activeRole); const { theme } = useTheme();
  const back = useRef(closeSupportTickets);
  const registerBack = useCallback((action: () => void) => { back.current = action; }, []);
  useEffect(() => () => closeSupportTickets(), []);
  const visible = navigation.entry !== null && navigation.userId === userId && navigation.generation === getSessionGeneration() && (role === "Customer" || role === "Owner");
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()}>
    {visible && navigation.entry && <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><SupportTicketsScreen key={`${userId}:${navigation.serial}`} entry={navigation.entry} onClose={closeSupportTickets} registerBack={registerBack} /></SafeAreaView></SafeAreaProvider>}
  </Modal>;
}
