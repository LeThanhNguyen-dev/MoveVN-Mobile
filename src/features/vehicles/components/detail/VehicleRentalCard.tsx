import {
  ArrowLeftRight,
  CalendarRange,
  ChevronDown,
  Info,
  KeyRound,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { PricingQuoteResponse } from "@/features/vehicles/types";
import { formatVnd } from "@/features/vehicles/ownerDisplay";
import DetailSectionHeader from "./DetailSectionHeader";
import { detailFont, useDetailTheme } from "./detailTheme";
import {
  formatDateMeta,
  formatDateShort,
  type RentalPricing,
} from "./rentalPricing";

type Props = {
  startDate: string;
  endDate: string;
  days: number;
  quote: PricingQuoteResponse | null;
  quoteState: "idle" | "loading" | "ready" | "error";
  pricing: RentalPricing | null;
  onOpenPeriod: () => void;
  onRetryQuote: () => void;
};

export default function VehicleRentalCard({
  startDate,
  endDate,
  days,
  quote,
  quoteState,
  pricing,
  onOpenPeriod,
  onRetryQuote,
}: Props) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const [showDaily, setShowDaily] = useState(false);

  useEffect(() => {
    setShowDaily(false);
  }, [startDate, endDate]);

  const hasDates = days > 0;
  const hasDiscount = Boolean(pricing && pricing.discountPercent > 0 && pricing.discountAmount > 0);

  return (
    <View style={styles.card}>
      <DetailSectionHeader
        actionLabel="Đổi ngày"
        icon={CalendarRange}
        onAction={onOpenPeriod}
        title="Lịch & giá thuê"
      />

      <View style={styles.dateGrid}>
        <Pressable
          accessibilityLabel="Chọn ngày nhận xe"
          accessibilityRole="button"
          onPress={onOpenPeriod}
          style={({ pressed }) => [styles.dateBox, pressed && styles.pressed]}
        >
          <View style={styles.dateLabelRow}>
            <KeyRound color={p.faint} size={11} strokeWidth={2.1} />
            <AppText style={styles.dateLabel}>Nhận xe</AppText>
          </View>
          <AppText style={styles.dateValue} numberOfLines={1}>
            {formatDateShort(startDate)}
          </AppText>
          <AppText style={styles.dateMeta} numberOfLines={1}>
            {formatDateMeta(startDate)}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityLabel="Chọn ngày trả xe"
          accessibilityRole="button"
          onPress={onOpenPeriod}
          style={({ pressed }) => [styles.dateBox, pressed && styles.pressed]}
        >
          <View style={styles.dateLabelRow}>
            <KeyRound color={p.faint} size={11} strokeWidth={2.1} />
            <AppText style={styles.dateLabel}>Trả xe</AppText>
          </View>
          <AppText style={styles.dateValue} numberOfLines={1}>
            {formatDateShort(endDate)}
          </AppText>
          <AppText style={styles.dateMeta} numberOfLines={1}>
            {formatDateMeta(endDate)}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityLabel="Đổi ngày nhận và trả xe"
          accessibilityRole="button"
          hitSlop={6}
          onPress={onOpenPeriod}
          style={({ pressed }) => [styles.swap, pressed && styles.pressed]}
        >
          <ArrowLeftRight color={p.brand} size={13} strokeWidth={2.2} />
        </Pressable>
      </View>

      {!hasDates ? (
        <View style={styles.hintRow}>
          <Info color={p.faint} size={12} strokeWidth={2} />
          <AppText style={styles.hint}>Chọn ngày nhận và trả xe để xem giá chính xác.</AppText>
        </View>
      ) : quoteState === "loading" ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={p.brand} size="small" />
          <AppText style={styles.hint}>Đang tính giá theo từng ngày…</AppText>
        </View>
      ) : quoteState === "error" ? (
        <View style={styles.errorRow}>
          <AppText style={styles.hint}>Chưa lấy được báo giá cho khoảng ngày này.</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thử lại báo giá"
            hitSlop={8}
            onPress={onRetryQuote}
          >
            <AppText style={styles.retry}>Thử lại</AppText>
          </Pressable>
        </View>
      ) : pricing && quote ? (
        <>
          <View style={styles.priceLines}>
            <View style={styles.line}>
              <AppText style={styles.lineLabel}>Tiền thuê ({pricing.days} ngày)</AppText>
              <AppText style={styles.lineValue}>{formatVnd(pricing.base)}</AppText>
            </View>
            {hasDiscount ? (
              <View style={styles.line}>
                <AppText style={styles.lineLabel}>
                  Giảm thuê dài ngày ({pricing.discountPercent}%)
                </AppText>
                <AppText style={[styles.lineValue, { color: p.mint }]}>
                  −{formatVnd(pricing.discountAmount)}
                </AppText>
              </View>
            ) : null}
            <View style={[styles.line, styles.totalLine]}>
              <AppText style={styles.totalLabel}>Tạm tính</AppText>
              <AppText style={styles.totalValue}>{formatVnd(pricing.payable)}</AppText>
            </View>
          </View>

          {quote.dailyPrices.length > 0 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showDaily }}
                onPress={() => setShowDaily((value) => !value)}
                style={({ pressed }) => [styles.detailLink, pressed && styles.pressed]}
              >
                <AppText style={styles.detailLinkText}>
                  {showDaily ? "Thu gọn chi tiết giá" : "Xem chi tiết giá theo ngày"}
                </AppText>
                <ChevronDown
                  color={p.brand}
                  size={14}
                  strokeWidth={2.2}
                  style={showDaily ? styles.chevronOpen : undefined}
                />
              </Pressable>
              {showDaily ? (
                <View style={styles.dailyList}>
                  {quote.dailyPrices.map((day) => (
                    <View key={day.rentalDate} style={styles.dailyRow}>
                      <AppText style={styles.dailyDate}>{formatDateShort(day.rentalDate)}</AppText>
                      <AppText style={styles.dailyPrice}>{formatVnd(day.finalDailyPrice)}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <View style={styles.footnote}>
        <Info color={p.faint} size={11} strokeWidth={2} />
        <AppText style={styles.footnoteText}>
          Chưa gồm phí giao xe và phụ phí phát sinh
        </AppText>
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      marginHorizontal: 14,
      backgroundColor: p.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      padding: 16,
      shadowColor: p.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 1,
    },
    dateGrid: { position: "relative", flexDirection: "row", gap: 8, marginTop: 13 },
    dateBox: {
      flex: 1,
      minHeight: 70,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
    },
    dateLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    dateLabel: {
      color: p.faint,
      fontFamily: detailFont.bold,
      fontSize: 8.5,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    dateValue: {
      color: p.ink,
      fontFamily: detailFont.bold,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: -0.2,
      fontVariant: ["tabular-nums"],
    },
    dateMeta: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10, marginTop: 2 },
    swap: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -14,
      marginLeft: -14,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
      shadowColor: p.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    priceLines: { marginTop: 12, gap: 7 },
    line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    lineLabel: { color: p.muted, fontFamily: detailFont.regular, fontSize: 11.5, flexShrink: 1 },
    lineValue: {
      color: p.ink,
      fontFamily: detailFont.semibold,
      fontSize: 11.5,
      fontVariant: ["tabular-nums"],
    },
    totalLine: { borderTopWidth: 1, borderTopColor: p.line, paddingTop: 9, marginTop: 2 },
    totalLabel: { color: p.ink, fontFamily: detailFont.semibold, fontSize: 11.5 },
    totalValue: {
      color: p.brand,
      fontFamily: detailFont.display,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    detailLink: {
      minHeight: 36,
      marginTop: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: p.brandBorder,
      backgroundColor: p.brandSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    detailLinkText: { color: p.brand, fontFamily: detailFont.bold, fontSize: 11 },
    chevronOpen: { transform: [{ rotate: "180deg" }] },
    dailyList: { marginTop: 8, gap: 6, paddingHorizontal: 2 },
    dailyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    dailyDate: { color: p.muted, fontFamily: detailFont.regular, fontSize: 11 },
    dailyPrice: {
      color: p.ink,
      fontFamily: detailFont.semibold,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 11 },
    hint: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10.5, lineHeight: 15, flexShrink: 1 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    errorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
    retry: { color: p.brand, fontFamily: detailFont.bold, fontSize: 11 },
    footnote: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    footnoteText: { color: p.faint, fontFamily: detailFont.regular, fontSize: 9.5, flexShrink: 1 },
    pressed: { opacity: 0.7 },
  });
