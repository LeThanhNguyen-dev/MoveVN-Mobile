import { Check, RotateCcw } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function ReturnProgress({ booking, report, role }: {
  booking: BookingResponse; report?: InspectionReportResponse; role: "Owner" | "Customer";
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  if (!["Returning", "Returned", "Completed"].includes(booking.status)) return null;
  const confirmed = ["Returned", "Completed"].includes(booking.status);
  const outstanding = report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0;
  const steps = [
    { title: t("mobile:inspection.returnProgress.stepConfirm"), done: confirmed },
    { title: t("mobile:inspection.returnProgress.stepPay"), done: confirmed && outstanding <= 0 },
    { title: t("mobile:inspection.returnProgress.stepOwner"), done: booking.status === "Completed" },
  ];
  const guidance = booking.status === "Completed"
    ? outstanding > 0 ? t("mobile:inspection.returnProgress.completedWithOutstanding") : t("mobile:inspection.returnProgress.completed")
    : confirmed
      ? role === "Owner" ? t("mobile:inspection.returnProgress.confirmedOwner") : t("mobile:inspection.returnProgress.confirmedCustomer")
      : report ? role === "Owner" ? t("mobile:inspection.returnProgress.reportOwner") : t("mobile:inspection.returnProgress.reportCustomer")
      : role === "Owner" ? t("mobile:inspection.returnProgress.noReportOwner") : t("mobile:inspection.returnProgress.noReportCustomer");
  const doneCount = steps.filter((step) => step.done).length;
  return <View style={{ backgroundColor: theme.infoSoft, borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: theme.infoBorder }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface }}>
        <RotateCcw color={theme.info} size={15} strokeWidth={2.1} />
      </View>
      <Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontFamily: font.display, fontSize: 14, lineHeight: 19 }}>{t("mobile:inspection.returnProgress.title")}</Text>
      <Text style={{ color: theme.info, fontFamily: font.bold, fontSize: 10 }}>{t("mobile:inspection.returnProgress.progress", { done: doneCount, total: steps.length })}</Text>
    </View>
    <View style={{ gap: 9 }}>
      {steps.map((step, index) => (
        <View key={step.title} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View style={{
            width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
            backgroundColor: step.done ? theme.successSoft : theme.surface,
            borderWidth: 1, borderColor: step.done ? theme.success : theme.border,
          }}>
            {step.done ? <Check color={theme.success} size={12} strokeWidth={3} /> : <Text style={{ color: theme.muted, fontFamily: font.bold, fontSize: 9 }}>{index + 1}</Text>}
          </View>
          <Text style={{ flex: 1, color: step.done ? theme.text : theme.muted, fontFamily: step.done ? font.semibold : font.regular, fontSize: 11.5 }}>{step.title}</Text>
        </View>
      ))}
    </View>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 }}>{guidance}</Text>
  </View>;
}
