import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { formatMoney, formatVietnamDateTime } from "../bookingDisplay";
import type { InspectionReportResponse } from "../types";
import { DetailRow } from "./detail/BookingDetailUI";

export { default as OutstandingSurcharge } from "./OutstandingSurchargePayment";

export default function CheckoutSummary({ report }: { report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  if (report.type !== "CheckOut") return null;
  const missingPolicy = report.lateReturnFeeStatus === "MissingPolicy";
  return <View style={{ gap: 9, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt }}>
    <Text style={{ color: theme.text, fontFamily: font.semibold, fontSize: 11.5 }}>{t("mobile:checkout.summary.title")}</Text>
    <DetailRow
      label={t("mobile:checkout.summary.handoverTime")}
      value={report.actualReturnAt ? formatVietnamDateTime(report.actualReturnAt) : t("booking:inspection.legacyReportNoTime")}
    />
    <DetailRow
      label={t("mobile:checkout.summary.lateFee")}
      value={missingPolicy ? t("booking:inspection.summary.notReconciled") : formatMoney(report.lateReturnFee ?? 0)}
      tone={missingPolicy ? "danger" : "muted"}
    />
    {report.lateReturnFeeNote ? (
      <Text style={{ color: missingPolicy ? theme.danger : theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
        {report.lateReturnFeeNote}
      </Text>
    ) : null}
    <DetailRow label={t("mobile:checkout.summary.excessFee")} value={formatMoney(report.excessMileageFee ?? 0)} />
    {report.travelledKm != null ? (
      <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
        {t("mobile:checkout.summary.travelled", {
          km: report.travelledKm.toLocaleString("vi-VN"),
          included: (report.includedKm ?? 0).toLocaleString("vi-VN"),
          excess: (report.excessKm ?? 0).toLocaleString("vi-VN"),
        })}
      </Text>
    ) : null}
    <Text style={{ color: theme.faint, fontFamily: font.regular, fontSize: 9.5 }}>{t("booking:detail.reportVersion", { version: report.version ?? 1 })}</Text>
    {(report.revisions ?? []).map(r => {
      let s: { ActualReturnAt?: string; OdometerKm?: number; LateReturnFee?: number; ExcessMileageFee?: number; AdditionalSurcharges?: { TermId: number; Name: string; Amount: number; Note?: string }[] } = {};
      try { s = JSON.parse(r.snapshotJson ?? "{}"); } catch { /* Preserve revision metadata. */ }
      return <View key={r.version} style={{ padding: 10, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 3 }}>
        <Text style={{ color: theme.text, fontFamily: font.semibold, fontSize: 10.5 }}>{t("booking:detail.reportVersion", { version: r.version })} · {formatVietnamDateTime(r.createdAt)}</Text>
        <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>{r.reason}</Text>
        <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
          {t("mobile:checkout.summary.revisionLine", {
            time: s.ActualReturnAt ? formatVietnamDateTime(s.ActualReturnAt) : "—",
            km: s.OdometerKm ?? "—",
            lateFee: formatMoney(s.LateReturnFee ?? 0),
            excessFee: formatMoney(s.ExcessMileageFee ?? 0),
          })}
        </Text>
        {(s.AdditionalSurcharges ?? []).map(f => <Text key={f.TermId} style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10 }}>{f.Name}: {formatMoney(f.Amount)} · {f.Note}</Text>)}
      </View>;
    })}
  </View>;
}
