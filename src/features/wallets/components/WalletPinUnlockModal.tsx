import { useState } from "react";
import PinForgotModal from "@/features/pin/components/PinForgotModal";
import PinSetupModal from "@/features/pin/components/PinSetupModal";
import PinVerifyModal from "@/features/pin/components/PinVerifyModal";
import type { UseWalletPinGateResult } from "@/features/wallets/hooks/useWalletPinGate";

/**
 * Popup mở khóa ví dùng chung component PIN: chưa có PIN thì mở setup,
 * có rồi thì mở verify, quên thì sang forgot. Mở khóa đúng thì tự đóng
 * và gọi onUnlocked (vd: để tiếp tục tạo yêu cầu rút ngay sau đó).
 */
export default function WalletPinUnlockModal({
  gate,
  visible,
  onClose,
  onUnlocked,
  verifyDescription,
}: {
  gate: UseWalletPinGateResult;
  visible: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
  verifyDescription?: string;
}) {
  const [forgotVisible, setForgotVisible] = useState(false);
  const isPinSet = gate.pinStatus?.isPinSet ?? true;

  async function handleVerified(pinCode: string) {
    const result = await gate.verify(pinCode);
    if (result.ok) {
      setForgotVisible(false);
      onClose();
      onUnlocked?.();
    }
    return result;
  }

  async function handleSetupDone(pinCode: string) {
    const result = await gate.afterSetup(pinCode);
    if (result.ok) {
      onClose();
      onUnlocked?.();
    }
    return result;
  }

  if (!visible) {
    return null;
  }

  if (!isPinSet) {
    return (
      <PinSetupModal
        documentType="CCCD"
        visible={visible}
        onClose={onClose}
        onSetupDone={handleSetupDone}
        purposeDescription="Thiết lập mã PIN 6 chữ số để bảo vệ số dư và rút tiền trong ví của bạn."
      />
    );
  }

  return (
    <>
      <PinVerifyModal
        documentType="CCCD"
        visible={visible && !forgotVisible}
        onClose={onClose}
        onVerified={handleVerified}
        onForgotPin={() => setForgotVisible(true)}
        lockoutSeconds={gate.lockoutSeconds}
        remainingAttempts={gate.remainingAttempts}
        purposeDescription={verifyDescription ?? "Nhập mã PIN của bạn để xem số dư ví."}
      />
      <PinForgotModal
        visible={forgotVisible}
        onClose={() => setForgotVisible(false)}
        onResetDone={() => {
          setForgotVisible(false);
          void gate.check();
        }}
      />
    </>
  );
}
