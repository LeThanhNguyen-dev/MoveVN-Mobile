import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bot, X } from "lucide-react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import AssistantScreen, { type QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import { useAssistantUi } from "@/features/assistant/useAssistantUi";

// Nút tròn nổi giống web (AssistantWidget) nhưng mở full-screen modal RN.
// Mọi điều hướng xe/booking do parent truyền vào.
// Người dùng có thể bấm X để ẩn hẳn nút nổi (đỡ che giao diện);
// mở lại từ thẻ "Chatbot MoveVN" trong Trung tâm hỗ trợ.
export default function AssistantFab({
  onViewVehicle,
  onViewBooking,
  onQuickBook,
  onBookingConfirmed,
}: {
  onViewVehicle?: (vehicleId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  onQuickBook?: (params: QuickBookParams) => void;
  onBookingConfirmed?: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chatOpen = useAssistantUi((state) => state.chatOpen);
  const setChatOpen = useAssistantUi((state) => state.setChatOpen);
  const fabHidden = useAssistantUi((state) => state.fabHidden);
  const setFabHidden = useAssistantUi((state) => state.setFabHidden);

  return (
    <>
      {!fabHidden ? (
        <View style={styles.fabWrap}>
          <Pressable
            accessibilityLabel="Mở trợ lý MoveVN"
            accessibilityRole="button"
            onPress={() => setChatOpen(true)}
            style={styles.fab}
          >
            <Bot color="#fff" size={26} />
          </Pressable>
          <Pressable
            accessibilityLabel="Ẩn trợ lý MoveVN"
            accessibilityRole="button"
            onPress={() => setFabHidden(true)}
            style={styles.dismiss}
          >
            <X color="#fff" size={12} strokeWidth={3} />
          </Pressable>
        </View>
      ) : null}
      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        {/* SafeAreaView để header không chui lên vùng giờ/pin, ô chat không cấn thanh home. */}
        <SafeAreaView edges={["top", "bottom"]} style={styles.modal}>
          <AssistantScreen
            onBack={() => setChatOpen(false)}
            onViewVehicle={onViewVehicle}
            onViewBooking={onViewBooking}
            onQuickBook={(params) => {
              setChatOpen(false);
              onQuickBook?.(params);
            }}
            onBookingConfirmed={(bookingId) => {
              setChatOpen(false);
              onBookingConfirmed?.(bookingId);
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fabWrap: {
      position: "absolute",
      right: 18,
      bottom: 96,
      width: 56,
      height: 56,
      zIndex: 60,
    },
    fab: {
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
    },
    dismiss: {
      position: "absolute",
      top: -8,
      right: -8,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    modal: { flex: 1, backgroundColor: theme.background },
  });
