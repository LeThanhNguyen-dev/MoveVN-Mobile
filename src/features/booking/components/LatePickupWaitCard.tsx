import { useMemo, useState } from "react";
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
      Alert.alert("Đã đăng ký chờ", "Hệ thống sẽ tự kéo dài giờ thuê bằng đúng số giờ trễ khi xe được bàn giao.");
    } catch (err) {
      Alert.alert("Chưa thể đăng ký chờ", getApiErrorMessage(err, "Vui lòng thử lại hoặc liên hệ hỗ trợ."));
    } finally {
      setBusy(false);
    }
  }

  if (booking.latePickupCompensatedAt) {
    return (
      <View style={[styles.banner, styles.successBanner]}>
        <Text style={[styles.bannerTitle, { color: theme.success }]}>Đã tự động bù giờ thuê</Text>
        <Text style={styles.bannerBody}>
          Chuyến trước trả muộn nên hệ thống đã kéo dài giờ thuê của bạn thêm {booking.latePickupCompensationHours} giờ (giá trị {formatMoney(booking.latePickupCompensationAmount)}). Giờ trả mới: {formatDateTime(booking.endDate)}.
        </Text>
      </View>
    );
  }

  if (booking.latePickupAcceptedAt) {
    return (
      <View style={[styles.banner, styles.infoBanner]}>
        <Text style={[styles.bannerTitle, { color: theme.info }]}>Đã đăng ký chờ xe</Text>
        <Text style={styles.bannerBody}>
          Bạn đã chấp nhận chờ nếu chuyến trước trả muộn. Khi xe được bàn giao, hệ thống sẽ tự kéo dài giờ thuê bằng đúng số giờ trễ (chi phí lấy từ phí trả muộn của chuyến trước). Nếu tới giờ nhận xe mà xe vẫn chưa sẵn sàng, bạn có thể hủy miễn phí với hoàn 100% tiền cọc.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.banner, styles.warnBanner]}>
        <Text style={styles.bannerBody}>
          Chuyến trước của xe có thể trả muộn, ảnh hưởng tới giờ nhận xe của bạn. Bạn có thể chấp nhận chờ — hệ thống sẽ tự kéo dài giờ thuê đúng bằng số giờ trễ, lấy từ phí trả muộn của chuyến trước. Nếu tới giờ nhận xe mà xe vẫn chưa sẵn sàng, bạn có thể hủy miễn phí với hoàn 100% tiền cọc.
        </Text>
        <BookingButton title="Chấp nhận chờ — tự bù giờ thuê" onPress={() => setOpen(true)} />
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Chấp nhận chờ xe</Text>
            <Text style={styles.bannerBody}>
              Khi bạn chấp nhận chờ: booking của bạn sẽ không bị hệ thống tự hủy trong lúc chờ xe, và ngay khi chuyến trước bàn giao xe, giờ trả xe của bạn sẽ được tự động kéo dài đúng bằng số giờ trễ. Chi phí giờ bù lấy từ phí trả muộn của chuyến trước — bạn không phải trả thêm.
            </Text>
            <Text style={styles.muted}>
              Nếu tới giờ nhận xe mà xe vẫn chưa sẵn sàng, bạn có thể hủy miễn phí với hoàn 100% tiền cọc.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setOpen(false)} disabled={busy} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={() => void accept()} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]}>
                <Text style={styles.primaryText}>Xác nhận chấp nhận chờ</Text>
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
