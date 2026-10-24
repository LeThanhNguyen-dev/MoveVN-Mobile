import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { InspectionReportResponse } from "../types";

export default function InspectionSummaryLink({ type, report, onPress }: {
  type: "CheckIn" | "CheckOut"; report?: InspectionReportResponse; onPress: () => void;
}) {
  const { theme } = useTheme();
  const title = type === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out";
  return <Pressable accessibilityRole="link" accessibilityLabel={`Mở ${title}`} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      <Text style={{ color: theme.muted, fontSize: 13 }}>{!report ? "Chưa có biên bản" : report.requiresRevision ? "Cần lập lại biên bản" : report.isCustomerConfirmed ? "Khách đã xác nhận" : "Chờ khách xác nhận"}{report ? ` · Phiên bản ${report.version ?? 1}` : ""}</Text>
      <Text style={{ color: theme.brand, fontSize: 13 }}>Xem biên bản và thao tác</Text>
    </View>
    <ChevronRight size={20} color={theme.brand} />
  </Pressable>;
}
