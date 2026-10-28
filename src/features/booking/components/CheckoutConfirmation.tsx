import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { CHECKOUT_CONSENT } from "../checkoutRules";
import type { BookingResponse, InspectionReportResponse } from "../types";
import CheckoutSummary from "./CheckoutSummary";
import InspectionFinancialSummary from "./InspectionFinancialSummary";
import { DetailButton, DetailPill } from "./detail/BookingDetailUI";

export default function CheckoutConfirmation({ booking, report, busy, onClose, onConfirm }: {
  booking: BookingResponse | null; report: InspectionReportResponse | null; busy: boolean; onClose: () => void; onConfirm: (report: InspectionReportResponse, paymentMethod: "Wallet" | "External") => void;
}) {
  const { theme } = useTheme();
  const hasSurcharges = (report?.pendingSurchargeAmount ?? ((report?.lateReturnFee ?? 0) + (report?.excessMileageFee ?? 0) + (report?.additionalSurcharges ?? []).reduce((sum, fee) => sum + fee.amount, 0))) > 0;
  const [returned, setReturned] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Wallet" | "External" | null>(null);
  useEffect(() => { setPaymentMethod(null); setReturned(false); }, [report?.id, report?.version]);
  return <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: "flex-end" }}>
      <View accessibilityRole="alert" style={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, gap: 12, maxHeight: "92%" }}>
        <View style={{ alignItems: "center", paddingBottom: 2 }}>
          <View style={{ width: 42, height: 5, borderRadius: 999, backgroundColor: theme.border }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.brand, fontFamily: font.extraBold, fontSize: 9, letterSpacing: 0.9, textTransform: "uppercase" }}>Xác nhận trả xe</Text>
            <Text style={{ color: theme.text, fontFamily: font.display, fontSize: 20, letterSpacing: -0.4 }}>
              {returned ? "Bước 2 · Thanh toán phụ thu" : "Bước 1 · Xác nhận bàn giao xe"}
            </Text>
          </View>
          <DetailPill label={returned ? "2/2" : "1/2"} tone="brand" />
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: theme.brand }} />
          <View style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: returned ? theme.brand : theme.border }} />
        </View>

        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {report ? <CheckoutSummary report={report} /> : null}
          {booking && report ? <InspectionFinancialSummary booking={booking} report={report} /> : null}

          <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.infoBorder, backgroundColor: theme.infoSoft, gap: 4 }}>
            <Text style={{ color: theme.info, fontFamily: font.bold, fontSize: 11 }}>Cam kết khi xác nhận</Text>
            <Text style={{ color: theme.text, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 }}>{CHECKOUT_CONSENT}</Text>
          </View>

          {returned ? <>
            <Text style={{ color: theme.text, fontFamily: font.semibold, fontSize: 12 }}>Thanh toán phụ thu</Text>
            <DetailButton
              variant="secondary"
              label={`${paymentMethod === "Wallet" ? "✓ " : ""}Qua ví MoveVN trên web/app`}
              disabled={busy}
              onPress={() => setPaymentMethod("Wallet")}
            />
            <DetailButton
              variant="secondary"
              label={`${paymentMethod === "External" ? "✓ " : ""}Trả trực tiếp cho chủ xe`}
              disabled={busy}
              onPress={() => setPaymentMethod("External")}
            />
            <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 }}>{!paymentMethod ? "Chọn cách thanh toán phụ thu trước khi xác nhận. Chưa chọn thì chưa thu tiền." : paymentMethod === "Wallet" ? "Thu từ ví sau khi đồng ý; thiếu tiền thì nạp thêm và thanh toán phần còn lại." : "Không trừ ví. Chờ chủ xe xác nhận đã nhận đủ tiền mặt/chuyển khoản riêng."}</Text>
          </> : <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 }}>Chỉ tiếp tục sau khi bạn đã bàn giao xe và kiểm tra biên bản. Chưa thu tiền ở bước này.</Text>}
        </ScrollView>

        <DetailButton variant="ghost" label="Xem lại biên bản" disabled={busy} onPress={onClose} />
        {returned ? <DetailButton label="Đồng ý và xác nhận trả xe" busy={busy} disabled={!paymentMethod} onPress={() => { if (report && paymentMethod && !busy) onConfirm(report, paymentMethod); }} />
          : <DetailButton label={hasSurcharges ? "Tôi đã bàn giao xe · Tiếp tục" : "Tôi đã bàn giao xe · Xác nhận"} disabled={busy} onPress={() => { if (busy || !report) return; if (hasSurcharges) setReturned(true); else onConfirm(report, "Wallet"); }} />}
        <Text style={{ color: theme.faint, fontFamily: font.regular, fontSize: 9.5, lineHeight: 14, textAlign: "center" }}>Sau khi bạn xác nhận, chủ xe xác nhận nhận lại xe để hoàn tất chuyến. Xác nhận nhận tiền phụ thu là thao tác riêng.</Text>
      </View>
    </View>
  </Modal>;
}
