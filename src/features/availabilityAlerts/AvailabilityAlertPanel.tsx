import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { BellRing } from "lucide-react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import { formatPeriodSummary } from "@/features/vehicles/utils/rentalPeriod";
import { getApiErrorMessage } from "@/services/apiClient";
import { alertPeriodError, registerAvailabilityAlert } from "./availabilityAlertService";
import { openAvailabilityAlerts } from "./alertNavigation";

export default function AvailabilityAlertPanel({ vehicleId, ownerId, startDate, endDate }: {
  vehicleId: number; ownerId: number; startDate: string; endDate: string;
}) {
  const { theme } = useTheme(); const user = useAuthStore(s => s.user);
  const [open, setOpen] = useState(false), [picker, setPicker] = useState(false);
  const [start, setStart] = useState(startDate), [end, setEnd] = useState(endDate);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  const version = useRef(0);
  useEffect(() => { version.current++; }, [vehicleId, start, end, user?.userId]);
  useEffect(() => { setStart(startDate); setEnd(endDate); setSaved(false); setError(""); }, [vehicleId, startDate, endDate, user?.userId]);
  if (!user || user.userId === ownerId || !user.roles.some(r => r === "Customer" || r === "Owner")) return null;
  const button = { minHeight: 44, justifyContent: "center" as const, padding: 12, borderRadius: 12, backgroundColor: theme.surface };
  return <View style={{ marginVertical: 12, padding: 14, borderRadius: 16, gap: 12, backgroundColor: theme.brandSoft, borderColor: theme.brandBorder, borderWidth: 1 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 }}>
      <BellRing size={20} color={theme.brand} /><AppText style={{ color: theme.brand, fontWeight: "700", flex: 1 }}>Nhận thông báo khi xe trống</AppText>
    </Pressable>
    {open && <>
      <AppText style={{ color: theme.text, fontSize: 13 }}>Chọn ngày giờ mong muốn, kể cả khi xe bận. MoveVN báo trong app một lần khi cả khoảng thuê trống. Thông báo không giữ chỗ.</AppText>
      <Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={button}><AppText style={{ color: theme.text }}>{formatPeriodSummary(start, end)}</AppText><AppText style={{ color: theme.brand, fontSize: 12 }}>Chạm để chọn lịch · Giờ Việt Nam</AppText></Pressable>
      {error ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</AppText> : null}
      {saved ? <AppText accessibilityRole="alert" style={{ color: theme.success }}>Đã đăng ký theo dõi khoảng thuê này.</AppText> : <Pressable accessibilityRole="button" disabled={busy || !start || !end} style={[button, { backgroundColor: theme.brand, opacity: busy || !start || !end ? 0.5 : 1 }]} onPress={async () => {
        const validation = alertPeriodError(start, end);
        if (validation) { setError(validation); return; }
        const expectedVersion = version.current;
        setBusy(true); setError("");
        try { const item = await registerAvailabilityAlert(vehicleId, start, end); if (expectedVersion === version.current) setSaved(item.status === "Active"); }
        catch (e) { if (expectedVersion === version.current) setError(getApiErrorMessage(e, "Không đăng ký được thông báo.")); } finally { setBusy(false); }
      }}>{busy ? <ActivityIndicator color={theme.onBrand} /> : <AppText style={{ color: theme.onBrand, fontWeight: "700", textAlign: "center" }}>Đăng ký theo dõi</AppText>}</Pressable>}
      <Pressable accessibilityRole="button" onPress={() => openAvailabilityAlerts()} style={button}><AppText style={{ color: theme.brand, fontWeight: "600" }}>Xem và hủy đăng ký của tôi →</AppText></Pressable>
    </>}
    <RentalPeriodSheet visible={picker} startDate={start} endDate={end} onStartDateChange={v => { setStart(v); setSaved(false); setError(""); }} onEndDateChange={v => { setEnd(v); setSaved(false); setError(""); }} onClose={() => setPicker(false)} />
  </View>;
}
