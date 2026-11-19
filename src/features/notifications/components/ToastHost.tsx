import { CircleCheck, CircleX, Info, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useToastStore, type ToastItem } from "@/features/notifications/toastStore";

function ToastCard({ toast, closeLabel, onDismiss, styles, theme }: {
  toast: ToastItem;
  closeLabel: string;
  onDismiss: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const offset = useRef(new Animated.Value(-60)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const durationMs = toast.durationMs ?? 4200;

  useEffect(() => {
    const animation = Animated.timing(offset, { toValue: 0, duration: 240, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [offset]);

  useEffect(() => {
    if (!trackWidth) return;
    progress.setValue(1);
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [durationMs, progress, trackWidth]);

  const Icon = toast.type === "success" ? CircleCheck : toast.type === "error" ? CircleX : Info;
  const iconColor = toast.type === "success" ? theme.success : toast.type === "error" ? theme.danger : theme.info;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.card, { transform: [{ translateY: offset }] }]}
    >
      <View style={styles.row}>
        <Icon color={iconColor} size={20} />
        <Pressable
          style={styles.textWrap}
          disabled={!toast.onPress}
          accessibilityRole={toast.onPress ? "button" : undefined}
          onPress={() => { toast.onPress?.(); onDismiss(); }}
        >
          <AppText display style={styles.title}>{toast.title}</AppText>
          {!!toast.message && <AppText style={styles.message}>{toast.message}</AppText>}
          {!!toast.actionLabel && !!toast.onPress && (
            <AppText style={styles.action}>{toast.actionLabel} →</AppText>
          )}
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
        >
          <X color={theme.muted} size={15} />
        </Pressable>
      </View>
      {trackWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.progressBar, {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, trackWidth] }),
          }]}
        />
      )}
    </Animated.View>
  );
}

function ToastHost() {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + 12 }]}>
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          closeLabel={t("common:notifications.closeAria")}
          onDismiss={() => dismissToast(toast.id)}
          styles={styles}
          theme={theme}
        />
      ))}
    </View>
  );
}

export default memo(ToastHost);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    viewport: {
      position: "absolute",
      zIndex: 10000,
      elevation: 100,
      left: 16,
      right: 16,
      gap: 12,
    },
    card: {
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.brand,
      borderRadius: 12,
      paddingTop: 13,
      paddingHorizontal: 14,
      paddingBottom: 14,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 22,
      elevation: 10,
    },
    row: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
    textWrap: { flex: 1, minWidth: 0, gap: 2 },
    title: { color: theme.text, fontSize: 14, fontWeight: "700" },
    message: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    action: { color: theme.brand, fontSize: 13, fontWeight: "700", marginTop: 3 },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    progressBar: {
      position: "absolute",
      left: 0,
      bottom: 0,
      height: 2,
      backgroundColor: theme.brand,
    },
  });
