import Text from "@/components/AppText";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { formatMoney } from "../bookingDisplay";
import { inspectionBalance } from "../bookingSettlement";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function InspectionFinancialSummary({ booking, report }: { booking: BookingResponse; report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const { rentalRemaining, pending, outstanding, surchargeRemaining } = inspectionBalance(booking, report);
  const rows = (values: [string, number | null][]) => values.map(([label, value]) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
    <Text style={{ color: theme.text, flex: 1 }}>{label}</Text><Text style={{ color: theme.text, fontWeight: "600" }}>{value == null ? "Chưa đối soát" : formatMoney(value)}</Text>
  </View>);
  const group = { padding: 12, gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 10 };
  return <View style={{ gap: 12 }}>
    <View accessibilityLabel="Tiền thuê và thanh toán booking" style={group}>
      <Text style={{ color: theme.text, fontWeight: "700" }}>Tiền thuê và thanh toán booking</Text>
      {rows([["Tổng tiền thuê và phí đặt xe", booking.totalAmount], ["Đã thanh toán qua hệ thống", booking.escrowAmount], ["Tiền thuê đối chiếu trực tiếp", rentalRemaining]])}
      <Text style={{ color: theme.muted, fontSize: 12 }}>Khoản tiền thuê này thanh toán riêng với chủ xe. Hệ thống chưa ghi nhận tiền trả trực tiếp; đối chiếu chứng từ để tránh thu trùng. Không tính vào phụ thu trả xe.</Text>
    </View>
    {report.type === "CheckOut" && <View accessibilityLabel="Phụ thu trả xe" style={group}>
      <Text style={{ color: theme.text, fontWeight: "700" }}>Phụ thu trả xe</Text>
      {report.initialOdometerKm != null && <Text style={{ color: theme.muted }}>Đồng hồ km: nhận {report.initialOdometerKm.toLocaleString("vi-VN")} → trả {report.odometerKm?.toLocaleString("vi-VN")} · Đã đi {report.travelledKm?.toLocaleString("vi-VN")} km</Text>}
      {report.includedKm != null && <Text style={{ color: theme.muted }}>Hạn mức {report.includedKm.toLocaleString("vi-VN")} km · Vượt {report.excessKm?.toLocaleString("vi-VN")} km</Text>}
      {rows([
        ["Phụ thu trả trễ", report.lateReturnFeeStatus === "MissingPolicy" ? null : report.lateReturnFee ?? 0], ["Phụ thu vượt km", report.excessMileageFee ?? 0],
        ...(report.additionalSurcharges ?? []).map(s => [`${s.name} (${s.quantity} × ${formatMoney(s.unitPrice)}) — ${s.note}`, s.amount] as [string, number]),
        ["Phụ thu đã thanh toán", report.paidSurchargeAmount ?? 0], ["Phụ thu đã xác nhận, chưa thanh toán", outstanding], ["Phụ thu chờ khách xác nhận", pending],
        [report.lateReturnFeeStatus === "MissingPolicy" ? "Tạm tính phụ thu còn lại (chưa gồm trả trễ)" : "Tổng phụ thu còn lại", surchargeRemaining],
      ])}
      {!!report.lateReturnFeeNote && <Text style={{ color: theme.muted }}>{report.lateReturnFeeNote}</Text>}
      {(report.externalPendingSurchargeAmount ?? 0) > 0 && <Text style={{ color: theme.text }}>Đã chọn trả trực tiếp: {formatMoney(report.externalPendingSurchargeAmount!)} — chờ chủ xe xác nhận nhận tiền, không trừ ví.</Text>}
      {(report.externalPaidSurchargeAmount ?? 0) > 0 && <Text style={{ color: theme.text }}>Chủ xe đã xác nhận nhận phụ thu trực tiếp: {formatMoney(report.externalPaidSurchargeAmount!)}.</Text>}
      <Text style={{ color: theme.muted, fontSize: 12 }}>Chỉ gồm phụ thu phát sinh khi trả xe. Phụ thu chờ xác nhận chưa được thu; không bao gồm tiền thuê hoặc tiền thế chấp.</Text>
    </View>}
  </View>;
}
