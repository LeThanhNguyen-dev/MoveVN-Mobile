import { Camera, ClipboardCheck, Fuel, Gauge, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { formatVietnamDateTime } from "../bookingDisplay";
import { inspectionImageUrl } from "../inspectionImageUrl";
import CheckoutSummary from "./CheckoutSummary";
import InspectionFinancialSummary from "./InspectionFinancialSummary";
import InspectionPdfButton from "./InspectionPdfButton";
import InspectionPhoto from "./InspectionPhoto";
import { DetailCard, DetailDivider, DetailNotice, DetailPill, DetailSectionHeader, DetailStat } from "./detail/BookingDetailUI";
import { BookingButton } from "./BookingControls";

export default function InspectionReportCard({ booking, report }: { booking?: BookingResponse; report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const tone = report.requiresRevision ? "danger" : report.isCustomerConfirmed ? "mint" : "warn";
  const statusLabel = report.requiresRevision ? "Yêu cầu lập lại" : report.isCustomerConfirmed ? "Khách đã xác nhận" : "Chờ khách xác nhận";
  return <DetailCard>
    <DetailSectionHeader
      icon={ClipboardCheck}
      subtitle={`Lập lúc ${formatVietnamDateTime(report.createdAt)} · Giờ Việt Nam`}
      title={report.type === "CheckIn" ? "Biên bản nhận xe" : "Biên bản trả xe"}
      right={<DetailPill label={`v${report.version ?? 1}`} tone="brand" />}
    />

    <View style={styles.statusRow}>
      <DetailPill label={statusLabel} tone={tone} />
    </View>

    {report.requiresRevision ? (
      <DetailNotice icon={TriangleAlert} title="Khách yêu cầu lập lại biên bản" tone="danger">
        {report.revisionReason || "Chủ xe cần gửi biên bản mới trước khi khách xác nhận."}
      </DetailNotice>
    ) : null}

    <View style={styles.stats}>
      <DetailStat icon={Gauge} label="Số km" value={report.odometerKm != null ? `${report.odometerKm.toLocaleString("vi-VN")} km` : "Chưa ghi"} />
      <DetailStat icon={Fuel} label="Nhiên liệu" value={report.fuelLevel || "Chưa ghi"} tone="brand" />
    </View>

    {report.damageNoted ? (
      <DetailNotice icon={TriangleAlert} title="Có hư hại / trầy xước" tone="danger">
        {report.damageDescription || "Chưa mô tả chi tiết."}
      </DetailNotice>
    ) : (
      <DetailNotice icon={ShieldCheck} title="Không ghi nhận hư hại" tone="mint">
        Tình trạng xe được ghi nhận bình thường tại thời điểm lập biên bản.
      </DetailNotice>
    )}

    <CheckoutSummary report={report} />
    {booking ? <InspectionFinancialSummary booking={booking} report={report} /> : null}
    {booking ? <InspectionPdfButton booking={booking} report={report} /> : null}

    <DetailDivider />

    <View style={styles.photosHead}>
      <Camera color={theme.muted} size={14} strokeWidth={2.1} />
      <Text style={[styles.photosTitle, { color: theme.text }]}>Ảnh biên bản ({report.images.length})</Text>
    </View>
    <View style={styles.grid}>
      {report.images.map((photo, index) => (
        <Pressable
          key={photo.id}
          accessibilityRole="button"
          accessibilityLabel={`Xem ảnh biên bản ${index + 1}`}
          onPress={() => setSelected(photo.imageUrl)}
          style={styles.photo}
        >
          <InspectionPhoto key={photo.imageUrl} uri={photo.imageUrl} label={`Ảnh biên bản ${index + 1}`} />
        </Pressable>
      ))}
    </View>
    <Text style={[styles.hint, { color: theme.muted }]}>Chạm vào ảnh để kiểm tra ngày giờ và tình trạng xe.</Text>

    {selected ? <Modal visible animationType="fade" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={styles.viewer}>
        <Image accessibilityLabel="Ảnh biên bản xe" source={{ uri: inspectionImageUrl(selected) }} resizeMode="contain" style={styles.fullPhoto} />
        <View style={styles.viewerActions}><BookingButton title="Đóng ảnh" onPress={() => setSelected(null)} /></View>
      </SafeAreaView>
    </Modal> : null}
  </DetailCard>;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stats: { flexDirection: "row", gap: 8 },
  photosHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  photosTitle: { fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: "48%" },
  hint: { fontSize: 10, lineHeight: 14 },
  viewer: { flex: 1, backgroundColor: "#0B0714" },
  viewerActions: { padding: 16 },
  fullPhoto: { flex: 1, width: "100%" },
});
