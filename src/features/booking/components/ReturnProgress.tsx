import Text from "@/components/AppText";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
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
  return <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 14, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>Tiến trình trả xe</Text>
    {steps.map((step, index) => <Text key={step.title} style={{ color: step.done ? theme.success : theme.muted }}>{step.done ? "✓" : index + 1 + "."} {step.title}</Text>)}
    <Text accessibilityLiveRegion="polite" style={{ color: theme.text, lineHeight: 21 }}>{guidance}</Text>
  </View>;
}
