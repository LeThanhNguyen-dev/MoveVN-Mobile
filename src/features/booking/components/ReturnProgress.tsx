import { Check, RotateCcw } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function ReturnProgress({ booking, report, role }: {
  booking: BookingResponse; report?: InspectionReportResponse; role: "Owner" | "Customer";
}) {
  const { theme } = useTheme();
  if (!["Returning", "Returned", "Completed"].includes(booking.status)) return null;
  const confirmed = ["Returned", "Completed"].includes(booking.status);
  const outstanding = report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0;
  const steps = [
    { title: "Khách xác nhận biên bản và trả xe", done: confirmed },
    { title: "Thanh toán phụ thu (nếu có)", done: confirmed && outstanding <= 0 },
    { title: "Chủ xe xác nhận nhận lại xe", done: booking.status === "Completed" },
  ];
  const guidance = booking.status === "Completed"
    ? outstanding > 0 ? "Chuyến đã hoàn tất bàn giao; vẫn còn phụ thu cần thanh toán bên dưới." : "Hai bên đã hoàn tất bàn giao xe."
    : confirmed
      ? role === "Owner" ? "Khách đã xác nhận trả xe. Kiểm tra thanh toán phụ thu và bấm Xác nhận đã nhận xe để hoàn tất chuyến." : "Bạn đã xác nhận trả xe. Thanh toán phụ thu còn thiếu (nếu có), sau đó chờ chủ xe xác nhận nhận lại xe. Bạn không cần bấm trả xe lần nữa."
      : report ? role === "Owner" ? "Chờ khách đồng ý biên bản trả xe. Phụ thu chỉ được thanh toán sau bước này." : "Kiểm tra biên bản, xác nhận đã bàn giao xe rồi chọn cách thanh toán phụ thu. Nếu không đồng ý, mở tranh chấp."
      : role === "Owner" ? "Khách đã báo bàn giao xe. Hãy kiểm tra xe và lập biên bản trả xe." : "Đã báo bàn giao xe. Chờ chủ xe lập biên bản để bạn kiểm tra và xác nhận.";
  const doneCount = steps.filter((step) => step.done).length;
  return <View style={{ backgroundColor: theme.infoSoft, borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: theme.infoBorder }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface }}>
        <RotateCcw color={theme.info} size={15} strokeWidth={2.1} />
      </View>
      <Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontFamily: font.display, fontSize: 14.5 }}>Tiến trình trả xe</Text>
      <Text style={{ color: theme.info, fontFamily: font.bold, fontSize: 10 }}>{doneCount}/{steps.length} bước</Text>
    </View>
    <View style={{ gap: 9 }}>
      {steps.map((step, index) => (
        <View key={step.title} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View style={{
            width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
            backgroundColor: step.done ? theme.successSoft : theme.surface,
            borderWidth: 1, borderColor: step.done ? theme.success : theme.border,
          }}>
            {step.done ? <Check color={theme.success} size={12} strokeWidth={3} /> : <Text style={{ color: theme.muted, fontFamily: font.bold, fontSize: 9 }}>{index + 1}</Text>}
          </View>
          <Text style={{ flex: 1, color: step.done ? theme.text : theme.muted, fontFamily: step.done ? font.semibold : font.regular, fontSize: 11.5 }}>{step.title}</Text>
        </View>
      ))}
    </View>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 }}>{guidance}</Text>
  </View>;
}
