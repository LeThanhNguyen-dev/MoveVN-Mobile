import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { CircleCheck, Clock3, Hand, Route, XCircle } from "lucide-react-native";
import { DetailCard, DetailNotice, DetailSectionHeader } from "./detail/BookingDetailUI";
import { detailFont as font, useDetailTheme, type DetailPalette } from "@/features/vehicles/components/detail/detailTheme";
import { bookingFlowGuide, FLOW_STEPS, type FlowRole } from "../bookingFlowGuide";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function BookingFlowGuide({
  booking,
  reports,
  role,
}: {
  booking: BookingResponse;
  reports: InspectionReportResponse[];
  role: FlowRole;
}) {
  const { p } = useDetailTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(p), [p]);
  const guide = bookingFlowGuide(booking, reports, role);
  const labels = (
    role === "Owner"
      ? t("mobile:bookingDetail.flow.stepsOwner", { returnObjects: true })
      : t("mobile:bookingDetail.flow.stepsCustomer", { returnObjects: true })
  ) as string[];
  const current = Math.min(guide.step + 1, FLOW_STEPS);
  const noticeTone = guide.terminal || !guide.actionable ? (guide.key === "done" ? "mint" : "warn") : "brand";
  const NoticeIcon = guide.key === "done" ? CircleCheck : guide.terminal ? XCircle : guide.actionable ? Hand : Clock3;

  return (
    <DetailCard>
      <DetailSectionHeader
        icon={Route}
        title={t("mobile:bookingDetail.flow.title")}
        subtitle={
          guide.terminal
            ? t("mobile:bookingDetail.flow.subtitleClosed")
            : t("mobile:bookingDetail.flow.subtitle", { step: current, total: FLOW_STEPS })
        }
      />
      {!guide.terminal ? (
        <View style={styles.stepper}>
          {labels.map((label, i) => {
            const done = i < guide.step;
            const isCurrent = i === guide.step && guide.step < FLOW_STEPS;
            const connectorDone = i > 0 && i <= guide.step;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={styles.stepDotRow}>
                  {i > 0 ? <View style={[styles.connector, connectorDone && styles.connectorDone]} /> : <View style={styles.connectorSpacer} />}
                  <View
                    style={[
                      styles.dot,
                      (done || isCurrent) && styles.dotActive,
                      isCurrent && styles.dotCurrent,
                    ]}
                  >
                    {done ? <CircleCheck color={p.onBrand} size={10} strokeWidth={2.6} /> : null}
                  </View>
                  <View style={styles.connectorSpacer} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.stepLabel, (done || isCurrent) && styles.stepLabelActive]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <DetailNotice
        icon={NoticeIcon}
        tone={noticeTone}
        title={
          guide.terminal
            ? t("mobile:bookingDetail.flow.closedTitle")
            : guide.key === "done"
              ? t("mobile:bookingDetail.flow.doneTitle")
              : guide.actionable
                ? t("mobile:bookingDetail.flow.actionTitle")
                : t("mobile:bookingDetail.flow.waitTitle")
        }
      >
        {t(`mobile:bookingDetail.flow.next.${guide.key}`, { hours: guide.hours ?? 0 })}
      </DetailNotice>
    </DetailCard>
  );
}

const createStyles = (p: DetailPalette) =>
  StyleSheet.create({
    stepper: { flexDirection: "row", alignItems: "flex-start" },
    stepItem: { flex: 1, alignItems: "center", gap: 6, minWidth: 0 },
    stepDotRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
    connector: { flex: 1, height: 2, backgroundColor: p.line },
    connectorDone: { backgroundColor: p.brand },
    connectorSpacer: { flex: 1 },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: p.surfaceAlt,
      borderWidth: 1,
      borderColor: p.line,
      alignItems: "center",
      justifyContent: "center",
    },
    dotActive: { backgroundColor: p.brand, borderColor: p.brand },
    dotCurrent: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: p.brandSoft },
    stepLabel: { color: p.faint, fontFamily: font.semibold, fontSize: 8.5, letterSpacing: -0.1 },
    stepLabelActive: { color: p.ink },
  });
