import { Pressable, Text, View } from "react-native";
import { ChevronRight, KeyRound, PackageCheck } from "lucide-react-native";
import { detailFont as font, useDetailTheme } from "@/features/vehicles/components/detail/detailTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { handoverProgress } from "../handoverProgress";
import { DetailPill } from "./detail/BookingDetailUI";

export default function InspectionSummaryLink({ booking, type, report, onPress, divider }: {
  booking: BookingResponse;
  type: "CheckIn" | "CheckOut";
  report?: InspectionReportResponse;
  onPress: () => void;
  divider?: boolean;
}) {
  const { p } = useDetailTheme();
  const title = type === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out";
  const progress = handoverProgress(booking, type, report);
  const tone = progress.tone === "done" ? "mint" : progress.tone === "action" ? "brand" : "neutral";
  const Icon = type === "CheckIn" ? KeyRound : PackageCheck;
  const tint = tone === "mint" ? p.mint : tone === "brand" ? p.brand : p.faint;
  const tintSoft = tone === "mint" ? p.mintSoft : tone === "brand" ? p.brandSoft : p.surfaceAlt;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Mở ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        paddingTop: divider ? 12 : 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: p.line,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tintSoft,
          borderWidth: tone === "neutral" ? 1 : 0,
          borderColor: p.line,
          borderStyle: tone === "neutral" ? "dashed" : "solid",
        }}
      >
        <Icon color={tint} size={19} strokeWidth={2.1} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: p.ink, fontFamily: font.semibold, fontSize: 12.5 }}
          >
            {title}
          </Text>
          <DetailPill label={progress.label} tone={tone} />
        </View>
        <Text
          numberOfLines={2}
          style={{ color: p.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 }}
        >
          {progress.guidance}
        </Text>
        <Text style={{ color: p.brand, fontFamily: font.semibold, fontSize: 10.5 }}>
          {report ? `Biên bản · Phiên bản ${report.version ?? 1} · Xem chi tiết` : "Xem biên bản và thao tác"}
        </Text>
      </View>

      <ChevronRight size={16} color={p.faint} />
    </Pressable>
  );
}
