import { TicketPercent, Wallet, X } from "lucide-react-native";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import AppText from "@/components/AppText";
import { formatMoney } from "@/features/booking/utils/format";
import type { VoucherClaimResponse } from "@/features/voucherClaims/types";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";

type Props = {
  visible: boolean;
  vouchers: readonly VoucherClaimResponse[];
  loading: boolean;
  vehicleType: string | null | undefined;
  bottomInset: number;
  onSelect: (code: string) => void;
  onClose: () => void;
};

function describe(v: VoucherClaimResponse): string {
  const off = v.discountType === "Percentage" ? `${v.discountValue}%` : formatMoney(v.discountValue);
  const cap = v.maxDiscountAmount ? ` · tối đa ${formatMoney(v.maxDiscountAmount)}` : "";
  return `Giảm ${off}${cap}`;
}

function usableFor(v: VoucherClaimResponse, vehicleType: string | null | undefined): boolean {
  return !vehicleType || v.vehicleType === "All" || v.vehicleType === vehicleType;
}

export default function CheckoutVoucherSheet({
  visible,
  vouchers,
  loading,
  vehicleType,
  bottomInset,
  onSelect,
  onClose,
}: Props) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable accessibilityLabel="Đóng ví voucher" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
          <View style={styles.handle} />

          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Wallet color={p.brand} size={18} strokeWidth={2.1} />
            </View>
            <View style={styles.headBody}>
              <AppText style={styles.title}>Ví voucher</AppText>
              <AppText style={styles.subtitle}>Chọn mã giảm giá cho đơn này</AppText>
            </View>
            <Pressable
              accessibilityLabel="Đóng"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <X color={p.muted} size={17} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={p.brand} />
              <AppText style={styles.stateText}>Đang tải voucher…</AppText>
            </View>
          ) : vouchers.length === 0 ? (
            <View style={styles.state}>
              <TicketPercent color={p.faint} size={26} strokeWidth={1.8} />
              <AppText style={styles.stateTitle}>Ví đang trống</AppText>
              <AppText style={styles.stateText}>
                Săn mã ưu đãi ở tab Ưu đãi rồi quay lại đây.
              </AppText>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.listScroll}
            >
              {vouchers.map((v) => {
                const ok = usableFor(v, vehicleType);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !ok }}
                    disabled={!ok}
                    key={v.id}
                    onPress={() => onSelect(v.code)}
                    style={({ pressed }) => [
                      styles.item,
                      !ok && styles.itemDisabled,
                      pressed && ok && styles.pressed,
                    ]}
                  >
                    <View style={styles.itemIcon}>
                      <TicketPercent color={ok ? p.brand : p.faint} size={17} strokeWidth={2} />
                    </View>
                    <View style={styles.itemBody}>
                      <AppText style={styles.code} numberOfLines={1}>
                        {v.code}
                      </AppText>
                      <AppText style={styles.name} numberOfLines={1}>
                        {v.name}
                      </AppText>
                      <AppText style={styles.meta} numberOfLines={1}>
                        {describe(v)}
                        {v.minOrderAmount ? ` · đơn từ ${formatMoney(v.minOrderAmount)}` : ""}
                      </AppText>
                      {!ok ? (
                        <AppText style={styles.blocked}>Không áp dụng cho loại xe này</AppText>
                      ) : null}
                    </View>
                    {ok ? (
                      <View style={styles.usePill}>
                        <AppText style={styles.useText}>Dùng</AppText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(10,6,20,0.5)",
    },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 8,
      paddingHorizontal: 16,
      maxHeight: "82%",
      shadowColor: p.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -10 },
      elevation: 18,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: p.line,
      alignSelf: "center",
      marginBottom: 12,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    headIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.brandSoft,
    },
    headBody: { flex: 1, minWidth: 0 },
    title: { color: p.ink, fontFamily: checkoutFont.display, fontSize: 19, letterSpacing: -0.3 },
    subtitle: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10.5, marginTop: 1 },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surfaceAlt,
    },
    state: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 34, paddingHorizontal: 20 },
    stateTitle: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 13, marginTop: 2 },
    stateText: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10.5, textAlign: "center", lineHeight: 15 },
    listScroll: { flexGrow: 0 },
    list: { gap: 9, paddingBottom: 6 },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
      padding: 12,
    },
    itemDisabled: { opacity: 0.5 },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      flexShrink: 0,
    },
    itemBody: { flex: 1, minWidth: 0 },
    code: {
      color: p.ink,
      fontFamily: checkoutFont.extraBold,
      fontSize: 12.5,
      letterSpacing: 0.7,
    },
    name: { color: p.muted, fontFamily: checkoutFont.medium, fontSize: 10.5, marginTop: 1 },
    meta: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 9.5, marginTop: 2 },
    blocked: { color: p.danger, fontFamily: checkoutFont.medium, fontSize: 9.5, marginTop: 2 },
    usePill: {
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: p.brand,
      flexShrink: 0,
    },
    useText: { color: p.onBrand, fontFamily: checkoutFont.bold, fontSize: 10 },
    pressed: { opacity: 0.72 },
  });
