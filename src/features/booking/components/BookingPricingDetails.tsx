import BookingDisclosure from "./BookingDisclosure";
import { StyleSheet, Text, View } from "react-native";
import type { BookingResponse } from "../types";
import { formatMoney } from "../utils/format";
import { useTheme } from "@/theme/useTheme";

function formatRentalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default function BookingPricingDetails({ booking }: { booking: BookingResponse }) {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    card: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, padding: 14, gap: 10 },
    title: { color: theme.text, fontSize: 15, fontWeight: "800" },
    intro: { color: theme.muted, fontSize: 12, lineHeight: 18 },
    day: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingTop: 9, gap: 3 },
    dayTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    price: { color: theme.text, fontSize: 13, fontWeight: "700" },
    muted: { color: theme.muted, fontSize: 12 },
    term: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingTop: 9, gap: 3 },
  });
  const days = booking.pricingDetails ?? [];
  const terms = booking.surchargeTerms ?? [];

  return <>
    {days.length > 0 ? (
      <BookingDisclosure title="Giá thuê theo từng ngày">
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

    <BookingDisclosure title="Quy định phí phụ thu">
      <Text style={styles.intro}>Mức phí được chốt tại thời điểm đặt xe. Phí phát sinh thực tế sẽ được đối chiếu với quy định này.</Text>
      {terms.length === 0 ? <Text style={styles.muted}>Không có quy định phí phụ thu cho booking này.</Text> : terms.map((term) => (
        <View key={term.id} style={styles.term}>
          <View style={styles.dayTop}>
            <Text style={styles.label}>{term.name}</Text>
            <Text style={styles.price}>{formatMoney(term.unitPrice)}</Text>
          </View>
          <Text style={styles.muted}>
            {term.calculationMethod === "Fixed" ? "Cố định" : term.calculationMethod === "PerKm" ? "Theo km" : "Theo giờ"}
            {term.includedKm != null ? ` · Định mức ${term.includedKm} km${term.allowanceScope === "PerDay" ? "/ngày" : term.allowanceScope === "PerBooking" ? "/booking" : ""}` : ""}
            {term.maxAmount != null ? ` · Tối đa ${formatMoney(term.maxAmount)}` : ""}
          </Text>
          {term.description ? <Text style={styles.muted}>{term.description}</Text> : null}
        </View>
      ))}
    </BookingDisclosure>
  </>;
}
