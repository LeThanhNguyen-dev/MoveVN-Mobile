import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { X } from "lucide-react-native";
import { WebView } from "react-native-webview";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

/** Thanh toán PayOS ngay trong app, không nhảy trình duyệt ngoài. */
export const PAYOS_APP_RETURN_PREFIX = "movevn://payment-result";

export function payOsReturnUrl(): string {
  return PAYOS_APP_RETURN_PREFIX;
}

export default function PaymentWebViewModal({
  checkoutUrl,
  onClose,
}: {
  checkoutUrl: string | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function openInBrowser() {
    if (!checkoutUrl) return;
    try {
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Lỗi", "Không mở được link thanh toán.");
    }
  }

  return (
    <Modal
      visible={checkoutUrl !== null}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <AppText display style={styles.headerTitle}>Thanh toán PayOS</AppText>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Đóng thanh toán">
            <X color={theme.text} size={20} />
          </Pressable>
        </View>
        {checkoutUrl ? (
          <WebView
            source={{ uri: checkoutUrl }}
            startInLoadingState
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onShouldStartLoadWithRequest={(request) => {
              // PayOS chuyển về returnUrl khi xong/hủy: đóng sheet, AppState poll lo phần xác nhận.
              if (request.url.startsWith(PAYOS_APP_RETURN_PREFIX)) {
                onClose();
                return false;
              }
              return true;
            }}
          />
        ) : null}
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        )}
        {failed && (
          <View style={styles.failed}>
            <AppText style={styles.failedText}>Không tải được trang thanh toán.</AppText>
            <Pressable onPress={openInBrowser} style={styles.browserButton}>
              <AppText style={styles.browserText}>Mở bằng trình duyệt</AppText>
            </Pressable>
            <Pressable onPress={onClose} style={styles.ghostButton}>
              <AppText style={styles.ghostText}>Đóng</AppText>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, paddingTop: 8 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    loading: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
    },
    failed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
    failedText: { color: theme.muted, fontSize: 14 },
    browserButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    browserText: { color: theme.onBrand, fontWeight: "800" },
    ghostButton: { padding: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
  });
