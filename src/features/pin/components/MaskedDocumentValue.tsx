import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
    closeModal,
    handleVerified,
    handleSetupDone,
    hide,
  } = usePinReveal(documentType, vehicleType);

  useEffect(() => () => {
    if (hintTimer.current !== null) clearTimeout(hintTimer.current);
  }, []);

  // Khi giấy tờ mất trạng thái Verified (ví dụ đổi tab) thì che số ngay.
  useEffect(() => {
    if (!canReveal) hide();
  }, [canReveal, hide]);

  const eyeTitle = canReveal
    ? (isPinSet ? "Hiển thị bằng mã PIN" : "Thiết lập mã PIN để hiển thị")
    : (revealDisabledHint ?? "Giấy tờ chưa được xác thực để hiển thị.");

  function handleEyePress() {
    if (!canReveal) {
      setHintVisible(true);
      if (hintTimer.current !== null) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHintVisible(false), 3000);
      return;
    }
    void openModal();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {isRevealed && plaintext !== null ? (
          <>
            <Text style={styles.plaintext}>{plaintext}</Text>
            <Text style={styles.countdown}>Đang hiển thị · {secondsLeft}s</Text>
            <Pressable accessibilityLabel="Ẩn" accessibilityRole="button" onPress={hide} style={styles.eyeButton}>
              <EyeOff color={theme.brand} size={17} strokeWidth={2.3} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.masked}>{maskedValue ?? "••••••"}</Text>
            <Pressable
              accessibilityLabel="Hiển thị số giấy tờ"
              accessibilityRole="button"
              onPress={handleEyePress}
              style={[styles.eyeButton, !canReveal && styles.eyeDisabled]}
            >
              <Eye color={canReveal ? theme.brand : theme.faint} size={17} strokeWidth={2.3} />
            </Pressable>
          </>
        )}
      </View>
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
    </View>
  );
}

const createStyles = (theme: Theme, align: "left" | "right") =>
  StyleSheet.create({
    wrap: { flexShrink: 1, alignItems: align === "left" ? "flex-start" : "flex-end", gap: 2 },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    masked: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: align },
    plaintext: { color: theme.text, fontSize: 14, fontWeight: "800", textAlign: align },
    countdown: { color: theme.success, fontSize: 11, fontWeight: "700" },
    eyeButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
    eyeDisabled: { opacity: 0.6 },
    hint: { color: theme.muted, fontSize: 11, textAlign: align, fontWeight: "600" },
  });
