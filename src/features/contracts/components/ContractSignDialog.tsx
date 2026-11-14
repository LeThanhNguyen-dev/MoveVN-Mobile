import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import { useTranslation } from "react-i18next";
import CodeDigitInput from "@/components/CodeDigitInput";
import type { ContractSummary } from "@/features/contracts/types";
import { requestSignOtp, sendForSigning, verifySignOtp } from "@/features/contracts/contractService";
import { clearSignOtp, hasUnexpiredSignOtp, rememberSignOtp } from "@/features/contracts/signOtp";
import { getApiErrorMessage } from "@/services/apiClient";
import { detailFont as font, useDetailTheme, type DetailPalette } from "@/features/vehicles/components/detail/detailTheme";

/** Gửi OTP (kèm gửi duyệt nếu hợp đồng còn nháp) và xác nhận ký hợp đồng. */
export default function ContractSignDialog({
  contract,
  userId,
  onClose,
  onSigned,
}: {
  contract: ContractSummary | null;
  userId: number;
  onClose: () => void;
  onSigned: (contract: ContractSummary) => void;
}) {
  const { p } = useDetailTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(p), [p]);
  const [otp, setOtp] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!contract) return;
    let active = true;
    setOtp("");
    setPreparing(true);
    (async () => {
      try {
        if (contract.status === "Draft") await sendForSigning(contract.id);
        if (!(await hasUnexpiredSignOtp(userId, contract.id))) {
          await requestSignOtp(contract.id);
          await rememberSignOtp(userId, contract.id);
        }
      } catch (err) {
        showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.signDialog.otpFailed")));
        if (active) closeRef.current();
      } finally {
        if (active) setPreparing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [contract, userId]);

  async function confirm() {
    if (!contract) return;
    if (otp.trim().length < 6) {
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("contract:otp.errorLength"));
      return;
    }
    setBusy(true);
    try {
      await verifySignOtp(contract.id, otp.trim());
      await clearSignOtp(userId, contract.id);
      showAppAlert(t("contract:toast.successTitle"), t("mobile:contract.signDialog.signed"));
      onSigned(contract);
    } catch (err) {
      showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.signDialog.otpInvalid")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={contract !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{t("contract:section.sign")}</Text>
          <Text style={styles.muted}>
            {preparing ? t("mobile:contract.signDialog.preparing") : t("mobile:contract.signDialog.sentHint")}
          </Text>
          {preparing ? (
            <>
              <ActivityIndicator color={p.brand} />
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.ghostButton}>
                <Text style={styles.ghostText}>{t("contract:drawer.close")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <CodeDigitInput
                label={t("mobile:contract.signDialog.otpPlaceholder")}
                value={otp}
                onChange={setOtp}
                autoFocus
              />
              <View style={styles.actions}>
                <Pressable onPress={onClose} accessibilityRole="button" style={styles.ghostButton}>
                  <Text style={styles.ghostText}>{t("contract:drawer.close")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void confirm()}
                  disabled={busy}
                  accessibilityRole="button"
                  style={[styles.primaryButton, busy && styles.disabled]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={p.onBrand} />
                  ) : (
                    <Text style={styles.primaryText}>{t("mobile:contract.signDialog.confirm")}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: DetailPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(9,7,15,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: {
      width: "100%",
      backgroundColor: p.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.line,
      padding: 18,
      gap: 10,
    },
    title: { color: p.ink, fontFamily: font.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.25 },
    muted: { color: p.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 16 },
    actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 2 },
    ghostButton: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: p.muted, fontFamily: font.bold, fontSize: 12.5 },
    primaryButton: {
      borderRadius: 12,
      backgroundColor: p.brand,
      paddingHorizontal: 18,
      paddingVertical: 10,
      minWidth: 112,
      alignItems: "center",
    },
    primaryText: { color: p.onBrand, fontFamily: font.bold, fontSize: 12.5 },
    disabled: { opacity: 0.6 },
  });
