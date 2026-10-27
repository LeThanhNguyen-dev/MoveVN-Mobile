import Text from "@/components/AppText";
import { useEffect, useState } from "react";
import InspectionFinancialSummary from "./InspectionFinancialSummary";
import { Modal, ScrollView, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { CHECKOUT_CONSENT } from "../checkoutRules";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingButton } from "./BookingControls";
import CheckoutSummary from "./CheckoutSummary";

export default function CheckoutConfirmation({ booking, report, busy, onClose, onConfirm }: {
  booking: BookingResponse | null; report: InspectionReportResponse | null; busy: boolean; onClose: () => void; onConfirm: (report: InspectionReportResponse, paymentMethod: "Wallet" | "External") => void;
}) {
  const { theme } = useTheme();
  const hasSurcharges = (report?.pendingSurchargeAmount ?? ((report?.lateReturnFee ?? 0) + (report?.excessMileageFee ?? 0) + (report?.additionalSurcharges ?? []).reduce((sum, fee) => sum + fee.amount, 0))) > 0;
  const [returned, setReturned] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Wallet" | "External" | null>(null);
  useEffect(() => { setPaymentMethod(null); setReturned(false); }, [report?.id, report?.version]);
  return <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
      <View accessibilityRole="alert" style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 12, maxHeight: "90%" }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>{returned ? "Bước 2 · Thanh toán phụ thu" : "Bước 1 · Xác nhận bàn giao xe"}</Text>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {report ? <CheckoutSummary report={report} /> : null}
          {booking && report ? <InspectionFinancialSummary booking={booking} report={report} /> : null}
          <Text style={{ color: theme.text, lineHeight: 22 }}>{CHECKOUT_CONSENT}</Text>
          {returned ? <>
          <Text style={{ color: theme.text, fontWeight: "700" }}>Thanh toán phụ thu</Text>
          <BookingButton secondary title={`${paymentMethod === "Wallet" ? "✓ " : ""}Qua ví MoveVN trên web/app`} disabled={busy} onPress={() => setPaymentMethod("Wallet")} />
          <BookingButton secondary title={`${paymentMethod === "External" ? "✓ " : ""}Trả trực tiếp cho chủ xe`} disabled={busy} onPress={() => setPaymentMethod("External")} />
          <Text style={{ color: theme.muted }}>{!paymentMethod ? "Chọn cách thanh toán phụ thu trước khi xác nhận. Chưa chọn thì chưa thu tiền." : paymentMethod === "Wallet" ? "Thu từ ví sau khi đồng ý; thiếu tiền thì nạp thêm và thanh toán phần còn lại." : "Không trừ ví. Chờ chủ xe xác nhận đã nhận đủ tiền mặt/chuyển khoản riêng."}</Text>
          </> : <Text style={{ color: theme.muted }}>Chỉ tiếp tục sau khi bạn đã bàn giao xe và kiểm tra biên bản. Chưa thu tiền ở bước này.</Text>}
        </ScrollView>
        <BookingButton secondary title="Xem lại biên bản" disabled={busy} onPress={onClose} />
        {returned ? <BookingButton title="Đồng ý và xác nhận trả xe" busy={busy} disabled={!paymentMethod} onPress={() => { if (report && paymentMethod && !busy) onConfirm(report, paymentMethod); }} />
          : <BookingButton title={hasSurcharges ? "Tôi đã bàn giao xe · Tiếp tục" : "Tôi đã bàn giao xe · Xác nhận"} disabled={busy} onPress={() => { if (busy || !report) return; if (hasSurcharges) setReturned(true); else onConfirm(report, "Wallet"); }} />}
        <Text style={{ color: theme.muted }}>Sau khi bạn xác nhận, chủ xe xác nhận nhận lại xe để hoàn tất chuyến. Xác nhận nhận tiền phụ thu là thao tác riêng.</Text>
      </View>
    </View>
  </Modal>;
}
