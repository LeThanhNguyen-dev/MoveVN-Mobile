import Text from "@/components/AppText";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AlertTriangle, ShieldCheck } from "lucide-react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

// Port RN của FrontEnd RiskScoreBadge: Low xanh lá, Medium vàng, High đỏ.
export type RiskLevel = "Low" | "Medium" | "High" | "Unknown";

export function getRiskLevel(score?: number | null): RiskLevel {
  if (score === null || score === undefined || !Number.isFinite(score)) return "Unknown";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";
  return "Low";
}

export default function RiskScoreBadge({ score }: { score?: number | null }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const level = getRiskLevel(score);
  const label = level === "Unknown" ? "Chưa đánh giá" : `${Math.round(score!)}/100`;
  const Icon = level === "Low" ? ShieldCheck : AlertTriangle;
  const tone =
    level === "Low" ? styles.low : level === "Medium" ? styles.medium : level === "High" ? styles.high : styles.unknown;
  const iconColor =
    level === "Low" ? theme.success : level === "Medium" ? "#D97706" : level === "High" ? theme.danger : theme.muted;
  return (
    <View accessibilityLabel={level === "Unknown" ? "Chưa đánh giá rủi ro" : `Điểm rủi ro: ${label}`} style={[styles.pill, tone]}>
      <Icon color={iconColor} size={13} />
      <Text style={[styles.text, { color: iconColor }]}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    low: { backgroundColor: theme.successSoft, borderColor: theme.success },
    medium: { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
    high: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder },
    unknown: { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
    text: { fontSize: 12, fontWeight: "800" },
  });
