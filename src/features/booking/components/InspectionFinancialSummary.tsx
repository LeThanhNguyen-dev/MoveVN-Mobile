import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { formatMoney } from "../bookingDisplay";
import { inspectionBalance } from "../bookingSettlement";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { DetailRow } from "./detail/BookingDetailUI";

export default function InspectionFinancialSummary({ booking, report }: { booking: BookingResponse; report: InspectionReportResponse }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { rentalRemaining, pending, outstanding, surchargeRemaining } = inspectionBalance(booking, report);
  const rows = (values: [string, number | null][]) => values.map(([label, value]) => (
    <DetailRow key={label} label={label} value={value == null ? t("booking:inspection.summary.notReconciled") : formatMoney(value)} />
  ));
  const group = { padding: 12, gap: 9, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surfaceAlt };
  const groupTitle = { color: theme.text, fontFamily: font.semibold, fontSize: 11.5 };
  const note = { color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 };
  return <View style={{ gap: 10 }}>
    <View accessibilityLabel={t("booking:inspection.summary.rentalSectionAria")} style={group}>
      <Text style={groupTitle}>{t("booking:inspection.summary.rentalSectionTitle")}</Text>
      {rows([[t("booking:inspection.summary.rentalTotal"), booking.totalAmount], [t("booking:inspection.summary.paidViaSystem"), booking.escrowAmount], [t("booking:inspection.summary.remainingDirect"), rentalRemaining]])}
      <Text style={note}>{t("mobile:inspection.financial.rentalNote")}</Text>
    </View>
    {report.type === "CheckOut" && <View accessibilityLabel={t("booking:inspection.summary.surchargeSectionAria")} style={group}>
      <Text style={groupTitle}>{t("booking:inspection.summary.surchargeSectionTitle")}</Text>
      {report.initialOdometerKm != null && <Text style={note}>{t("mobile:inspection.financial.odometerLine", { start: report.initialOdometerKm.toLocaleString("vi-VN"), end: report.odometerKm?.toLocaleString("vi-VN"), travelled: report.travelledKm?.toLocaleString("vi-VN") })}</Text>}
      {report.includedKm != null && <Text style={note}>{t("booking:inspection.summary.included", { included: report.includedKm.toLocaleString("vi-VN"), excess: report.excessKm?.toLocaleString("vi-VN") })}</Text>}
      {rows([
        [t("booking:inspection.summary.lateFee"), report.lateReturnFeeStatus === "MissingPolicy" ? null : report.lateReturnFee ?? 0], [t("booking:inspection.summary.excessFee"), report.excessMileageFee ?? 0],
        ...(report.additionalSurcharges ?? []).map(s => [t("booking:inspection.summary.surchargeRow", { name: s.name, quantity: s.quantity, unitPrice: formatMoney(s.unitPrice), note: s.note }), s.amount] as [string, number]),
        [t("booking:inspection.summary.paidSurcharge"), report.paidSurchargeAmount ?? 0], [t("booking:inspection.summary.confirmedUnpaid"), outstanding], [t("booking:inspection.summary.awaitingConfirm"), pending],
        [report.lateReturnFeeStatus === "MissingPolicy" ? t("booking:inspection.summary.remainingEstimated") : t("booking:inspection.summary.remainingTotal"), surchargeRemaining],
      ])}
      {!!report.lateReturnFeeNote && <Text style={note}>{report.lateReturnFeeNote}</Text>}
      {(report.externalPendingSurchargeAmount ?? 0) > 0 && <Text style={{ color: theme.text, fontFamily: font.medium, fontSize: 10.5, lineHeight: 15 }}>{t("mobile:inspection.financial.externalPending", { amount: formatMoney(report.externalPendingSurchargeAmount!) })}</Text>}
      {(report.externalPaidSurchargeAmount ?? 0) > 0 && <Text style={{ color: theme.text, fontFamily: font.medium, fontSize: 10.5, lineHeight: 15 }}>{t("mobile:inspection.financial.externalPaid", { amount: formatMoney(report.externalPaidSurchargeAmount!) })}</Text>}
      <Text style={note}>{t("mobile:inspection.financial.surchargeNote")}</Text>
    </View>}
  </View>;
}
