import { useMemo, useRef } from "react";
import { Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bot, X } from "lucide-react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import AssistantScreen, { type QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import { useAssistantUi } from "@/features/assistant/useAssistantUi";

const FAB_SIZE = 56;
const DEFAULT_RIGHT = 18;
const DEFAULT_BOTTOM = 96;
const MARGIN = 8;
const DRAG_THRESHOLD = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Giới hạn kéo để nút luôn nằm gọn trong màn hình (tính theo vị trí mặc định).
function dragBounds() {
  const { width: W, height: H } = Dimensions.get("window");
  const x0 = W - DEFAULT_RIGHT - FAB_SIZE;
  const y0 = H - DEFAULT_BOTTOM - FAB_SIZE;
  return {
    minX: MARGIN - x0,
    maxX: DEFAULT_RIGHT - MARGIN,
    minY: MARGIN - y0,
    maxY: DEFAULT_BOTTOM - MARGIN,
  };
}

// Nút tròn nổi giống web (AssistantWidget) nhưng mở full-screen modal RN.
// Mọi điều hướng xe/booking do parent truyền vào.
// - Kéo-thả tự do tới bất kỳ chỗ nào trên màn hình (vị trí giữ trong phiên).
// - Nút X để ẩn hẳn nút nổi (đỡ che giao diện); mở lại từ "Chatbot MoveVN".
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
  const setFabPos = useAssistantUi((state) => state.setFabPos);

  const committed = useRef(useAssistantUi.getState().fabPos ?? { x: 0, y: 0 });
  const pan = useRef(new Animated.ValueXY(committed.current)).current;
  const dragStart = useRef({ x: 0, y: 0 });

  const responder = useRef(
    PanResponder.create({
      // Không cướp touch lúc chạm — để bấm mở chat / bấm X vẫn nhạy.
      // Chỉ thành responder khi rê đủ xa (kéo-thả).
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        dragStart.current = { ...committed.current };
      },
      onPanResponderMove: (_, gesture) => {
        const bounds = dragBounds();
        const next = {
          x: clamp(dragStart.current.x + gesture.dx, bounds.minX, bounds.maxX),
          y: clamp(dragStart.current.y + gesture.dy, bounds.minY, bounds.maxY),
        };
        committed.current = next;
        pan.setValue(next);
      },
      onPanResponderRelease: () => {
        setFabPos({ ...committed.current });
      },
      onPanResponderTerminate: () => {
        setFabPos({ ...committed.current });
      },
    }),
  ).current;

  return (
    <>
      {!fabHidden ? (
        <Animated.View
          style={[styles.fabWrap, { transform: pan.getTranslateTransform() }]}
          {...responder.panHandlers}
        >
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
        </Animated.View>
      ) : null}
      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        {/* SafeAreaView để header không chui lên vùng giờ/pin, ô chat không cấn thanh home. */}
        <SafeAreaView edges={["top", "bottom"]} style={styles.modal}>
          <AssistantScreen
            onBack={() => setChatOpen(false)}
            onViewVehicle={onViewVehicle ? id => { setChatOpen(false); onViewVehicle(id); } : undefined}
            onViewBooking={onViewBooking ? id => { setChatOpen(false); onViewBooking(id); } : undefined}
            onQuickBook={onQuickBook ? (params) => {
              setChatOpen(false);
              onQuickBook(params);
            } : undefined}
            onBookingConfirmed={onBookingConfirmed ? (bookingId) => {
              setChatOpen(false);
              onBookingConfirmed(bookingId);
            } : undefined}
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
      right: DEFAULT_RIGHT,
      bottom: DEFAULT_BOTTOM,
      width: FAB_SIZE,
      height: FAB_SIZE,
      zIndex: 60,
    },
    fab: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: theme.brandSolid,
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
