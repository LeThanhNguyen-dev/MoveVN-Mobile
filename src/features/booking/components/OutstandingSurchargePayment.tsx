import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { formatMoney } from "../bookingDisplay";
import { settleCheckoutSurcharges } from "../bookingService";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingButton, BookingField } from "./BookingControls";

export default function OutstandingSurchargePayment({ booking, report, role, onUpdated, onOpenWallet }: {
  booking: BookingResponse; report?: InspectionReportResponse; role?: "Owner" | "Customer"; onUpdated?: () => void | Promise<void>; onOpenWallet?: () => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("");
  const lock = useRef(false);
  const external = report?.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0;
  const amount = Math.max(report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0, external);
  async function pay(action: "Wallet" | "External" | "ConfirmExternal") {
    if (lock.current || !report || (action === "ConfirmExternal" && !note.trim())) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const updated = await settleCheckoutSurcharges(booking.id, { action, expectedVersion: report.version ?? 1, ...(action === "ConfirmExternal" ? { note: note.trim() } : {}) });
      await onUpdated?.(); setNote("");
      if (action === "Wallet" && (updated.outstandingSurchargeAmount ?? 0) > 0) setError("Ví chưa đủ thanh toán hết phụ thu. Nạp thêm vào ví hoặc chọn trả trực tiếp phần còn lại.");
    } catch (e) { setError(getApiErrorMessage(e, "Chưa cập nhật được thanh toán. Tải lại để kiểm tra trước khi thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  }
  if (amount <= 0 || !["Returned", "Completed"].includes(booking.status)) return null;
  return <View accessibilityRole="alert" style={{ padding: 14, backgroundColor: theme.surfaceAlt, borderRadius: 12, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>{role === "Owner" && external > 0 ? "Xác nhận nhận tiền phụ thu trực tiếp" : "Thanh toán phụ thu trả xe"}</Text>
    <Text style={{ color: theme.text, fontWeight: "700" }}>Còn phụ phí chưa thanh toán: {formatMoney(amount)}</Text>
    <Text style={{ color: theme.text }}>{external > 0 ? `Đã chọn trả trực tiếp: ${formatMoney(external)}, chờ chủ xe xác nhận đã nhận đủ tiền. Không trừ ví cho khoản này.` : "Khách chọn thanh toán qua ví MoveVN hoặc trả trực tiếp cho chủ xe."}</Text>
    {role === "Customer" && report ? <>
      <BookingButton title="Thanh toán qua ví MoveVN" busy={busy} onPress={() => void pay("Wallet")} />
      <BookingButton secondary title="Chọn trả trực tiếp" disabled={busy || external >= amount} onPress={() => void pay("External")} />
      {onOpenWallet && <BookingButton secondary title="Nạp tiền vào ví" disabled={busy} onPress={onOpenWallet} />}
      <Text style={{ color: theme.muted }}>Nếu ví thiếu tiền, vào Ví MoveVN để nạp thêm rồi thanh toán khoản còn lại.</Text>
    </> : null}
    {role === "Owner" && external > 0 && report ? <>
      <BookingField label="Ghi chú nhận tiền trực tiếp" value={note} onChangeText={setNote} multiline editable={!busy} />
      <BookingButton title="Xác nhận đã nhận đủ tiền phụ thu trực tiếp" busy={busy} disabled={!note.trim()} onPress={() => void pay("ConfirmExternal")} />
    </> : null}
    {booking.status === "Returned" ? <Text style={{ color: theme.muted }}>{role === "Owner" ? "Xác nhận nhận tiền chỉ ghi nhận thanh toán. Sau khi kiểm tra xe, bấm Xác nhận đã nhận xe để hoàn tất chuyến." : "Bạn đã xác nhận trả xe. Sau khi thanh toán phụ thu, chờ chủ xe xác nhận nhận lại xe; bạn không cần xác nhận trả xe lần nữa."}</Text> : null}
    {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
  </View>;
}
