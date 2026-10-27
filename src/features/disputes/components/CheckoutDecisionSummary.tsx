import Text from "@/components/AppText";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { formatDisputeMoney, formatDisputeDateTime } from "./disputeLabels";
import type { InspectionReportResponse } from "@/features/booking/types";

export default function CheckoutDecisionSummary({ json, appliedAt, report }: {
  json?: string | null; appliedAt?: string | null; report?: InspectionReportResponse;
}) {
  const { theme } = useTheme();
  if (!json) return null;
  let decision: { FinalLateReturnFee?: number; FinalExcessMileageFee?: number; AdditionalSurchargeAdjustments?: { TermId: number; FinalAmount: number }[]; RefundExternalPaymentsToWallet?: boolean };
  try { decision = JSON.parse(json); } catch { return null; }
  return <View style={{ padding: 12, borderRadius: 10, gap: 6, backgroundColor: theme.surfaceAlt }}>
    <Text style={{ color: theme.text, fontWeight: "700" }}>Phụ thu theo quyết định</Text>
    <Text style={{ color: theme.text }}>Trả trễ: {formatDisputeMoney(decision.FinalLateReturnFee ?? 0)}</Text>
    {decision.FinalExcessMileageFee != null ? <Text style={{ color: theme.text }}>Vượt km: {formatDisputeMoney(decision.FinalExcessMileageFee)}</Text> : null}
    {(decision.AdditionalSurchargeAdjustments ?? []).map(fee => <Text key={fee.TermId} style={{ color: theme.text }}>{report?.additionalSurcharges?.find(f => f.termId === fee.TermId)?.name ?? "Phụ thu #" + fee.TermId}: {formatDisputeMoney(fee.FinalAmount)}</Text>)}
    {decision.RefundExternalPaymentsToWallet ? <Text style={{ color: theme.muted }}>Phần chênh lệch đã trả trực tiếp được hoàn từ ví chủ xe vào ví khách.</Text> : null}
    <Text style={{ color: appliedAt ? theme.success : theme.muted }}>{appliedAt ? "Đã áp dụng: " + formatDisputeDateTime(appliedAt) : "Chờ quyết định có hiệu lực; chưa điều chỉnh hoặc hoàn tiền."}</Text>
  </View>;
}
