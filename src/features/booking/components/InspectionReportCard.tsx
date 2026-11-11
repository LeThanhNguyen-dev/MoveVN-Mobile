import { Camera, ClipboardCheck, Fuel, Gauge, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const tone = report.requiresRevision ? "danger" : report.isCustomerConfirmed ? "mint" : "warn";
  const statusLabel = report.requiresRevision ? t("mobile:inspection.report.statusRevision") : report.isCustomerConfirmed ? t("booking:inspection.statusConfirmed") : t("booking:inspection.statusAwaiting");
  return <DetailCard>
    <DetailSectionHeader
      icon={ClipboardCheck}
      subtitle={t("mobile:inspection.report.subtitle", { time: formatVietnamDateTime(report.createdAt) })}
      title={t(report.type === "CheckIn" ? "mobile:inspection.report.titleCheckIn" : "mobile:inspection.report.titleCheckOut")}
      right={<DetailPill label={`v${report.version ?? 1}`} tone="brand" />}
    />

    <View style={styles.statusRow}>
      <DetailPill label={statusLabel} tone={tone} />
    </View>

    {report.requiresRevision ? (
      <DetailNotice icon={TriangleAlert} title={t("mobile:inspection.report.revisionTitle")} tone="danger">
        {report.revisionReason || t("mobile:inspection.report.revisionFallback")}
      </DetailNotice>
    ) : null}

    <View style={styles.stats}>
      <DetailStat icon={Gauge} label={t("mobile:inspection.report.odometer")} value={report.odometerKm != null ? t("mobile:inspection.report.odometerValue", { km: report.odometerKm.toLocaleString("vi-VN") }) : t("mobile:inspection.report.missing")} />
      <DetailStat icon={Fuel} label={t("booking:inspection.fuel")} value={report.fuelLevel || t("mobile:inspection.report.missing")} tone="brand" />
    </View>

    {report.damageNoted ? (
      <DetailNotice icon={TriangleAlert} title={t("mobile:inspection.report.damageTitle")} tone="danger">
        {report.damageDescription || t("mobile:inspection.report.damageFallback")}
      </DetailNotice>
    ) : (
      <DetailNotice icon={ShieldCheck} title={t("mobile:inspection.report.noDamageTitle")} tone="mint">
        {t("mobile:inspection.report.noDamageBody")}
      </DetailNotice>
    )}

    <CheckoutSummary report={report} />
    {booking ? <InspectionFinancialSummary booking={booking} report={report} /> : null}
    {booking ? <InspectionPdfButton booking={booking} report={report} /> : null}

    <DetailDivider />

    <View style={styles.photosHead}>
      <Camera color={theme.muted} size={14} strokeWidth={2.1} />
      <Text style={[styles.photosTitle, { color: theme.text }]}>{t("mobile:inspection.report.photosTitle", { total: report.images.length })}</Text>
    </View>
    <View style={styles.grid}>
      {report.images.map((photo, index) => (
        <Pressable
          key={photo.id}
          accessibilityRole="button"
          accessibilityLabel={t("booking:inspection.gallery.viewAria", { index: index + 1 })}
          onPress={() => setSelected(photo.imageUrl)}
          style={styles.photo}
        >
          <InspectionPhoto key={photo.imageUrl} uri={photo.imageUrl} label={t("booking:inspection.gallery.alt", { index: index + 1 })} />
        </Pressable>
      ))}
    </View>
    <Text style={[styles.hint, { color: theme.muted }]}>{t("mobile:inspection.report.photosHint")}</Text>

    {selected ? <Modal visible animationType="fade" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={styles.viewer}>
        <Image accessibilityLabel={t("mobile:inspection.report.photoAlt")} source={{ uri: inspectionImageUrl(selected) }} resizeMode="contain" style={styles.fullPhoto} />
        <View style={styles.viewerActions}><BookingButton title={t("common:imagePreview.close")} onPress={() => setSelected(null)} /></View>
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
