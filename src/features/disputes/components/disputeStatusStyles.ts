import type { Theme } from "@/theme/tokens";

export type StatusStyle = { bg: string; text: string; border: string; dot: string };

// Bảng màu bám đúng web DisputePage (DisputePage.tsx statusColors):
// Open=blue, Investigating=amber, NeedMoreEvidence=orange,
// DecisionIssued=cyan, AwaitingExternalSettlement=fuchsia,
// Escalated=violet, Resolved=emerald.
const LIGHT_STYLES: Record<string, StatusStyle> = {
  Open: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", dot: "#2563EB" },
  Investigating: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", dot: "#D97706" },
  NeedMoreEvidence: { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74", dot: "#EA580C" },
  DecisionIssued: { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC", dot: "#0891B2" },
  AwaitingExternalSettlement: { bg: "#FDF4FF", text: "#A21CAF", border: "#F0ABFC", dot: "#C026D3" },
  Escalated: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE", dot: "#7C3AED" },
  Resolved: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "#059669" },
};

const DARK_STYLES: Record<string, StatusStyle> = {
  Open: { bg: "#1E3A8A33", text: "#93C5FD", border: "#3B82F655", dot: "#60A5FA" },
  Investigating: { bg: "#78350F33", text: "#FCD34D", border: "#D9770655", dot: "#FBBF24" },
  NeedMoreEvidence: { bg: "#7C2D1233", text: "#FDBA74", border: "#EA580C55", dot: "#FB923C" },
  DecisionIssued: { bg: "#164E6333", text: "#67E8F9", border: "#0891B255", dot: "#22D3EE" },
  AwaitingExternalSettlement: { bg: "#701A7533", text: "#F0ABFC", border: "#C026D355", dot: "#E879F9" },
  Escalated: { bg: "#4C1D9533", text: "#C4B5FD", border: "#7C3AED55", dot: "#A78BFA" },
  Resolved: { bg: "#064E3B33", text: "#6EE7B7", border: "#05966955", dot: "#34D399" },
};

const FALLBACK_LIGHT: StatusStyle = { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", dot: "#64748B" };
const FALLBACK_DARK: StatusStyle = { bg: "#2A244233", text: "#ABA2C9", border: "#342C52", dot: "#6E6591" };

// Màu cho trạng thái hồ sơ phạt nguội — cùng họ màu để phân biệt nhanh.
const FINE_LIGHT: Record<string, StatusStyle> = {
  Submitted: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", dot: "#2563EB" },
  AwaitingCustomerResponse: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", dot: "#D97706" },
  ResponsibilityDisputed: { bg: "#FFF7ED", text: "#C2410C", border: "#FDBA74", dot: "#EA580C" },
  AwaitingPayment: { bg: "#FDF4FF", text: "#A21CAF", border: "#F0ABFC", dot: "#C026D3" },
  PaymentProofSubmitted: { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC", dot: "#0891B2" },
  Resolved: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "#059669" },
  Rejected: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", dot: "#DC2626" },
};

const FINE_DARK: Record<string, StatusStyle> = {
  Submitted: { bg: "#1E3A8A33", text: "#93C5FD", border: "#3B82F655", dot: "#60A5FA" },
  AwaitingCustomerResponse: { bg: "#78350F33", text: "#FCD34D", border: "#D9770655", dot: "#FBBF24" },
  ResponsibilityDisputed: { bg: "#7C2D1233", text: "#FDBA74", border: "#EA580C55", dot: "#FB923C" },
  AwaitingPayment: { bg: "#701A7533", text: "#F0ABFC", border: "#C026D355", dot: "#E879F9" },
  PaymentProofSubmitted: { bg: "#164E6333", text: "#67E8F9", border: "#0891B255", dot: "#22D3EE" },
  Resolved: { bg: "#064E3B33", text: "#6EE7B7", border: "#05966955", dot: "#34D399" },
  Rejected: { bg: "#7F1D1D33", text: "#FCA5A5", border: "#DC262655", dot: "#F87171" },
};

export function getDisputeStatusStyle(status: string, mode: Theme["mode"]): StatusStyle {
  const table = mode === "dark" ? DARK_STYLES : LIGHT_STYLES;
  return table[status] ?? (mode === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT);
}

export function getFineStatusStyle(status: string, mode: Theme["mode"]): StatusStyle {
  const table = mode === "dark" ? FINE_DARK : FINE_LIGHT;
  return table[status] ?? (mode === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT);
}
