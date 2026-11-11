import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { formatDisputeMoney, formatDisputeDateTime } from "./disputeLabels";
import type { InspectionReportResponse } from "@/features/booking/types";

export default function CheckoutDecisionSummary({ json, appliedAt, report }: {
  json?: string | null; appliedAt?: string | null; report?: InspectionReportResponse;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  if (!json) return null;
  let decision: { FinalLateReturnFee?: number; FinalExcessMileageFee?: number; AdditionalSurchargeAdjustments?: { TermId: number; FinalAmount: number }[]; RefundExternalPaymentsToWallet?: boolean };
  try { decision = JSON.parse(json); } catch { return null; }
  return <View style={{ padding: 12, borderRadius: 10, gap: 6, backgroundColor: theme.surfaceAlt }}>
    <Text style={{ color: theme.text, fontWeight: "700" }}>{t("mobile:dispute.summary.title")}</Text>
    <Text style={{ color: theme.text }}>{t("disputes:detail.lateReturn")} {formatDisputeMoney(decision.FinalLateReturnFee ?? 0)}</Text>
    {decision.FinalExcessMileageFee != null ? <Text style={{ color: theme.text }}>{t("disputes:detail.excessKm")} {formatDisputeMoney(decision.FinalExcessMileageFee)}</Text> : null}
    {(decision.AdditionalSurchargeAdjustments ?? []).map(fee => <Text key={fee.TermId} style={{ color: theme.text }}>{report?.additionalSurcharges?.find(f => f.termId === fee.TermId)?.name ?? t("mobile:dispute.summary.surcharge", { id: fee.TermId })}: {formatDisputeMoney(fee.FinalAmount)}</Text>)}
    {decision.RefundExternalPaymentsToWallet ? <Text style={{ color: theme.muted }}>{t("mobile:dispute.summary.refundNote")}</Text> : null}
    <Text style={{ color: appliedAt ? theme.success : theme.muted }}>{appliedAt ? t("mobile:dispute.summary.appliedAt", { date: formatDisputeDateTime(appliedAt) }) : t("mobile:dispute.summary.pending")}</Text>
  </View>;
}
