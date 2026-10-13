import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bot, X } from "lucide-react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import AssistantScreen from "@/features/assistant/screens/AssistantScreen";

// Nút tròn nổi giống web (AssistantWidget) nhưng mở full-screen modal RN.
// Không chứa booking — mọi điều hướng xe/booking do parent truyền vào.
export default function AssistantFab({
  onViewVehicle,
  onViewBooking,
}: {
  onViewVehicle?: (vehicleId: number) => void;
  onViewBooking?: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={open ? "Đóng trợ lý MoveVN" : "Mở trợ lý MoveVN"}
        onPress={() => setOpen((value) => !value)}
        style={styles.fab}
      >
        {open ? <X color="#fff" size={24} /> : <Bot color="#fff" size={26} />}
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* SafeAreaView để header không chui lên vùng giờ/pin, ô chat không cấn thanh home. */}
        <SafeAreaView edges={["top", "bottom"]} style={styles.modal}>
          <AssistantScreen onBack={() => setOpen(false)} onViewVehicle={onViewVehicle} onViewBooking={onViewBooking} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: 18,
      bottom: 96,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: theme.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      zIndex: 60,
    },
    modal: { flex: 1, backgroundColor: theme.background },
  });
