import { Switch, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse, CheckoutSurchargeSelection } from "../types";
import { selectableSurcharges, surchargeAmount, surchargeUnit } from "../checkoutSurcharges";
import { BookingField } from "./BookingControls";
export default function CheckoutSurchargePicker({ booking, value, onChange, disabled = false }: {
  booking: BookingResponse; value: CheckoutSurchargeSelection[]; onChange: (value: CheckoutSurchargeSelection[]) => void; disabled?: boolean;
}) {
  const { theme } = useTheme();
  const terms = selectableSurcharges(booking);
  const update = (id: number, patch: Partial<CheckoutSurchargeSelection>) => onChange(value.map(s => s.termId === id ? { ...s, ...patch } : s));
  return <View style={{ gap: 12 }}>
    <Text style={{ color: theme.text, fontWeight: "700" }}>Phụ thu phát sinh khi trả xe</Text>
    <Text style={{ color: theme.muted }}>Chọn khoản thực tế phát sinh theo điều khoản đã chốt. Trả trễ và vượt km tính tự động; khách đồng ý trước khi thu.</Text>
    {!terms.length && <Text style={{ color: theme.muted }}>Booking chưa lưu điều khoản vệ sinh, khử mùi hoặc phụ thu riêng.</Text>}
    {terms.map(term => {
      const selected = value.find(s => s.termId === term.id);
      return <View key={term.id} style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ flex: 1, color: theme.text }}>{term.name} · {term.unitPrice.toLocaleString("vi-VN")}đ/{surchargeUnit(term.calculationMethod)}{term.maxAmount != null ? ` · tối đa ${term.maxAmount.toLocaleString("vi-VN")}đ` : ""}</Text><Switch accessibilityLabel={term.name} disabled={disabled} value={!!selected} onValueChange={checked => onChange(checked ? [...value, { termId: term.id, quantity: 1, note: "" }] : value.filter(s => s.termId !== term.id))} /></View>
        {selected && <>
          <BookingField label={`Số lượng ${term.name} (${surchargeUnit(term.calculationMethod)})`} value={Number.isFinite(selected.quantity) ? String(selected.quantity) : ""} onChangeText={v => update(term.id, { quantity: v.trim() ? Number(v.replace(",", ".")) : NaN })} numeric editable={!disabled} />
          <BookingField label={`Lý do ${term.name}`} value={selected.note} onChangeText={note => update(term.id, { note })} multiline editable={!disabled} />
          <Text style={{ color: theme.text, fontWeight: "600" }}>Tạm tính: {Number.isFinite(selected.quantity) && selected.quantity > 0 ? surchargeAmount(term, selected.quantity).toLocaleString("vi-VN") : "—"}đ</Text>
        </>}
      </View>;
    })}
  </View>;
}
