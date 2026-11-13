import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { BookingButton, BookingField } from "@/features/booking/components/BookingControls";
import type { BookingResponse } from "@/features/booking/types";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  approveExtensionRequest,
  createExtensionRequest,
  getExtensionRequests,
  rejectExtensionRequest,
  type ExtensionRequestItem,
} from "../contractService";

export default function ExtensionRequestPanel({ booking, onBookingChanged }: {
  booking: BookingResponse;
  onBookingChanged?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.userId === booking.ownerId;
  const isCustomer = user?.userId === booking.customerId;

  const [requests, setRequests] = useState<ExtensionRequestItem[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ExtensionRequestItem | null>(null);
  const [busy, setBusy] = useState<"" | "approve" | "request" | "reject">("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await getExtensionRequests(booking.id));
    } catch {
      setRequests([]);
    }
  }, [booking.id]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  if (!isOwner && !isCustomer) return null;

  const pending = requests.find((r) => r.status === "Pending");
  const latest = requests[0];
  const canRequest = isCustomer && !pending && ["DepositPaid", "InProgress"].includes(booking.status);

  async function handleRequest() {
    const parsed = Number(days);
    if (!/^\d+$/.test(days.trim()) || !Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
      setError(t("mobile:contract.errors.extendDays"));
      return;
    }
    setBusy("request"); setError("");
    try {
      await createExtensionRequest(booking.id, parsed, note.trim() || undefined);
      Alert.alert(
        t("contract:extensionRequest.sentToastTitle"),
        t("contract:extensionRequest.sentToastMessage", { count: parsed }),
      );
      setShowRequestModal(false);
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, t("contract:extensionRequest.failed")));
    } finally {
      setBusy("");
    }
  }

  async function handleApprove(request: ExtensionRequestItem) {
    if (busy) return;
    setBusy("approve"); setError("");
    try {
      await approveExtensionRequest(request.id);
      Alert.alert(
        t("contract:extensionRequest.approvedToastTitle"),
        t("contract:extensionRequest.approvedToastMessage", { count: request.additionalDays }),
      );
      await loadRequests();
      onBookingChanged?.();
    } catch (err) {
      Alert.alert(
        t("contract:extensionRequest.approveFailedTitle"),
        getApiErrorMessage(err, t("contract:extensionRequest.approveFailedMessage")),
      );
      await loadRequests();
    } finally {
      setBusy("");
    }
  }

  async function handleReject() {
    if (!rejectTarget || !reason.trim()) return;
    setBusy("reject"); setError("");
    try {
      await rejectExtensionRequest(rejectTarget.id, reason.trim());
      Alert.alert(t("contract:extensionRequest.rejectedToastTitle"), t("contract:extensionRequest.rejectedToastMessage"));
      setRejectTarget(null);
      await loadRequests();
    } catch (err) {
      setError(getApiErrorMessage(err, t("contract:extensionRequest.rejectFailed")));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {isOwner && pending ? (
        <View style={[styles.banner, styles.infoBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.info }]}>
            {t("contract:extensionRequest.pendingOwner", { count: pending.additionalDays })}
          </Text>
          {pending.note ? <Text style={styles.muted}>{t("contract:extensionRequest.note")} {pending.note}</Text> : null}
          <Text style={styles.muted}>{t("contract:extensionRequest.approveHint")}</Text>
          <View style={styles.bannerActions}>
            <View style={styles.flexButton}>
              <BookingButton title={t("contract:extensionRequest.approve")} busy={busy === "approve"} onPress={() => void handleApprove(pending)} />
            </View>
            <View style={styles.flexButton}>
              <BookingButton title={t("contract:extensionRequest.reject")} secondary disabled={busy !== ""} onPress={() => { setError(""); setReason(""); setRejectTarget(pending); }} />
            </View>
          </View>
        </View>
      ) : null}

      {isCustomer && pending ? (
        <View style={[styles.banner, styles.infoBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.info }]}>
            {t("contract:extensionRequest.pendingCustomer", { count: pending.additionalDays })}
          </Text>
          {pending.note ? <Text style={styles.muted}>{t("contract:extensionRequest.note")} {pending.note}</Text> : null}
        </View>
      ) : null}

      {isOwner && !pending && latest && latest.status === "Approved" ? (
        <View style={[styles.banner, styles.successBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.success }]}>
            {t("contract:extensionRequest.approvedInfo", { count: latest.additionalDays })}
          </Text>
        </View>
      ) : null}

      {isCustomer && !pending && latest && latest.status === "Rejected" ? (
        <View style={[styles.banner, styles.dangerBanner]}>
          <Text style={[styles.bannerTitle, { color: theme.danger }]}>
            {t("contract:extensionRequest.rejectedInfo", { count: latest.additionalDays })}
          </Text>
          {latest.rejectReason ? <Text style={styles.muted}>{t("contract:extensionRequest.reason")} {latest.rejectReason}</Text> : null}
        </View>
      ) : null}

      {canRequest ? (
        <BookingButton title={t("contract:extensionRequest.title")} onPress={() => { setError(""); setDays(""); setNote(""); setShowRequestModal(true); }} />
      ) : null}

      <Modal visible={showRequestModal} transparent animationType="fade" onRequestClose={() => { if (!busy) setShowRequestModal(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t("contract:extensionRequest.title")}</Text>
            <Text style={styles.muted}>
              {t("contract:extensionRequest.description")}
            </Text>
            <BookingField label={t("contract:extensionRequest.daysLabel")} numeric value={days} onChangeText={setDays} editable={!busy} />
            <BookingField label={t("contract:extensionRequest.noteLabel")} value={note} onChangeText={setNote} multiline editable={!busy} />
            {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowRequestModal(false)} disabled={busy !== ""} style={styles.ghostButton}>
                <Text style={styles.ghostText}>{t("contract:extensionRequest.cancel")}</Text>
              </Pressable>
              <Pressable onPress={() => void handleRequest()} disabled={busy !== "" || !days} style={[styles.primaryButton, (busy !== "" || !days) && styles.disabled]}>
                <Text style={styles.primaryText}>{t("contract:extensionRequest.submit")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setRejectTarget(null); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t("contract:extensionRequest.rejectTitle", { count: rejectTarget?.additionalDays ?? 0 })}</Text>
            <BookingField label={t("contract:extensionRequest.rejectReason")} value={reason} onChangeText={setReason} multiline editable={!busy} />
            {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRejectTarget(null)} disabled={busy !== ""} style={styles.ghostButton}>
                <Text style={styles.ghostText}>{t("contract:extensionRequest.cancel")}</Text>
              </Pressable>
              <Pressable onPress={() => void handleReject()} disabled={busy !== "" || !reason.trim()} style={[styles.primaryButton, styles.dangerButton, (busy !== "" || !reason.trim()) && styles.disabled]}>
                <Text style={styles.primaryText}>{t("contract:extensionRequest.confirmReject")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
    infoBanner: { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder },
    successBanner: { backgroundColor: theme.successSoft, borderColor: theme.success },
    dangerBanner: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder },
    bannerTitle: { fontSize: 14, fontWeight: "700" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    bannerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    flexButton: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    modalTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
    ghostButton: { borderRadius: 8, backgroundColor: theme.surfaceAlt, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
    ghostText: { color: theme.text, fontSize: 13, fontWeight: "700" },
    primaryButton: { borderRadius: 8, backgroundColor: theme.brand, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
    dangerButton: { backgroundColor: theme.danger },
    primaryText: { color: theme.onBrand, fontSize: 13, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });
