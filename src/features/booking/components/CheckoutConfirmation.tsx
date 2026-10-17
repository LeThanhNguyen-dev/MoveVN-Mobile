import { useEffect, useState } from "react";
import InspectionFinancialSummary from "./InspectionFinancialSummary";
import { Modal, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { CHECKOUT_CONSENT } from "../checkoutRules";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingButton } from "./BookingControls";
import CheckoutSummary from "./CheckoutSummary";

export default function CheckoutConfirmation({ booking, report, busy, onClose, onConfirm }: {
  booking: BookingResponse | null; report: InspectionReportResponse | null; busy: boolean; onClose: () => void; onConfirm: (report: InspectionReportResponse, paymentMethod: "Wallet" | "External") => void;
}) {
  const { theme } = useTheme();
  const [paymentMethod, setPaymentMethod] = useState<"Wallet" | "External" | null>(null);
  useEffect(() => { setPaymentMethod(null); }, [report?.id, report?.version]);
  return <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
      <View accessibilityRole="alert" style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 12, maxHeight: "90%" }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>Đồng ý biên bản và phụ phí?</Text>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {report ? <CheckoutSummary report={report} /> : null}
          {booking && report ? <InspectionFinancialSummary booking={booking} report={report} /> : null}
          <Text style={{ color: theme.text, lineHeight: 22 }}>{CHECKOUT_CONSENT}</Text>
          <Text style={{ color: theme.text, fontWeight: "700" }}>Thanh toán phụ thu</Text>
          <BookingButton secondary title={`${paymentMethod === "Wallet" ? "✓ " : ""}Qua ví MoveVN trên web/app`} disabled={busy} onPress={() => setPaymentMethod("Wallet")} />
          <BookingButton secondary title={`${paymentMethod === "External" ? "✓ " : ""}Trả trực tiếp cho chủ xe`} disabled={busy} onPress={() => setPaymentMethod("External")} />
          <Text style={{ color: theme.muted }}>{!paymentMethod ? "Chọn cách thanh toán phụ thu trước khi xác nhận. Chưa chọn thì chưa thu tiền." : paymentMethod === "Wallet" ? "Thu từ ví sau khi đồng ý; thiếu tiền thì nạp thêm và thanh toán phần còn lại." : "Không trừ ví. Chờ chủ xe xác nhận đã nhận đủ tiền mặt/chuyển khoản riêng."}</Text>
        </ScrollView>
        <BookingButton secondary title="Xem lại biên bản" disabled={busy} onPress={onClose} />
        <BookingButton title="Đồng ý và xác nhận trả xe" busy={busy} disabled={!paymentMethod} onPress={() => { if (report && paymentMethod && !busy) onConfirm(report, paymentMethod); }} />
      </View>
    </View>
  </Modal>;
}
