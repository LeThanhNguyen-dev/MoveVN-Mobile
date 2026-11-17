import { useMemo } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAppDialogStore, type AppDialogButton, type AppDialogTone } from "./dialogStore";

const TONE_ICON = {
  brand: Info,
  success: CircleCheck,
  danger: TriangleAlert,
} as const;

/** Popup dùng chung, cùng cấu trúc với thông báo GPS: icon tile + tiêu đề + nội dung + hàng nút. */
export default function AppDialogHost() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dialog = useAppDialogStore((state) => state.dialogs[0]);
  const dismiss = useAppDialogStore((state) => state.dismiss);

  if (!dialog) return null;

  const dialogId = dialog.id;
  const tone: AppDialogTone = dialog.tone ?? "brand";
  const Icon = TONE_ICON[tone];
  const tint = tone === "danger" ? theme.danger : tone === "success" ? theme.success : theme.brand;
  const tintSoft = tone === "danger" ? theme.dangerSoft : tone === "success" ? theme.successSoft : theme.brandSoft;
  const buttons: AppDialogButton[] = dialog.buttons?.length
    ? dialog.buttons
    : [{ text: t("common:closeAction") }];
  const cancelable = dialog.cancelable !== false;

  function close(button?: AppDialogButton) {
    dismiss(dialogId);
    button?.onPress?.();
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => { if (cancelable) close(); }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => { if (cancelable) close(); }}
        accessibilityRole="button"
        accessibilityLabel={t("common:dialogClose")}
      >
        <Pressable
          style={styles.card}
          onPress={() => undefined}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View style={styles.head}>
            <View style={[styles.iconTile, { backgroundColor: tintSoft }]}>
              <Icon color={tint} size={18} strokeWidth={2.1} />
            </View>
            <AppText display numberOfLines={3} style={styles.title}>
              {dialog.title}
            </AppText>
          </View>
          {dialog.message ? <AppText style={styles.message}>{dialog.message}</AppText> : null}
          <View style={buttons.length > 2 ? styles.actionsColumn : styles.actionsRow}>
            {buttons.map((button, index) => (
              <DialogButton
                key={`${button.text}-${index}`}
                button={button}
                single={buttons.length === 1}
                onPress={() => close(button)}
                styles={styles}
                theme={theme}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogButton({
  button,
  single,
  onPress,
  styles,
  theme,
}: {
  button: AppDialogButton;
  single: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  const destructive = button.style === "destructive";
  const cancel = button.style === "cancel";
  const foreground = destructive ? theme.danger : cancel ? theme.text : theme.onBrand;
  const background = destructive ? theme.dangerSoft : cancel ? theme.surface : theme.brand;
  const borderColor = destructive ? theme.dangerBorder : cancel ? theme.border : theme.brand;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        !single && styles.buttonFlexible,
        { backgroundColor: background, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <AppText style={[styles.buttonText, { color: foreground }]}>{button.text}</AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(11,7,20,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 12,
      shadowColor: theme.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconTile: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { flex: 1, minWidth: 0, color: theme.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
    message: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 2 },
    actionsColumn: { gap: 8, marginTop: 2 },
    button: {
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonFlexible: { flex: 1 },
    buttonText: { fontSize: 13, fontWeight: "800" },
    pressed: { opacity: 0.78 },
  });
