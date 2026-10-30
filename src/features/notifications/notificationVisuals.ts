import type { Theme } from "@/theme/tokens";
import type { NotificationItem } from "./types";
import { notificationCategory } from "./notificationPresentation";

const palettes = {
  blue: { light: ["#2563EB", "#EFF6FF"], dark: ["#93C5FD", "#1B2D4B"] },
  green: { light: ["#047857", "#ECFDF5"], dark: ["#6EE7B7", "#123B2E"] },
  purple: { light: ["#7C3AED", "#F3EDFF"], dark: ["#C4B5FD", "#30234E"] },
  orange: { light: ["#B45309", "#FFF7ED"], dark: ["#FDBA74", "#422C1D"] },
  red: { light: ["#BE123C", "#FFF1F2"], dark: ["#FDA4AF", "#432134"] },
  teal: { light: ["#0F766E", "#F0FDFA"], dark: ["#5EEAD4", "#173C3A"] },
  slate: { light: ["#475569", "#F1F5F9"], dark: ["#CBD5E1", "#293247"] },
} as const;

/** UI-only mapping; delivery and navigation still use the original notification type. */
export function notificationVisuals(item: NotificationItem, theme: Theme) {
  const type = item.type.toLowerCase();
  const category = notificationCategory(item.type);
  let reminder = "";
  try {
    const data: unknown = JSON.parse(item.dataJson ?? "null");
    if (data && typeof data === "object" && "reminderType" in data && typeof data.reminderType === "string") {
      reminder = data.reminderType.toLowerCase();
    }
  } catch { /* Older notifications may not have JSON metadata. */ }
  const title = item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const urgent = /overdue|deadlineexceeded|slaexpired/.test(`${type} ${reminder}`)
    || /qua han|tre han/.test(title);
  const contract = type.includes("contract");
  const dispute = type.includes("dispute");
  const violation = type.includes("violation");
  const tone = urgent ? "red" : contract ? "purple" : dispute || violation ? "orange"
    : ({ booking: "blue", wallet: "green", support: "orange", vehicle: "teal",
      message: "purple", system: "slate" } as const)[category.icon];
  const [color, background] = palettes[tone][theme.mode];
  return {
    color, background, urgent,
    label: contract ? "Hợp đồng" : dispute ? "Tranh chấp" : violation ? "Báo cáo vi phạm" : category.label,
    icon: contract ? "contract" as const : dispute ? "dispute" as const : violation ? "violation" as const : category.icon,
  };
}
