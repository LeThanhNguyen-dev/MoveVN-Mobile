import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock3,
  ReceiptText,
  ShieldCheck,
  TicketPercent,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import AppText from "@/components/AppText";
import { formatMoney } from "@/features/booking/utils/format";
import type { PricePreview } from "@/features/booking/utils/bookingPricing";
import { formatCheckoutDate } from "@/features/booking/utils/checkoutFormat";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";
import CheckoutSectionHeader from "./CheckoutSectionHeader";

type DailyPrice = { rentalDate: string; finalDailyPrice: number };

type Props = {
  preview: PricePreview | null;
  days: number;
  dailyPrices: readonly DailyPrice[];
  deliveryDistanceKm: number | null;
  security: { required: boolean; amount: number };
  promoCode: string;
  promoLoading: boolean;
  promoError: string | null;
  canApply: boolean;
  appliedPromo: { code: string; discountAmount: number } | null;
  onChangeCode: (value: string) => void;
  onApply: () => void;
  onOpenWallet: () => void;
  onClearPromo: () => void;
  onFocusPromo: () => void;
};

export default function CheckoutPaymentCard({
  preview,
  days,
  dailyPrices,
  deliveryDistanceKm,
  security,
  promoCode,
  promoLoading,
  promoError,
  canApply,
  appliedPromo,
  onChangeCode,
  onApply,
  onOpenWallet,
  onClearPromo,
  onFocusPromo,
}: Props) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const [expanded, setExpanded] = useState(false);

  const applyDisabled = promoLoading || !canApply;
  const securityValue = security.required
    ? security.amount > 0
      ? formatMoney(security.amount)
      : "Theo thoả thuận"
    : "Miễn thế chấp";

  return (
    <View style={styles.card}>
      <CheckoutSectionHeader
        icon={ReceiptText}
        subtitle={days > 0 ? `${days} ngày · chưa gồm thế chấp` : "Chọn thời gian thuê để xem giá"}
        title="Thanh toán"
      />

      <View style={styles.promoBlock}>
        {appliedPromo ? (
          <View style={styles.applied}>
            <View style={styles.appliedIcon}>
              <CircleCheck color={p.mint} size={18} strokeWidth={2.2} />
            </View>
            <View style={styles.appliedBody}>
              <AppText style={styles.appliedCode} numberOfLines={1}>
                {appliedPromo.code}
              </AppText>
              <AppText style={styles.appliedText}>
                Giảm {formatMoney(appliedPromo.discountAmount)} cho đơn này
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="Bỏ mã giảm giá"
              hitSlop={8}
              onPress={onClearPromo}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <X color={p.mint} size={15} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.promoRow}>
            <View style={styles.promoInputWrap}>
              <TicketPercent color={p.faint} size={15} strokeWidth={2.1} />
              <TextInput
                accessibilityLabel="Mã khuyến mãi"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={onChangeCode}
                onFocus={onFocusPromo}
                placeholder="Mã ưu đãi"
                placeholderTextColor={p.faint}
                selectionColor={p.brand}
                style={styles.promoInput}
                value={promoCode}
              />
            </View>
            <Pressable
              accessibilityLabel="Mở ví voucher"
              onPress={onOpenWallet}
              style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}
            >
              <Wallet color={p.brand} size={14} strokeWidth={2.1} />
              <AppText style={styles.walletText}>Ví</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: applyDisabled, busy: promoLoading }}
              disabled={applyDisabled}
              onPress={onApply}
              style={({ pressed }) => [
                styles.apply,
                applyDisabled && styles.applyDisabled,
                pressed && !applyDisabled && styles.pressed,
              ]}
            >
              {promoLoading ? (
                <ActivityIndicator color={p.onBrand} size="small" />
              ) : (
                <AppText style={[styles.applyText, applyDisabled && { color: p.faint }]}>
                  Áp dụng
                </AppText>
              )}
            </Pressable>
          </View>
        )}

        {promoError ? (
          <View style={styles.errorRow}>
            <CircleAlert color={p.danger} size={14} strokeWidth={2.1} />
            <AppText style={styles.errorText}>{promoError}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      {preview ? (
        <>
          <View style={styles.rows}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              disabled={dailyPrices.length === 0}
              onPress={() => setExpanded((value) => !value)}
              style={({ pressed }) => [
                styles.row,
                pressed && dailyPrices.length > 0 && styles.pressed,
              ]}
            >
              <View style={styles.rowLabel}>
                <AppText style={styles.label}>Tiền thuê xe</AppText>
                {dailyPrices.length > 0 ? (
                  <ChevronDown
                    color={p.faint}
                    size={14}
                    strokeWidth={2.2}
                    style={expanded ? styles.chevronOpen : undefined}
                  />
                ) : null}
              </View>
              <AppText style={styles.value}>{formatMoney(preview.base)}</AppText>
            </Pressable>

            {expanded
              ? dailyPrices.map((day) => (
                  <View key={day.rentalDate} style={[styles.row, styles.dayRow]}>
                    <AppText style={styles.dayLabel}>{formatCheckoutDate(day.rentalDate)}</AppText>
                    <AppText style={styles.dayValue}>{formatMoney(day.finalDailyPrice)}</AppText>
                  </View>
                ))
              : null}

            {preview.discPct > 0 ? (
              <View style={styles.row}>
                <AppText style={styles.discountLabel}>Giảm giá thuê dài ({preview.discPct}%)</AppText>
                <AppText style={styles.discountValue}>-{formatMoney(preview.discAmt)}</AppText>
              </View>
            ) : null}

            {appliedPromo ? (
              <View style={styles.row}>
                <AppText style={styles.discountLabel} numberOfLines={1}>
                  Mã {appliedPromo.code}
                </AppText>
                <AppText style={styles.discountValue}>-{formatMoney(appliedPromo.discountAmount)}</AppText>
              </View>
            ) : null}

            {preview.deliveryFee > 0 ? (
              <View style={styles.row}>
                <AppText style={styles.label} numberOfLines={1}>
                  Phí giao xe{deliveryDistanceKm != null ? ` (${deliveryDistanceKm} km)` : ""}
                </AppText>
                <AppText style={styles.value}>+{formatMoney(preview.deliveryFee)}</AppText>
              </View>
            ) : null}

            <View style={styles.row}>
              <AppText style={styles.label} numberOfLines={1}>
                Phí nền tảng (đã bao gồm)
              </AppText>
              <AppText style={styles.valueMuted}>{formatMoney(preview.fee)}</AppText>
            </View>
          </View>

          <View style={styles.totalRow}>
            <View style={styles.totalBody}>
              <AppText style={styles.totalLabel}>Tổng cộng</AppText>
              <AppText style={styles.totalHint}>Đã trừ ưu đãi, chưa gồm thế chấp</AppText>
            </View>
            <AppText style={styles.totalValue}>{formatMoney(preview.total)}</AppText>
          </View>

          <View style={styles.schedule}>
            <AppText style={styles.scheduleTitle}>Thanh toán sau khi chủ xe duyệt</AppText>
            <View style={styles.scheduleRow}>
              <AppText style={styles.scheduleLabel}>Tiền cọc ({preview.depositPercent}%)</AppText>
              <AppText style={styles.scheduleValue}>{formatMoney(preview.deposit)}</AppText>
            </View>
            <View style={styles.scheduleRow}>
              <AppText style={styles.scheduleLabel}>Còn lại khi nhận xe</AppText>
              <AppText style={styles.scheduleValue}>{formatMoney(preview.remaining)}</AppText>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.missing}>
          <Clock3 color={p.faint} size={16} strokeWidth={2.1} />
          <AppText style={styles.missingText}>
            Chọn ngày nhận và trả xe để xem giá thuê, tiền cọc và tổng thanh toán.
          </AppText>
        </View>
      )}

      <View style={[styles.security, security.required ? styles.securityWarn : styles.securityMint]}>
        {security.required ? (
          <ShieldCheck color={p.warning} size={16} strokeWidth={2.1} />
        ) : (
          <CircleCheck color={p.mint} size={16} strokeWidth={2.1} />
        )}
        <View style={styles.securityBody}>
          <AppText style={styles.securityLabel}>
            {security.required ? "Thế chấp khi nhận xe" : "Không cần thế chấp"}
          </AppText>
          <AppText style={styles.securityHint}>
            {security.required ? "Hoàn lại khi trả xe đúng hiện trạng" : "Chủ xe không yêu cầu đặt cọc tài sản"}
          </AppText>
        </View>
        <AppText
          style={[styles.securityValue, { color: security.required ? p.warning : p.mint }]}
          numberOfLines={2}
        >
          {securityValue}
        </AppText>
      </View>

      {security.required && security.amount <= 0 ? (
        <View style={styles.noteRow}>
          <TriangleAlert color={p.warning} size={13} strokeWidth={2.1} />
          <AppText style={styles.noteText}>
            Số tiền thế chấp sẽ được chủ xe xác nhận trước khi bàn giao.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    card: {
      backgroundColor: p.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      padding: 16,
      gap: 13,
      shadowColor: p.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    promoBlock: { gap: 8 },
    promoRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    promoInputWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 42,
      paddingHorizontal: 11,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
    },
    promoInput: {
      flex: 1,
      minWidth: 0,
      padding: 0,
      color: p.ink,
      fontFamily: checkoutFont.semibold,
      fontSize: 12.5,
      letterSpacing: 0.4,
    },
    wallet: {
      height: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: p.brandBorder,
      backgroundColor: p.brandSoft,
    },
    walletText: { color: p.brand, fontFamily: checkoutFont.bold, fontSize: 11 },
    apply: {
      height: 42,
      minWidth: 74,
      paddingHorizontal: 12,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.brand,
    },
    applyDisabled: { backgroundColor: p.surfaceAlt },
    applyText: { color: p.onBrand, fontFamily: checkoutFont.bold, fontSize: 11.5 },
    applied: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.mintBorder,
      backgroundColor: p.mintSoft,
      padding: 11,
    },
    appliedIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
    },
    appliedBody: { flex: 1, minWidth: 0 },
    appliedCode: {
      color: p.mint,
      fontFamily: checkoutFont.extraBold,
      fontSize: 12.5,
      letterSpacing: 0.6,
    },
    appliedText: { color: p.muted, fontFamily: checkoutFont.medium, fontSize: 10.5, marginTop: 1 },
    clear: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
    },
    errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    errorText: {
      color: p.danger,
      fontFamily: checkoutFont.medium,
      fontSize: 10.5,
      lineHeight: 15,
      flex: 1,
    },
    divider: { height: 1, backgroundColor: p.line },
    missing: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    missingText: {
      color: p.muted,
      fontFamily: checkoutFont.regular,
      fontSize: 11,
      lineHeight: 16,
      flex: 1,
    },
    rows: { gap: 9 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    rowLabel: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    label: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 11.5 },
    value: {
      color: p.ink,
      fontFamily: checkoutFont.semibold,
      fontSize: 11.5,
      fontVariant: ["tabular-nums"],
    },
    valueMuted: {
      color: p.faint,
      fontFamily: checkoutFont.medium,
      fontSize: 11.5,
      fontVariant: ["tabular-nums"],
    },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    dayRow: { paddingLeft: 10 },
    dayLabel: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 10.5 },
    dayValue: {
      color: p.muted,
      fontFamily: checkoutFont.medium,
      fontSize: 10.5,
      fontVariant: ["tabular-nums"],
    },
    discountLabel: { color: p.mint, fontFamily: checkoutFont.medium, fontSize: 11.5, flexShrink: 1 },
    discountValue: {
      color: p.mint,
      fontFamily: checkoutFont.semibold,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: p.line,
      paddingTop: 12,
    },
    totalBody: { flex: 1, minWidth: 0 },
    totalLabel: { color: p.ink, fontFamily: checkoutFont.bold, fontSize: 12.5 },
    totalHint: { color: p.faint, fontFamily: checkoutFont.regular, fontSize: 9.5, marginTop: 1 },
    totalValue: {
      color: p.ink,
      fontFamily: checkoutFont.display,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    schedule: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.brandBorder,
      backgroundColor: p.brandSoft,
      padding: 12,
      gap: 7,
    },
    scheduleTitle: {
      color: p.brand,
      fontFamily: checkoutFont.bold,
      fontSize: 10,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    scheduleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    scheduleLabel: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 11, flexShrink: 1 },
    scheduleValue: {
      color: p.ink,
      fontFamily: checkoutFont.semibold,
      fontSize: 11.5,
      fontVariant: ["tabular-nums"],
    },
    security: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderRadius: 16,
      borderWidth: 1,
      padding: 11,
    },
    securityWarn: { borderColor: p.warningBorder, backgroundColor: p.warningSoft },
    securityMint: { borderColor: p.mintBorder, backgroundColor: p.mintSoft },
    securityBody: { flex: 1, minWidth: 0 },
    securityLabel: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 11.5 },
    securityHint: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 9.5, lineHeight: 13, marginTop: 1 },
    securityValue: {
      fontFamily: checkoutFont.bold,
      fontSize: 12,
      maxWidth: 116,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    noteText: { color: p.warning, fontFamily: checkoutFont.medium, fontSize: 10, lineHeight: 14, flex: 1 },
    pressed: { opacity: 0.7 },
  });
