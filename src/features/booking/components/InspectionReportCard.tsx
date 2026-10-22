import { inspectionImageUrl } from "../inspectionImageUrl";
import InspectionPhoto from "./InspectionPhoto";
import InspectionPdfButton from "./InspectionPdfButton";
import InspectionFinancialSummary from "./InspectionFinancialSummary";
import CheckoutSummary from "./CheckoutSummary";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { formatVietnamDateTime } from "../bookingDisplay";
import { BookingButton, BookingCard } from "./BookingControls";

export default function InspectionReportCard({ booking, report }: { booking?: BookingResponse; report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  return <BookingCard>
    <Text accessibilityRole="header" style={{ color: theme.text, fontWeight: "700", fontSize: 17 }}>{report.type === "CheckIn" ? "Biên bản nhận xe" : "Biên bản trả xe"} · Phiên bản {report.version ?? 1}</Text>
    <Text style={{ color: theme.muted }}>Lập lúc {formatVietnamDateTime(report.createdAt)} · Giờ Việt Nam</Text>
    <Text style={{ color: report.isCustomerConfirmed ? theme.success : theme.brand, fontWeight: "700" }}>{report.requiresRevision ? "Khách yêu cầu lập lại biên bản" : report.isCustomerConfirmed ? "Khách đã xác nhận" : "Chờ khách xác nhận"}</Text>
    {report.requiresRevision ? <Text style={{ color: theme.danger }}>Lý do: {report.revisionReason}</Text> : null}
    <CheckoutSummary report={report} />
    {booking ? <InspectionFinancialSummary booking={booking} report={report} /> : null}
    {booking ? <InspectionPdfButton booking={booking} report={report} /> : null}
    <Text style={{ color: theme.text }}>Số km: {report.odometerKm ?? "Chưa ghi"} · Nhiên liệu: {report.fuelLevel || "Chưa ghi"}</Text>
    <Text style={{ color: report.damageNoted ? theme.danger : theme.text }}>{report.damageNoted ? `Có hư hại: ${report.damageDescription || "Chưa mô tả"}` : "Không ghi nhận hư hại"}</Text>
    <View style={styles.grid}>{report.images.map((photo, index) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`Xem ảnh biên bản ${index + 1}`} onPress={() => setSelected(photo.imageUrl)} style={styles.photo}>
      <InspectionPhoto key={photo.imageUrl} uri={photo.imageUrl} label={`Ảnh biên bản ${index + 1}`} />
    </Pressable>)}</View>
    <Text style={{ color: theme.muted, fontSize: 13 }}>Chạm vào ảnh để kiểm tra ngày giờ và tình trạng xe.</Text>
    {selected ? <Modal visible animationType="fade" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={styles.viewer}>
        <Image accessibilityLabel="Ảnh biên bản xe" source={{ uri: inspectionImageUrl(selected) }} resizeMode="contain" style={styles.fullPhoto} />
        <View style={styles.viewerActions}><BookingButton title="Đóng ảnh" onPress={() => setSelected(null)} /></View>
      </SafeAreaView>
    </Modal> : null}
  </BookingCard>;
}

const styles = StyleSheet.create({
  grid: { width: "100%", gap: 12 }, photo: { width: "100%" },
  viewer: { flex: 1, backgroundColor: "#111" },
  viewerActions: { padding: 12 },
  fullPhoto: { flex: 1, width: "100%" },
});
