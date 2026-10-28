import Text from "@/components/AppText";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { formatMoney, formatVietnamDateTime } from "../bookingDisplay";
import type { BookingResponse, InspectionReportResponse } from "../types";

export { default as OutstandingSurcharge } from "./OutstandingSurchargePayment";

export default function CheckoutSummary({ report }: { report: InspectionReportResponse }) {
  const { theme } = useTheme();
  if (report.type !== "CheckOut") return null;
  return <View style={{ gap: 6 }}>
    <Text style={{ color: theme.text }}>Giờ bàn giao: {report.actualReturnAt ? formatVietnamDateTime(report.actualReturnAt) : "Biên bản cũ chưa ghi riêng"}</Text>
    <Text style={{ color: theme.text }}>Phụ phí trả trễ: {report.lateReturnFeeStatus === "MissingPolicy" ? "Chưa đối soát" : formatMoney(report.lateReturnFee ?? 0)} · Phiên bản {report.version ?? 1}</Text>
    {report.lateReturnFeeNote ? <Text style={{ color: report.lateReturnFeeStatus === "MissingPolicy" ? theme.danger : theme.muted }}>{report.lateReturnFeeNote}</Text> : null}
    <Text style={{ color: theme.text }}>Phụ phí vượt km: {formatMoney(report.excessMileageFee ?? 0)}</Text>
    {report.travelledKm != null ? <Text style={{ color: theme.text }}>Đã đi: {report.travelledKm} km · Hạn mức: {report.includedKm} km · Vượt: {report.excessKm} km</Text> : null}
    {(report.revisions ?? []).map(r => {
      let s: { ActualReturnAt?: string; OdometerKm?: number; LateReturnFee?: number; ExcessMileageFee?: number; AdditionalSurcharges?: { TermId: number; Name: string; Amount: number; Note?: string }[] } = {};
      try { s = JSON.parse(r.snapshotJson ?? "{}"); } catch { /* Preserve revision metadata. */ }
      return <View key={r.version} style={{ padding: 8, backgroundColor: theme.surfaceAlt }}>
        <Text style={{ color: theme.text }}>Phiên bản {r.version} · {formatVietnamDateTime(r.createdAt)} · {r.reason}</Text>
        <Text style={{ color: theme.muted }}>{s.ActualReturnAt ? formatVietnamDateTime(s.ActualReturnAt) : "—"} · Km: {s.OdometerKm ?? "—"} · Phí trả trễ: {formatMoney(s.LateReturnFee ?? 0)} · Phí vượt km: {formatMoney(s.ExcessMileageFee ?? 0)}</Text>
        {(s.AdditionalSurcharges ?? []).map(f => <Text key={f.TermId} style={{ color: theme.muted }}>{f.Name}: {formatMoney(f.Amount)} · {f.Note}</Text>)}
      </View>;
    })}
  </View>;
}
