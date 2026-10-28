import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { formatMoney, formatVietnamDateTime } from "../bookingDisplay";
import type { InspectionReportResponse } from "../types";
import { DetailRow } from "./detail/BookingDetailUI";

export { default as OutstandingSurcharge } from "./OutstandingSurchargePayment";

export default function CheckoutSummary({ report }: { report: InspectionReportResponse }) {
  const { theme } = useTheme();
  if (report.type !== "CheckOut") return null;
  const missingPolicy = report.lateReturnFeeStatus === "MissingPolicy";
  return <View style={{ gap: 9, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt }}>
    <Text style={{ color: theme.text, fontFamily: font.semibold, fontSize: 11.5 }}>Đối soát khi trả xe</Text>
    <DetailRow
      label="Giờ bàn giao"
      value={report.actualReturnAt ? formatVietnamDateTime(report.actualReturnAt) : "Biên bản cũ chưa ghi riêng"}
    />
    <DetailRow
      label="Phụ phí trả trễ"
      value={missingPolicy ? "Chưa đối soát" : formatMoney(report.lateReturnFee ?? 0)}
      tone={missingPolicy ? "danger" : "muted"}
    />
    {report.lateReturnFeeNote ? (
      <Text style={{ color: missingPolicy ? theme.danger : theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
        {report.lateReturnFeeNote}
      </Text>
    ) : null}
    <DetailRow label="Phụ phí vượt km" value={formatMoney(report.excessMileageFee ?? 0)} />
    {report.travelledKm != null ? (
      <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
        Đã đi {report.travelledKm.toLocaleString("vi-VN")} km · Hạn mức {(report.includedKm ?? 0).toLocaleString("vi-VN")} km · Vượt {(report.excessKm ?? 0).toLocaleString("vi-VN")} km
      </Text>
    ) : null}
    <Text style={{ color: theme.faint, fontFamily: font.regular, fontSize: 9.5 }}>Phiên bản {report.version ?? 1}</Text>
    {(report.revisions ?? []).map(r => {
      let s: { ActualReturnAt?: string; OdometerKm?: number; LateReturnFee?: number; ExcessMileageFee?: number; AdditionalSurcharges?: { TermId: number; Name: string; Amount: number; Note?: string }[] } = {};
      try { s = JSON.parse(r.snapshotJson ?? "{}"); } catch { /* Preserve revision metadata. */ }
      return <View key={r.version} style={{ padding: 10, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 3 }}>
        <Text style={{ color: theme.text, fontFamily: font.semibold, fontSize: 10.5 }}>Phiên bản {r.version} · {formatVietnamDateTime(r.createdAt)}</Text>
        <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>{r.reason}</Text>
        <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 14 }}>
          {s.ActualReturnAt ? formatVietnamDateTime(s.ActualReturnAt) : "—"} · Km: {s.OdometerKm ?? "—"} · Phí trả trễ: {formatMoney(s.LateReturnFee ?? 0)} · Phí vượt km: {formatMoney(s.ExcessMileageFee ?? 0)}
        </Text>
        {(s.AdditionalSurcharges ?? []).map(f => <Text key={f.TermId} style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10 }}>{f.Name}: {formatMoney(f.Amount)} · {f.Note}</Text>)}
      </View>;
    })}
  </View>;
}
