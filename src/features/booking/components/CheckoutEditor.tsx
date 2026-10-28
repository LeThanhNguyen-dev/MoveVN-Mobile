import CheckoutSurchargePicker from "./CheckoutSurchargePicker";
import { validateSurchargeSelection } from "../checkoutSurcharges";
import type { CheckoutSurchargeSelection } from "../types";
import { checkoutStartDate } from "../bookingDisplay";
import MileageFeePreview from "./MileageFeePreview";
import { useRef, useState } from "react";
import { Text, View, Switch } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { amendCheckout } from "../bookingService";
import { returnTimeISO, validateCheckoutKm, vietnamInput } from "../checkoutRules";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingButton, BookingField } from "./BookingControls";

export default function CheckoutEditor({ booking, report, initialKm, onSaved }: { booking: BookingResponse; report: InspectionReportResponse; initialKm?: number; onSaved: () => Promise<void> }) {
  const { theme } = useTheme();
  const [additionalSurcharges, setAdditionalSurcharges] = useState<CheckoutSurchargeSelection[]>([]);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [at, setAt] = useState(""), [km, setKm] = useState(""), [fuel, setFuel] = useState(""), [reason, setReason] = useState(""), [description, setDescription] = useState("");
  const [damage, setDamage] = useState(false);
  const [applyPolicy, setApplyPolicy] = useState(false);
  const [editingVersion, setEditingVersion] = useState(1);
  const saveLock = useRef(false);
  if (booking.status !== "Returning" || report.isCustomerConfirmed) return null;
  async function save() {
    if (saveLock.current) return;
    saveLock.current = true;
    setBusy(true); setError("");
    try {
      if (!reason.trim() || (damage && !description.trim())) throw new Error("Nhập lý do sửa và mô tả hư hại nếu có.");
      validateSurchargeSelection(booking, additionalSurcharges);
      await amendCheckout(booking.id, { additionalSurcharges, applyCurrentLateReturnPolicy: applyPolicy, expectedVersion: editingVersion, actualReturnAt: returnTimeISO(at, checkoutStartDate(booking)), odometerKm: validateCheckoutKm(km, initialKm), fuelLevel: fuel, reason: reason.trim(), damageNoted: damage, damageDescription: description });
      await onSaved(); setOpen(false);
    } catch (e) { setError(getApiErrorMessage(e, e instanceof Error ? e.message : "Không thể sửa. Hãy tải lại để kiểm tra phiên bản mới.")); }
    finally { saveLock.current = false; setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <BookingButton secondary title="Sửa biên bản và tính lại phụ phí" disabled={busy} onPress={() => { setAdditionalSurcharges((report.additionalSurcharges ?? []).map(s => ({ termId: s.termId, quantity: s.quantity, note: s.note ?? "" }))); setApplyPolicy(false); setEditingVersion(report.version ?? 1); setAt(report.actualReturnAt ? vietnamInput(report.actualReturnAt) : vietnamInput()); setKm(report.odometerKm == null ? "" : String(report.odometerKm)); setFuel(report.fuelLevel ?? ""); setDamage(report.damageNoted); setDescription(report.damageDescription ?? ""); setReason(""); setError(""); setOpen(!open); }} />
    {open ? <>
      <BookingField label="Giờ bàn giao (Việt Nam, YYYY-MM-DD HH:mm)" value={at} onChangeText={setAt} editable={!busy} />
      <BookingButton secondary title="Lấy giờ hiện tại" disabled={busy} onPress={() => setAt(vietnamInput())} />
      <BookingField label="Kilomet trả xe" value={km} onChangeText={setKm} numeric editable={!busy} />
      <MileageFeePreview booking={booking} initialKm={initialKm} finalKm={km} />
      <CheckoutSurchargePicker booking={booking} value={additionalSurcharges} onChange={setAdditionalSurcharges} disabled={busy} />
      <BookingField label="Nhiên liệu" value={fuel} onChangeText={setFuel} editable={!busy} />
      <Text style={{ color: theme.text }}>Có hư hại</Text><Switch value={damage} onValueChange={setDamage} disabled={busy} />
      <BookingField label="Mô tả hư hại" value={description} onChangeText={setDescription} editable={!busy} multiline />
      {report.lateReturnFeeStatus === "MissingPolicy" && report.proposedLateReturnFee != null ? <View style={{ gap: 6 }}><Text style={{ color: theme.text }}>Đề xuất bổ sung chính sách trả trễ hiện tại. Phí theo giờ đang lưu: {report.proposedLateReturnFee.toLocaleString("vi-VN")}đ. Khách cần đồng ý bản sửa trước khi thu.</Text><Switch accessibilityLabel="Bổ sung chính sách phí trả trễ hiện tại" value={applyPolicy} onValueChange={setApplyPolicy} disabled={busy} /></View> : null}
      <BookingField label="Lý do sửa" value={reason} onChangeText={setReason} editable={!busy} multiline />
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
      <BookingButton title="Lưu phiên bản mới" busy={busy} onPress={() => void save()} />
      <BookingButton secondary title="Tải lại phiên bản để kiểm tra" disabled={busy} onPress={() => void onSaved()} />
    </> : null}
  </View>;
}
