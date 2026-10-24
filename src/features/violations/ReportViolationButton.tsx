import { Flag } from "lucide-react-native";
import { Pressable } from "react-native";
import AppText from "@/components/AppText";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import type { ViolationTarget } from "./types";
import { canReport, openViolations } from "./violationNavigation";

export default function ReportViolationButton({ target }: { target: ViolationTarget }) {
  useAuthStore(s => s.user); useAuthStore(s => s.activeRole);
  const { theme } = useTheme();
  if (!canReport(target)) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Báo cáo vi phạm: ${target.label}`} onPress={() => openViolations({ target })} style={{ minHeight: 44, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}><Flag color={theme.mode === "dark" ? "#FDBA74" : "#C2410C"} size={18} /><AppText style={{ color: theme.mode === "dark" ? "#FDBA74" : "#C2410C", fontSize: 13, fontWeight: "600" }}>Báo cáo vi phạm</AppText></Pressable>;
}
