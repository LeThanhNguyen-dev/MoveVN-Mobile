import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react-native";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import PinForgotModal from "@/features/pin/components/PinForgotModal";
import PinSetupModal from "@/features/pin/components/PinSetupModal";
import PinVerifyModal from "@/features/pin/components/PinVerifyModal";
import { usePinReveal } from "@/features/pin/hooks/usePinReveal";
import type { PinDocumentType, PinVehicleType } from "@/features/pin/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type MaskedDocumentValueProps = {
  documentType: PinDocumentType;
  maskedValue: string | null;
  vehicleType?: PinVehicleType;
  /** Chỉ cho mở mắt khi giấy tờ đã Verified (backend cũng enforce lại). */
  canReveal: boolean;
  revealDisabledHint?: string;
  align?: "left" | "right";
};

export default function MaskedDocumentValue({
  documentType,
  maskedValue,
  vehicleType,
  canReveal,
  revealDisabledHint,
  align = "right",
}: MaskedDocumentValueProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, align), [theme, align]);
  const [showForgot, setShowForgot] = useState(false);
  const [showSetupNotice, setShowSetupNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    plaintext,
    isRevealed,
    secondsLeft,
    isModalOpen,
    isPinSet,
    mode,
    lockoutSeconds,
    remainingAttempts,
    openModal,
    refreshStatus,
    closeModal,
    handleVerified,
    handleSetupDone,
    hide,
  } = usePinReveal(documentType, vehicleType);

  useEffect(() => () => {
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    setCopied(false);
  }, [plaintext]);

  // Khi giấy tờ mất trạng thái Verified (ví dụ đổi tab) thì che số ngay.
  useEffect(() => {
    if (!canReveal) hide();
  }, [canReveal, hide]);

  const eyeTitle = canReveal
    ? (isPinSet ? "Hiển thị bằng mã PIN" : "Thiết lập mã PIN để hiển thị")
    : (revealDisabledHint ?? "Giấy tờ chưa được xác thực để hiển thị.");

  async function handleEyePress() {
    if (!canReveal) {
      setHintVisible(true);
      if (hintTimer.current !== null) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHintVisible(false), 3000);
      return;
    }
    if (checkingPin) return;
    // Chưa có PIN thì báo trước bằng popup, bấm nữa mới sang màn thiết lập.
    setCheckingPin(true);
    try {
      const status = await refreshStatus();
      if (!status.isPinSet) {
        setShowSetupNotice(true);
        return;
      }
    } catch {
      // Không check được thì đi luồng thường (nó tự xử lý lỗi).
    } finally {
      setCheckingPin(false);
    }
    void openModal();
  }

  return (
    <View style={styles.wrap}>
      {isRevealed && plaintext !== null ? (
        <View style={styles.revealedWrap}>
          <Text style={styles.plaintext}>{plaintext}</Text>
          <View style={styles.revealedRow}>
            <Text numberOfLines={1} style={styles.countdown}>
              Đang hiển thị · {secondsLeft}s
            </Text>
            <Pressable
              accessibilityLabel="Sao chép số giấy tờ"
              accessibilityRole="button"
              onPress={() => {
                if (!plaintext) return;
                void Clipboard.setStringAsync(plaintext).then(() => {
                  setCopied(true);
                  if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
                  copiedTimer.current = setTimeout(() => setCopied(false), 2000);
                });
              }}
              style={styles.eyeButton}
            >
              {copied ? (
                <Check color={theme.success} size={17} strokeWidth={2.5} />
              ) : (
                <Copy color={theme.brand} size={17} strokeWidth={2.3} />
              )}
            </Pressable>
            <Pressable accessibilityLabel="Ẩn" accessibilityRole="button" onPress={hide} style={styles.eyeButton}>
              <EyeOff color={theme.brand} size={17} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.masked}>{maskedValue ?? "••••••"}</Text>
          <Pressable
            accessibilityLabel="Hiển thị số giấy tờ"
            accessibilityRole="button"
            onPress={() => { void handleEyePress(); }}
            style={[styles.eyeButton, !canReveal && styles.eyeDisabled]}
          >
            {checkingPin ? (
              <ActivityIndicator color={theme.brand} size="small" />
            ) : (
              <Eye color={canReveal ? theme.brand : theme.faint} size={17} strokeWidth={2.3} />
            )}
          </Pressable>
        </View>
      )}
      {hintVisible && !isRevealed ? <Text style={styles.hint}>{eyeTitle}</Text> : null}

      {mode === "setup" ? (
        <PinSetupModal
          documentType={documentType}
          visible={isModalOpen}
          onClose={closeModal}
          onSetupDone={handleSetupDone}
        />
      ) : (
        <PinVerifyModal
          documentType={documentType}
          visible={isModalOpen && !showForgot}
          onClose={closeModal}
          onVerified={handleVerified}
          onForgotPin={() => setShowForgot(true)}
          lockoutSeconds={lockoutSeconds}
          remainingAttempts={remainingAttempts}
        />
      )}

      <PinForgotModal
        visible={showForgot}
        onClose={() => setShowForgot(false)}
        onResetDone={() => {
          setShowForgot(false);
          void openModal();
        }}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setShowSetupNotice(false)}
        transparent
        visible={showSetupNotice}
      >
        <View style={styles.overlay}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <KeyRound color={theme.brand} size={22} strokeWidth={2.3} />
            </View>
            <Text style={styles.noticeTitle}>Cần thiết lập mã PIN</Text>
            <Text style={styles.noticeDescription}>
              Bạn cần thiết lập mã PIN để xem thông tin giấy tờ này.
            </Text>
            <View style={styles.noticeActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowSetupNotice(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Để sau</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowSetupNotice(false);
                  void openModal();
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>Thiết lập ngay</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme, align: "left" | "right") =>
  StyleSheet.create({
    wrap: { flexShrink: 1, minWidth: 0, alignItems: align === "left" ? "flex-start" : "flex-end", gap: 2 },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    revealedWrap: { flexShrink: 1, minWidth: 0, alignItems: align === "left" ? "flex-start" : "flex-end", gap: 4 },
    revealedRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
    masked: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: align, flexShrink: 1 },
    plaintext: { color: theme.text, fontSize: 14, fontWeight: "800", textAlign: align, flexShrink: 1 },
    countdown: { color: theme.success, fontSize: 11, fontWeight: "700", flexShrink: 1 },
    eyeButton: {
      width: 30,
      height: 30,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
    },
    eyeDisabled: { opacity: 0.6 },
    hint: { color: theme.muted, fontSize: 11, textAlign: align, fontWeight: "600" },
    overlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    noticeCard: {
      width: "100%",
      maxWidth: 320,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 20,
      gap: 10,
      alignItems: "center",
    },
    noticeIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    noticeTitle: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    noticeDescription: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
    noticeActions: { flexDirection: "row", gap: 8, marginTop: 6 },
    primaryButton: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    primaryText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    secondaryButton: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    secondaryText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  });
