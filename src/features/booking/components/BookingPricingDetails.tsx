import BookingDisclosure from "./BookingDisclosure";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import type { BookingResponse } from "../types";
import { formatMoney } from "../utils/format";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";

function formatRentalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default function BookingPricingDetails({ booking }: { booking: BookingResponse }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = StyleSheet.create({
    title: { color: theme.text, fontFamily: font.display, fontSize: 15 },
    intro: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 },
    day: { borderTopWidth: 1, borderColor: theme.divider, paddingTop: 9, gap: 3 },
    dayTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    label: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, flexShrink: 1 },
    price: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, fontVariant: ["tabular-nums"] },
    muted: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 },
    term: { borderTopWidth: 1, borderColor: theme.divider, paddingTop: 9, gap: 3 },
  });
  const days = booking.pricingDetails ?? [];
  const terms = booking.surchargeTerms ?? [];

  return <>
    {days.length > 0 ? (
      <BookingDisclosure title={t("mobile:trip.pricing.rentalByDayTitle")}>
        {days.map((day) => (
          <View key={day.rentalDate} style={styles.day}>
            <View style={styles.dayTop}>
              <Text style={styles.label}>{formatRentalDate(day.rentalDate)}</Text>
              <Text style={styles.price}>{formatMoney(day.finalDailyPrice)}</Text>
            </View>
            {day.appliedRuleNames.length > 0 ? <Text style={styles.muted}>{day.appliedRuleNames.join(", ")}</Text> : null}
          </View>
        ))}
      </BookingDisclosure>
    ) : null}

    <BookingDisclosure title={t("booking:detail.surchargeTermsTitle")}>
      <Text style={styles.intro}>{t("mobile:trip.pricing.termsIntro")}</Text>
      {terms.length === 0 ? <Text style={styles.muted}>{t("mobile:trip.pricing.noTerms")}</Text> : terms.map((term) => (
        <View key={term.id} style={styles.term}>
          <View style={styles.dayTop}>
            <Text style={styles.label}>{term.name}</Text>
            <Text style={styles.price}>{formatMoney(term.unitPrice)}</Text>
          </View>
          <Text style={styles.muted}>
            {term.calculationMethod === "Fixed" ? t("booking:detail.calcFixed") : term.calculationMethod === "PerKm" ? t("booking:detail.calcPerKm") : t("booking:detail.calcPerHour")}
            {term.includedKm != null ? t("mobile:trip.pricing.allowance", {
              km: term.includedKm,
              scope: term.allowanceScope === "PerDay"
                ? t("mobile:trip.pricing.allowancePerDay")
                : term.allowanceScope === "PerBooking"
                  ? t("mobile:trip.pricing.allowancePerBooking")
                  : "",
            }) : ""}
            {term.maxAmount != null ? t("mobile:trip.pricing.max", { amount: formatMoney(term.maxAmount) }) : ""}
          </Text>
          {term.description ? <Text style={styles.muted}>{term.description}</Text> : null}
        </View>
      ))}
    </BookingDisclosure>
  </>;
}
