import Text from "@/components/AppText";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { mileagePreview } from "../bookingSettlement";
import { formatMoney } from "../bookingDisplay";
import type { BookingResponse } from "../types";

export default function MileageFeePreview({ booking, initialKm, finalKm }: { booking: BookingResponse; initialKm?: number; finalKm: string }) {
  const { theme } = useTheme();
  const value = mileagePreview(booking, initialKm, finalKm);
  if (!value) return <Text style={{ color: theme.muted }}>Đơn này không có điều khoản thu phí vượt km.</Text>;
  if (!value.valid) return <Text style={{ color: theme.danger }}>Cần số km nhận và trả xe hợp lệ để tính phí vượt km.</Text>;
  return <View style={{ gap: 6, padding: 12, backgroundColor: theme.surfaceAlt, borderRadius: 10 }}>
    <Text style={{ color: theme.text }}>Đồng hồ nhận xe: {initialKm?.toLocaleString("vi-VN")} km · Đồng hồ trả xe: {Number(finalKm).toLocaleString("vi-VN")} km</Text>
    <Text style={{ color: theme.text }}>Đã đi: {value.travelled} km · Hạn mức: {value.included} km · Vượt: {value.excess} km</Text>
    <Text style={{ color: theme.text, fontWeight: "700" }}>Phí vượt km dự tính: {formatMoney(value.fee)} ({formatMoney(value.unitPrice)}/km)</Text>
    <Text style={{ color: theme.muted }}>Phí được tính lại khi lưu, chờ khách xác nhận trước khi thu.</Text>
  </View>;
}
