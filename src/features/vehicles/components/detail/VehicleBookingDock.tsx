import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { formatVnd } from "@/features/vehicles/ownerDisplay";
import { detailFont, useDetailTheme } from "./detailTheme";
import type { RentalPricing } from "./rentalPricing";

type Props = {
  days: number;
  dailyPrice: number | null;
  pricing: RentalPricing | null;
  quoteState: "idle" | "loading" | "ready" | "error";
  canBook: boolean;
  overlapping: boolean;
  availabilityLoading: boolean;
  availabilityReady: boolean;
  availabilityError: boolean;
  hasBookingHandler: boolean;
  bottomInset: number;
  onBook: () => void;
  onOpenPeriod: () => void;
  onRetryAvailability: () => void;
};

type Cta = {
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
};

export default function VehicleBookingDock({
  days,
  dailyPrice,
  pricing,
  quoteState,
  canBook,
  overlapping,
  availabilityLoading,
  availabilityReady,
  availabilityError,
  hasBookingHandler,
  bottomInset,
  onBook,
  onOpenPeriod,
  onRetryAvailability,
}: Props) {
  const { t } = useTranslation();
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  const hasDates = days > 0;
  const showTotal = Boolean(hasDates && pricing && quoteState === "ready");
  const blockedByCalendar = overlapping || availabilityError || (!availabilityReady && !availabilityLoading);

  let cta: Cta;
  if (!hasDates) {
    cta = {
      label: t("mobile:vehicleDetail.dock.selectDates"),
      onPress: onOpenPeriod,
      disabled: false,
      loading: false,
    };
  } else if (availabilityLoading || quoteState === "loading") {
    cta = {
      label: t("mobile:vehicleDetail.dock.checking"),
      onPress: onOpenPeriod,
      disabled: true,
      loading: true,
    };
  } else if (blockedByCalendar) {
    cta = {
      label: availabilityError
        ? t("mobile:vehicleDetail.dock.recheckCalendar")
        : t("mobile:vehicleDetail.dock.changeDates"),
      onPress: availabilityError ? onRetryAvailability : onOpenPeriod,
      disabled: false,
      loading: false,
    };
  } else if (quoteState === "error") {
    cta = {
      label: t("mobile:vehicleDetail.dock.changeDates"),
      onPress: onOpenPeriod,
      disabled: false,
      loading: false,
    };
  } else if (!hasBookingHandler) {
    cta = {
      label: t("mobile:vehicleDetail.dock.selectDates"),
      onPress: onOpenPeriod,
      disabled: false,
      loading: false,
    };
  } else {
    cta = {
      label: t("mobile:vehicleDetail.dock.bookNow"),
      onPress: onBook,
      disabled: !canBook,
      loading: false,
    };
  }

  const headline = showTotal && pricing
    ? `${pricing.payable.toLocaleString("vi-VN")}đ`
    : quoteState === "loading" && hasDates
      ? t("mobile:vehicleDetail.dock.calculating")
      : formatVnd(dailyPrice);

  const unit = showTotal
    ? t("mobile:vehicleDetail.dock.totalDays", { days })
    : t("mobile:vehicleDetail.unit.perDay");
  const savings =
    showTotal && pricing && pricing.discountAmount > 0
      ? t("mobile:vehicleDetail.dock.savings", {
          amount: pricing.discountAmount.toLocaleString("vi-VN"),
          percent: pricing.discountPercent,
        })
      : null;
  const hint = overlapping
    ? t("mobile:vehicleDetail.dock.busyHint")
    : availabilityError
      ? t("mobile:vehicleDetail.dock.availabilityErrorHint")
      : showTotal
        ? t("mobile:vehicleDetail.dock.totalHint")
        : hasDates
          ? t("mobile:vehicleDetail.dock.selectDatesHint")
          : t("mobile:vehicleDetail.dock.pickDatesHint");

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <View style={styles.summary}>
        <AppText style={styles.headline} numberOfLines={1}>
          {headline}
          {showTotal || (!hasDates && dailyPrice != null) ? (
            <AppText style={styles.unit}> {unit}</AppText>
          ) : null}
        </AppText>
        <AppText
          style={[styles.hint, savings ? { color: p.mint } : overlapping && { color: p.danger }]}
          numberOfLines={1}
        >
          {savings ?? hint}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cta.label}
        accessibilityState={{ disabled: cta.disabled, busy: cta.loading }}
        disabled={cta.disabled}
        onPress={cta.onPress}
        style={({ pressed }) => [styles.ctaWrap, pressed && !cta.disabled && styles.pressed]}
      >
        <LinearGradient
          colors={cta.disabled ? [p.surfaceAlt, p.surfaceAlt] : p.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          {cta.loading ? (
            <ActivityIndicator color={p.onBrand} size="small" />
          ) : (
            <>
              <AppText style={[styles.ctaText, cta.disabled && { color: p.muted }]}>{cta.label}</AppText>
              <ChevronRight color={cta.disabled ? p.muted : p.onBrand} size={17} strokeWidth={2.4} />
            </>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    dock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 12,
      paddingHorizontal: 16,
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.line,
      shadowColor: p.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
    summary: { flex: 1, minWidth: 0 },
    headline: {
      color: p.ink,
      fontFamily: detailFont.display,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    unit: { color: p.muted, fontFamily: detailFont.medium, fontSize: 11 },
    hint: { color: p.faint, fontFamily: detailFont.regular, fontSize: 10, marginTop: 2 },
    ctaWrap: { flexShrink: 0, borderRadius: 16 },
    cta: {
      minWidth: 168,
      minHeight: 50,
      borderRadius: 16,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    ctaText: { color: p.onBrand, fontFamily: detailFont.bold, fontSize: 13, letterSpacing: -0.1 },
    pressed: { opacity: 0.86 },
  });
