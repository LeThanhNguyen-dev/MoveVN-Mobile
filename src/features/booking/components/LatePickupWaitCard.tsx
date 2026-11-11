import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { BookingButton } from "./BookingControls";
import { acceptLatePickup } from "../bookingService";
import { getApiErrorMessage } from "@/services/apiClient";
import { formatDateTime, formatMoney } from "../utils/format";
import type { BookingResponse } from "../types";

const ACCEPT_WINDOW_HOURS = 24;

export default function LatePickupWaitCard({ booking, hasCheckIn, onUpdated }: {
  booking: BookingResponse; hasCheckIn: boolean; onUpdated: (booking: BookingResponse) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const startMs = new Date(booking.startDate).getTime();
  if (!["Approved", "DepositPaid"].includes(booking.status) || hasCheckIn) return null;
  if (now < startMs - ACCEPT_WINDOW_HOURS * 3600_000) return null;

  async function accept() {
    if (busy) return;
    setBusy(true);
    try {
      onUpdated(await acceptLatePickup(booking.id));
      setOpen(false);
      Alert.alert(t("booking:latePickup.registeredToastTitle"), t("booking:latePickup.registeredToastMessage"));
    } catch (err) {
      Alert.alert(t("booking:latePickup.registerFailedToastTitle"), getApiErrorMessage(err, t("booking:latePickup.registerFailedFallback")));
    } finally {
      setBusy(false);
    }
  }

  if (booking.latePickupCompensatedAt) {
    return (
      <View style={[styles.banner, styles.successBanner]}>
        <Text style={[styles.bannerTitle, { color: theme.success }]}>{t("booking:latePickup.compensatedTitle")}</Text>
        <Text style={styles.bannerBody}>
          {t("mobile:inspection.latePickup.compensatedBody", { hours: booking.latePickupCompensationHours, amount: formatMoney(booking.latePickupCompensationAmount), date: formatDateTime(booking.endDate) })}
        </Text>
      </View>
    );
  }

  if (booking.latePickupAcceptedAt) {
    return (
      <View style={[styles.banner, styles.infoBanner]}>
        <Text style={[styles.bannerTitle, { color: theme.info }]}>{t("booking:latePickup.acceptedTitle")}</Text>
        <Text style={styles.bannerBody}>
          {t("booking:latePickup.acceptedBody")}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.banner, styles.warnBanner]}>
        <Text style={styles.bannerBody}>
          {t("mobile:inspection.latePickup.offerBody")}
        </Text>
        <BookingButton title={t("booking:latePickup.acceptWait")} onPress={() => setOpen(true)} />
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t("booking:latePickup.acceptModalTitle")}</Text>
            <Text style={styles.bannerBody}>
              {t("booking:latePickup.acceptModalBody")}
            </Text>
            <Text style={styles.muted}>
              {t("booking:latePickup.acceptModalHint")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setOpen(false)} disabled={busy} style={styles.ghostButton}>
                <Text style={styles.ghostText}>{t("common:closeAction")}</Text>
              </Pressable>
              <Pressable onPress={() => void accept()} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]}>
                <Text style={styles.primaryText}>{t("booking:latePickup.acceptConfirm")}</Text>
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
    banner: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
    warnBanner: { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder },
    infoBanner: { backgroundColor: theme.infoSoft, borderColor: theme.infoBorder },
    successBanner: { backgroundColor: theme.successSoft, borderColor: theme.success },
    bannerTitle: { fontSize: 14, fontWeight: "700" },
    bannerBody: { color: theme.text, fontSize: 13, lineHeight: 20 },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
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
    primaryText: { color: theme.onBrand, fontSize: 13, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });
