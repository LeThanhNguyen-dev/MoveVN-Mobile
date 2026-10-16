import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import type { InspectionReportResponse } from "../types";
import { formatVietnamDateTime } from "../bookingDisplay";
import { BookingButton, BookingCard } from "./BookingControls";

export default function InspectionReportCard({ report }: { report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  return <BookingCard>
    <Text style={{ color: theme.muted }}>Lập lúc {formatVietnamDateTime(report.createdAt)} · Giờ Việt Nam</Text>
    <Text style={{ color: report.isCustomerConfirmed ? theme.success : theme.brand, fontWeight: "700" }}>{report.isCustomerConfirmed ? "Khách đã xác nhận" : "Chờ khách xác nhận"}</Text>
    <Text style={{ color: theme.text }}>Số km: {report.odometerKm ?? "Chưa ghi"} · Nhiên liệu: {report.fuelLevel || "Chưa ghi"}</Text>
    <Text style={{ color: report.damageNoted ? theme.danger : theme.text }}>{report.damageNoted ? `Có hư hại: ${report.damageDescription || "Chưa mô tả"}` : "Không ghi nhận hư hại"}</Text>
    <View style={styles.grid}>{report.images.map((photo, index) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`Xem ảnh biên bản ${index + 1}`} onPress={() => setSelected(photo.imageUrl)} style={styles.photo}>
      <Image source={{ uri: photo.imageUrl }} style={styles.thumbnail} resizeMode="cover" />
    </Pressable>)}</View>
    <Text style={{ color: theme.muted, fontSize: 13 }}>Chạm vào ảnh để kiểm tra ngày giờ và tình trạng xe.</Text>
    {selected ? <Modal visible animationType="fade" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={styles.viewer}>
        <Image accessibilityLabel="Ảnh biên bản xe" source={{ uri: selected }} resizeMode="contain" style={styles.fullPhoto} />
        <BookingButton title="Đóng ảnh" onPress={() => setSelected(null)} />
      </SafeAreaView>
    </Modal> : null}
  </BookingCard>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, photo: { width: "30%", aspectRatio: 1 },
  thumbnail: { width: "100%", height: "100%", borderRadius: 8 }, viewer: { flex: 1, backgroundColor: "#111", padding: 16, gap: 16 },
  fullPhoto: { flex: 1, width: "100%" },
});
