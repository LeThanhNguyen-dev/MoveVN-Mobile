import { useCallback, useEffect, useRef } from "react";
import { Modal } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { canReport, closeViolations, useViolationNavigation } from "./violationNavigation";
import ViolationsScreen from "./ViolationsScreen";

export default function ViolationCenter({ userId }: { userId: number }) {
  const state = useViolationNavigation(); useAuthStore(s => s.activeRole); const { theme } = useTheme();
  const back = useRef(closeViolations); const registerBack = useCallback((action: () => void) => { back.current = action; }, []);
  useEffect(() => () => closeViolations(), []);
  const visible = Boolean(state.entry && state.userId === userId && state.generation === getSessionGeneration() && canReport());
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()}>{visible && state.entry && <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><ViolationsScreen key={`${userId}:${state.serial}`} entry={state.entry} onClose={closeViolations} registerBack={registerBack} /></SafeAreaView></SafeAreaProvider>}</Modal>;
}
