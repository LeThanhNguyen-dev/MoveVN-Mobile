import Text from "@/components/AppText";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { handoverProgress } from "../handoverProgress";

export default function InspectionSummaryLink({ booking, type, report, onPress }: {
  booking: BookingResponse; type: "CheckIn" | "CheckOut"; report?: InspectionReportResponse; onPress: () => void;
}) {
  const { theme } = useTheme();
  const title = type === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out";
  const progress = handoverProgress(booking, type, report);
  const color = progress.tone === "done" ? theme.success : progress.tone === "action" ? theme.brand : theme.muted;
  return <Pressable accessibilityRole="link" accessibilityLabel={`Mở ${title}`} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color, fontWeight: "700", fontSize: 13 }}>{progress.label}</Text>
      <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 20 }}>{progress.guidance}</Text>
      {report ? <Text style={{ color: theme.muted, fontSize: 12 }}>Biên bản · Phiên bản {report.version ?? 1}</Text> : null}
      <Text style={{ color: theme.brand, fontSize: 13 }}>Xem biên bản và thao tác</Text>
    </View>
    <ChevronRight size={20} color={theme.brand} />
  </Pressable>;
}
