import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { mileagePreview } from "../bookingSettlement";
import { formatMoney } from "../bookingDisplay";
import type { BookingResponse } from "../types";

export default function MileageFeePreview({ booking, initialKm, finalKm }: { booking: BookingResponse; initialKm?: number; finalKm: string }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const value = mileagePreview(booking, initialKm, finalKm);
  if (!value) return <Text style={{ color: theme.muted }}>{t("booking:checkout.mileageNoTerm")}</Text>;
  if (!value.valid) return <Text style={{ color: theme.danger }}>{t("booking:checkout.mileageInvalid")}</Text>;
  return <View style={{ gap: 6, padding: 12, backgroundColor: theme.surfaceAlt, borderRadius: 10 }}>
    <Text style={{ color: theme.text }}>{t("booking:checkout.mileageOdometer", {
      start: initialKm?.toLocaleString("vi-VN") ?? "",
      end: Number(finalKm).toLocaleString("vi-VN"),
    })}</Text>
    <Text style={{ color: theme.text }}>{t("booking:checkout.mileageTravelled", {
      travelled: value.travelled,
      included: value.included,
      excess: value.excess,
    })}</Text>
    <Text style={{ color: theme.text, fontWeight: "700" }}>{t("booking:checkout.mileageFee", {
      fee: formatMoney(value.fee),
      unit: formatMoney(value.unitPrice),
    })}</Text>
    <Text style={{ color: theme.muted }}>{t("mobile:checkout.mileage.note")}</Text>
  </View>;
}
