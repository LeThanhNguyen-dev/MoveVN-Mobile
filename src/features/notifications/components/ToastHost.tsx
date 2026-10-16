import { CircleCheck, CircleX, Info, X } from "lucide-react-native";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useToastStore, type ToastType } from "@/features/notifications/toastStore";

/** Mirror web ToastViewport: chồng toast góc trên-phải, card sáng viền màu + nút X. */
function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + 12 }]}>
      {toasts.map((toast) => {
        const Icon = toast.type === "success" ? CircleCheck : toast.type === "error" ? CircleX : Info;
        const accent = accentFor(theme, toast.type);
        return (
          <View key={toast.id} style={[styles.card, { borderColor: accent.border }]}>
            <Icon color={accent.icon} size={20} />
            <View style={styles.textWrap}>
              <Text style={styles.title}>{toast.title}</Text>
              {!!toast.message && <Text style={styles.message}>{toast.message}</Text>}
            </View>
            <Pressable
              onPress={() => dismissToast(toast.id)}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo"
              hitSlop={8}
            >
              <X color={theme.muted} size={15} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function accentFor(theme: Theme, type: ToastType): { border: string; icon: string } {
  if (type === "success")
    return { border: theme.success, icon: theme.success };
  if (type === "error")
    return { border: theme.danger, icon: theme.danger };
  return { border: theme.info, icon: theme.info };
}

export default memo(ToastHost);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    viewport: {
      position: "absolute",
      left: 16,
      right: 16,
      gap: 12,
    },
    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    textWrap: { flex: 1, minWidth: 0, gap: 2 },
    title: { color: theme.text, fontSize: 14, fontWeight: "700" },
    message: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
  });
