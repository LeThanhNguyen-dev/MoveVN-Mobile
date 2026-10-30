import { Download } from "lucide-react-native";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { endpoints } from "@/services/endpoints";
import { getApiErrorMessage } from "@/services/apiClient";
import { downloadPdf } from "@/utils/pdfDownload";
import { DetailButton } from "./detail/BookingDetailUI";
import type { BookingResponse, InspectionReportResponse } from "../types";

export default function InspectionPdfButton({ booking, report }: { booking: BookingResponse; report: InspectionReportResponse }) {
  const { theme } = useTheme();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await downloadPdf(`${endpoints.bookings.byId(booking.id)}/inspection-reports/${report.id}/pdf`, `MoveVN-${booking.id}-${report.type}-v${report.version ?? 1}.pdf`); }
    catch (e) { setError(getApiErrorMessage(e, e instanceof Error ? e.message : "Không tải được PDF. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={{ gap: 6 }}>
    <DetailButton variant="secondary" icon={Download} label={`Tải PDF ${report.type === "CheckIn" ? "check-in" : "check-out"}`} busy={busy} onPress={() => void download()} />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontFamily: font.medium, fontSize: 10.5 }}>{error}</Text> : null}
  </View>;
}
