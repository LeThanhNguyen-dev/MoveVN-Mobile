import { useEffect } from "react";
import { Modal } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { canOpenDisputes, closeDisputes, useDisputeNavigation } from "./disputeNavigation";
import DisputesScreen from "./screens/DisputesScreen";

// Mở cụm tranh chấp từ thông báo dưới dạng modal toàn màn hình, giống ViolationCenter.
// Nhờ vậy deep link không phụ thuộc tab đang active của navigator.
export default function DisputeCenter({ userId }: { userId: number }) {
  const state = useDisputeNavigation();
  const activeRole = useAuthStore((s) => s.activeRole);
  const { theme } = useTheme();
  useEffect(() => () => closeDisputes(), []);
  const visible = Boolean(
    state.userId === userId && state.generation === getSessionGeneration() && canOpenDisputes(),
  );
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeDisputes}>
      {visible ? (
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <DisputesScreen
              key={`${userId}:${state.serial}`}
              role={activeRole === "Owner" ? "Owner" : "Customer"}
              initialDetailId={state.disputeId}
              onBack={closeDisputes}
            />
          </SafeAreaView>
        </SafeAreaProvider>
      ) : null}
    </Modal>
  );
}
