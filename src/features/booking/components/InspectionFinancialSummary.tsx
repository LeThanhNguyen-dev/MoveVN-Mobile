import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { formatMoney } from "../bookingDisplay";
import { inspectionBalance } from "../bookingSettlement";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function InspectionFinancialSummary({ booking, report }: { booking: BookingResponse; report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const { rentalRemaining, pending, outstanding, totalRemaining } = inspectionBalance(booking, report);
  const rows: [string, number][] = [
    ["Tổng tiền thuê và phí đặt xe", booking.totalAmount], ["Đã thanh toán qua hệ thống", booking.escrowAmount],
    ["Tiền thuê còn thanh toán trực tiếp (*)", rentalRemaining],
  ];
  if (report.type === "CheckOut") rows.push(
    ["Phụ phí trả trễ", report.lateReturnFee ?? 0], ["Phụ phí vượt km", report.excessMileageFee ?? 0],
    ...(report.additionalSurcharges ?? []).map(s => [`${s.name} (${s.quantity} × ${formatMoney(s.unitPrice)}) — ${s.note}`, s.amount] as [string, number]),
    ["Phụ phí đã thu", report.paidSurchargeAmount ?? 0], ["Phụ phí chưa thanh toán", outstanding],
    ["Phụ phí chờ xác nhận", pending], [report.lateReturnFeeStatus === "MissingPolicy" ? "Tạm tính, chưa gồm phí trả trễ (*)" : "Còn thanh toán theo dữ liệu hệ thống (*)", totalRemaining],
  );
  return <View style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 10 }}>
    <Text style={{ color: theme.text, fontWeight: "700" }}>Đối chiếu thanh toán</Text>
    {report.type === "CheckOut" && report.initialOdometerKm != null ? <Text style={{ color: theme.text }}>Đối chiếu công-tơ-mét: nhận {report.initialOdometerKm.toLocaleString("vi-VN")} km → trả {report.odometerKm?.toLocaleString("vi-VN")} km · Đã đi {report.travelledKm?.toLocaleString("vi-VN")} km</Text> : null}
    {(report.externalPendingSurchargeAmount ?? 0) > 0 ? <Text style={{ color: theme.text }}>Đã chọn trả trực tiếp: {formatMoney(report.externalPendingSurchargeAmount!)} — chờ chủ xe xác nhận đã nhận tiền, không trừ ví.</Text> : null}
    {(report.externalPaidSurchargeAmount ?? 0) > 0 ? <Text style={{ color: theme.text }}>Đã thanh toán trực tiếp, chủ xe xác nhận: {formatMoney(report.externalPaidSurchargeAmount!)}.</Text> : null}
    {rows.map(([label, value]) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
      <Text style={{ color: theme.text, flex: 1 }}>{label}</Text><Text style={{ color: theme.text, fontWeight: "600" }}>{label === "Phụ phí trả trễ" && report.lateReturnFeeStatus === "MissingPolicy" ? "Chưa đối soát" : formatMoney(value)}</Text>
    </View>)}
    <Text style={{ color: theme.muted, fontSize: 12 }}>(*) Chưa trừ khoản thanh toán trực tiếp vì hệ thống chưa ghi nhận. Hai bên đối chiếu chứng từ để tránh thu trùng. Phụ phí chờ xác nhận chưa được thu.</Text>
  </View>;
}
