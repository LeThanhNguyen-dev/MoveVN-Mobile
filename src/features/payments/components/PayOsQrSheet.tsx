import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { ViewInstance } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import QRCode from "react-native-qrcode-svg";
import { CheckCircle2, Copy, ExternalLink, Landmark, Lightbulb, TriangleAlert, X } from "lucide-react-native";
import AppText from "@/components/AppText";
import { formatMoney } from "@/features/booking/bookingDisplay";
import TourOverlay from "@/features/onboarding/components/TourOverlay";
import { useBookingTour } from "@/features/onboarding/bookingTour";
import { payosBankLabel } from "@/features/payments/payosBank";
import { formatCountdown, payosExpirySeconds } from "@/features/payments/payosTime";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

/** Tiền tố return URL của PayOS khi thanh toán trong app; giữ lại để link vẫn
 *  quay về được app nếu khách mở trang PayOS bằng trình duyệt. */
export const PAYOS_APP_RETURN_PREFIX = "movevn://payment-result";

export function payOsReturnUrl(): string {
  return PAYOS_APP_RETURN_PREFIX;
}

export interface PayOsSheetData {
  checkoutUrl: string;
  qrCode: string;
  orderCode: number;
  amount: number;
  bin?: string;
  accountNumber?: string;
  accountName?: string;
  expiredAt?: number | null;
  title: string;
  subtitle?: string;
}

const QR_COLOR = "#101936";
const QR_BACKGROUND = "#FFFFFF";

/** Sheet thanh toán PayOS phong cách MoveVN: hiển thị mã VietQR + thông tin
 *  tài khoản nhận để khách quét/chuyển khoản, thay cho trang PayOS trong WebView. */
export default function PayOsQrSheet({
  data,
  onClose,
  onCheckNow,
  onCancel,
}: {
  data: PayOsSheetData | null;
  onClose: () => void;
  onCheckNow?: (orderCode: number) => void;
  onCancel?: () => void | Promise<void>;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCardRef = useRef<ViewInstance>(null);
  const tourStep = useBookingTour((state) => state.step);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!data) return;
    startedAtRef.current = Date.now();
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data]);

  // Có expiredAt từ PayOS thì đếm theo giờ thật của link; chưa có (BE cũ) thì
  // đếm ngược 30 phút kể từ lúc mở sheet.
  const startMs = startedAtRef.current || nowMs;
  const fallbackExpirySec = Math.floor(startMs / 1000) + 30 * 60;
  const remainingSeconds = data
    ? payosExpirySeconds(data.expiredAt ?? fallbackExpirySec, nowMs)
    : 0;

  const isExpired = data !== null && remainingSeconds <= 0;
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setCancelConfirmOpen(false);
    setCancelling(false);
    setActionError(null);
  }, [data?.orderCode]);

  function requestCancel() {
    if (!onCancel) return;
    setActionError(null);
    setCancelConfirmOpen(true);
  }

  // Confirm vẽ ngay trong Modal của sheet: popup toàn cục (AppDialogHost) là một Modal
  // thứ hai, không present được khi Modal này đang mở nên bấm nút sẽ "câm".
  async function runCancel() {
    if (!onCancel) return;
    setCancelConfirmOpen(false);
    setCancelling(true);
    try {
      await onCancel();
    } catch {
      setActionError(t("mobile:wallet.payment.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  async function copyToClipboard(key: string, value: string) {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedKey(key);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setActionError(t("mobile:wallet.payment.copyFailed"));
    }
  }

  async function openPayosPage() {
    if (!data?.checkoutUrl) return;
    try {
      await Linking.openURL(data.checkoutUrl);
    } catch {
      setActionError(t("mobile:wallet.payment.openFailed"));
    }
  }

  return (
    <Modal
      visible={data !== null}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {
        if (cancelConfirmOpen) {
          if (!cancelling) setCancelConfirmOpen(false);
          return;
        }
        onClose();
      }}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <AppText display style={styles.headerTitle}>{data?.title ?? t("mobile:wallet.payment.title")}</AppText>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel={t("mobile:wallet.a11y.closePayment")}
          >
            <X color={theme.text} size={20} />
          </Pressable>
        </View>

        {data ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.payToRow}>
              <View style={styles.brandChip}>
                <View style={styles.brandLogo}><AppText style={styles.brandLogoText}>M</AppText></View>
                <AppText style={styles.brandName}>MOVEVN</AppText>
              </View>
              <AppText style={styles.payToText}>{t("mobile:wallet.payment.payingTo")}</AppText>
              <View style={styles.payosChip}>
                <AppText style={styles.payosChipText}>payOS</AppText>
              </View>
            </View>

            <View style={styles.amountCard}>
              <AppText style={styles.amount}>{formatMoney(data.amount)}</AppText>
              {data.subtitle ? <AppText style={styles.subtitle}>{data.subtitle}</AppText> : null}
              <AppText style={styles.expires}>
                {isExpired
                  ? t("mobile:wallet.payment.expiredLabel")
                  : t("mobile:wallet.payment.expiresInCountdown", { time: formatCountdown(remainingSeconds) })}
              </AppText>
            </View>

            {data.qrCode ? (
              <View ref={qrCardRef} collapsable={false} style={styles.qrCard}>
                <QRCode
                  value={data.qrCode}
                  size={216}
                  color={QR_COLOR}
                  backgroundColor={QR_BACKGROUND}
                  ecl="M"
                />
                <AppText style={styles.qrCaption}>VietQR · NAPAS</AppText>
              </View>
            ) : (
              <View ref={qrCardRef} collapsable={false} style={styles.qrFallbackCard}>
                <AppText style={styles.qrFallbackText}>{t("mobile:wallet.payment.qrFallback")}</AppText>
                <Pressable onPress={openPayosPage} style={styles.outlineButton}>
                  <ExternalLink color={theme.brand} size={16} />
                  <AppText style={styles.outlineButtonText}>{t("mobile:wallet.payment.openPayosPage")}</AppText>
                </Pressable>
              </View>
            )}

            <View style={styles.hintCard}>
              <Lightbulb color={theme.brand} size={18} />
              <AppText style={styles.hintText}>{t("mobile:wallet.payment.scanHint")}</AppText>
            </View>

            <View style={styles.bankCard}>
              <View style={styles.bankHead}>
                <Landmark color={theme.muted} size={16} />
                <AppText style={styles.bankHeadText}>{payosBankLabel(data.bin)}</AppText>
              </View>
              <View style={styles.bankDivider} />
              <View style={styles.bankRow}>
                <AppText style={styles.bankLabel}>{t("mobile:wallet.payment.accountHolder")}</AppText>
                <AppText style={styles.bankValue}>{data.accountName || "—"}</AppText>
              </View>
              <View style={styles.bankRow}>
                <AppText style={styles.bankLabel}>{t("mobile:wallet.payment.accountNumber")}</AppText>
                <View style={styles.bankValueRow}>
                  <AppText style={styles.bankValue}>{data.accountNumber || "—"}</AppText>
                  {data.accountNumber ? (
                    <Pressable
                      onPress={() => copyToClipboard("account", data.accountNumber!)}
                      style={styles.copyButton}
                      accessibilityLabel={t("mobile:wallet.payment.copy")}
                    >
                      <Copy color={theme.muted} size={14} />
                      <AppText style={styles.copyText}>
                        {copiedKey === "account" ? t("mobile:wallet.payment.copied") : t("mobile:wallet.payment.copy")}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.bankRow}>
                <AppText style={styles.bankLabel}>{t("mobile:wallet.payment.transferContent")}</AppText>
                <View style={styles.bankValueRow}>
                  <AppText style={styles.bankValueStrong}>{data.orderCode}</AppText>
                  <Pressable
                    onPress={() => copyToClipboard("content", String(data.orderCode))}
                    style={styles.copyButton}
                    accessibilityLabel={t("mobile:wallet.payment.copy")}
                  >
                    <Copy color={theme.muted} size={14} />
                    <AppText style={styles.copyText}>
                      {copiedKey === "content" ? t("mobile:wallet.payment.copied") : t("mobile:wallet.payment.copy")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.waitingRow}>
              <CheckCircle2 color={theme.success} size={16} />
              <AppText style={styles.waitingText}>{t("mobile:wallet.payment.checking")}</AppText>
            </View>

            <Pressable
              onPress={() => onCheckNow?.(data.orderCode)}
              style={[styles.primaryButton, isExpired && styles.primaryButtonDisabled]}
              disabled={isExpired}
              accessibilityLabel={t("mobile:wallet.payment.paidDone")}
            >
              <AppText style={styles.primaryButtonText}>{t("mobile:wallet.payment.paidDone")}</AppText>
            </Pressable>
            {data.checkoutUrl ? (
              <Pressable onPress={openPayosPage} style={styles.ghostButton}>
                <ExternalLink color={theme.muted} size={16} />
                <AppText style={styles.ghostButtonText}>{t("mobile:wallet.payment.openPayosPage")}</AppText>
              </Pressable>
            ) : null}
            {onCancel ? (
              <Pressable
                onPress={requestCancel}
                style={styles.cancelButton}
                disabled={cancelling}
                accessibilityLabel={t("mobile:wallet.payment.cancelPayment")}
              >
                <AppText style={styles.cancelButtonText}>{t("mobile:wallet.payment.cancelPayment")}</AppText>
              </Pressable>
            ) : null}
            {actionError ? (
              <AppText style={styles.actionError} accessibilityRole="alert">{actionError}</AppText>
            ) : null}
          </ScrollView>
        ) : null}

        {cancelConfirmOpen && onCancel ? (
          <View style={styles.confirmBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessible={false}
              onPress={() => { if (!cancelling) setCancelConfirmOpen(false); }}
            />
            <View style={styles.confirmCard} accessibilityViewIsModal accessibilityRole="alert">
              <View style={styles.confirmHead}>
                <View style={styles.confirmIconTile}>
                  <TriangleAlert color={theme.danger} size={18} strokeWidth={2.1} />
                </View>
                <AppText display numberOfLines={3} style={styles.confirmTitle}>
                  {t("mobile:wallet.payment.cancelPaymentTitle")}
                </AppText>
              </View>
              <AppText style={styles.confirmBody}>{t("mobile:wallet.payment.cancelPaymentBody")}</AppText>
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={() => setCancelConfirmOpen(false)}
                  disabled={cancelling}
                  style={[styles.confirmButton, styles.confirmKeep]}
                  accessibilityRole="button"
                >
                  <AppText style={styles.confirmKeepText}>{t("mobile:wallet.alerts.keep")}</AppText>
                </Pressable>
                <Pressable
                  onPress={() => { void runCancel(); }}
                  disabled={cancelling}
                  style={[styles.confirmButton, styles.confirmDanger]}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile:wallet.alerts.confirmCancel")}
                >
                  <AppText style={styles.confirmDangerText}>{t("mobile:wallet.alerts.confirmCancel")}</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {tourStep === "payment" ? <TourOverlay step="payment" anchorRef={qrCardRef} /> : null}
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800", flex: 1, marginRight: 8 },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    content: { padding: 16, gap: 12, paddingBottom: 32 },
    payToRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    brandChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    brandLogo: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    brandLogoText: { color: theme.onBrand, fontSize: 12, fontWeight: "900" },
    brandName: { color: theme.muted, fontSize: 13, fontWeight: "800" },
    payToText: { color: theme.faint, fontSize: 13 },
    payosChip: {
      backgroundColor: "#E6F7EF",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    payosChipText: { color: "#0BA35B", fontSize: 13, fontWeight: "800" },
    amountCard: {
      alignItems: "center",
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 16,
      gap: 4,
    },
    amount: { color: theme.text, fontSize: 30, fontWeight: "900" },
    subtitle: { color: theme.muted, fontSize: 14 },
    expires: { color: theme.danger, fontSize: 12, fontWeight: "700", marginTop: 4 },
    qrCard: {
      alignSelf: "center",
      alignItems: "center",
      backgroundColor: QR_BACKGROUND,
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    qrCaption: { color: "#64748B", fontSize: 12, fontWeight: "700" },
    qrFallbackCard: {
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
    },
    qrFallbackText: { color: theme.muted, fontSize: 13, textAlign: "center" },
    hintCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: theme.infoSoft,
      borderWidth: 1,
      borderColor: theme.infoBorder,
      borderRadius: 12,
      padding: 12,
    },
    hintText: { color: theme.text, fontSize: 13, lineHeight: 19, flex: 1 },
    bankCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    bankHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    bankHeadText: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    bankDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    bankRow: { gap: 2 },
    bankLabel: { color: theme.muted, fontSize: 12 },
    bankValue: { color: theme.text, fontSize: 14, fontWeight: "700" },
    bankValueStrong: { color: theme.brand, fontSize: 15, fontWeight: "900" },
    bankValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    copyText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    waitingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    waitingText: { color: theme.muted, fontSize: 12 },
    primaryButton: {
      backgroundColor: theme.brand,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryButtonText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
    primaryButtonDisabled: { opacity: 0.5 },
    outlineButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    outlineButtonText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    ghostButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
    },
    ghostButtonText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    cancelButton: {
      alignItems: "center",
      paddingVertical: 10,
    },
    cancelButtonText: { color: theme.danger, fontSize: 13, fontWeight: "700" },
    actionError: { color: theme.danger, fontSize: 12, fontWeight: "700", textAlign: "center" },
    confirmBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(11,7,20,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    confirmCard: {
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
    confirmHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    confirmIconTile: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: theme.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmTitle: { flex: 1, minWidth: 0, color: theme.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
    confirmBody: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    confirmActions: { flexDirection: "row", gap: 8, marginTop: 2 },
    confirmButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmKeep: { backgroundColor: theme.surface, borderColor: theme.border },
    confirmKeepText: { color: theme.text, fontSize: 13, fontWeight: "800" },
    confirmDanger: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder },
    confirmDangerText: { color: theme.danger, fontSize: 13, fontWeight: "800" },
  });
