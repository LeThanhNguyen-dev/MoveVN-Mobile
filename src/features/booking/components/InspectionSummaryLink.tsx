import { Pressable, Text, View } from "react-native";
import { ChevronRight, KeyRound, PackageCheck } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { handoverProgress } from "../handoverProgress";
import { DetailPill } from "./detail/BookingDetailUI";

export default function InspectionSummaryLink({ booking, type, report, onPress }: {
  booking: BookingResponse; type: "CheckIn" | "CheckOut"; report?: InspectionReportResponse; onPress: () => void;
}) {
  const { theme } = useTheme();
  const title = type === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out";
  const progress = handoverProgress(booking, type, report);
  const tone = progress.tone === "done" ? "mint" : progress.tone === "action" ? "brand" : "neutral";
  const Icon = type === "CheckIn" ? KeyRound : PackageCheck;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Mở ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: type === "CheckIn" ? theme.brandSoft : theme.successSoft }}>
        <Icon color={type === "CheckIn" ? theme.brand : theme.success} size={19} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ flex: 1, color: theme.text, fontFamily: font.semibold, fontSize: 13.5 }}>{title}</Text>
          <DetailPill label={progress.label} tone={tone} />
        </View>
        <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 }} numberOfLines={2}>
          {progress.guidance}
        </Text>
        <Text style={{ color: theme.brand, fontFamily: font.semibold, fontSize: 10.5, marginTop: 1 }}>
          {report ? `Biên bản · Phiên bản ${report.version ?? 1} · Xem chi tiết` : "Xem biên bản và thao tác"}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.faint} />
    </Pressable>
  );
}
