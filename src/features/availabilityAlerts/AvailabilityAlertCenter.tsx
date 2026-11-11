import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { NavigationContainer, NavigationIndependentTree, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BellRing, X } from "lucide-react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import { getSessionGeneration, useAuthStore } from "@/features/auth/hooks/useAuth";
import type { ExploreStackParamList } from "@/navigation/types";
import VehicleDetailScreen from "@/features/vehicles/screens/VehicleDetailScreen";
import CreateBookingScreen from "@/features/booking/screens/CreateBookingScreen";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import { getApiErrorMessage } from "@/services/apiClient";
import { alertStatusLabels, cancelAvailabilityAlert, formatAlertDate, listAvailabilityAlerts, type AvailabilityAlert } from "./availabilityAlertService";
import { closeAvailabilityAlerts, localRentalDate, useAlertNavigation, type AlertVehicleTarget } from "./alertNavigation";

const Stack = createNativeStackNavigator<ExploreStackParamList>();
export default function AvailabilityAlertCenter({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const entry = useAlertNavigation(s => s.entry), user = useAuthStore(s => s.user), role = useAuthStore(s => s.activeRole);
  const { theme } = useTheme();
  useEffect(() => () => closeAvailabilityAlerts(), []);
  const visible = !!entry && entry.userId === userId && entry.generation === getSessionGeneration() && (role === "Customer" || role === "Owner");
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeAvailabilityAlerts}>
    {visible && entry && <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}><AppText display style={{ color: theme.brand, fontSize: 18, fontWeight: "700" }}>{t("mobile:availabilityAlerts.center.title")}</AppText><Pressable accessibilityLabel={t("mobile:availabilityAlerts.center.closeAria")} accessibilityRole="button" onPress={closeAvailabilityAlerts} style={{ padding: 14 }}><X size={23} color={theme.text} /></Pressable></View>
      <NavigationIndependentTree><NavigationContainer><Stack.Navigator key={entry.serial} initialRouteName={entry.vehicle ? "VehicleDetail" : "ExploreMain"} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="ExploreMain">{props => <AlertList onOpen={target => props.navigation.navigate("VehicleDetail", target)} />}</Stack.Screen>
        <Stack.Screen name="VehicleDetail" initialParams={entry.vehicle}>{props => <VehicleDetailScreen {...props} onBookPress={user?.roles.includes("Customer") ? p => props.navigation.navigate("CreateBooking", p) : undefined} />}</Stack.Screen>
        <Stack.Screen name="CreateBooking">{props => <CreateBookingScreen {...props} onCreated={bookingId => {
          closeAvailabilityAlerts();
          void useAuthStore.getState().setActiveRole("Customer");
          usePushNavigation.setState({ pending: { bookingId, userId, roleTarget: "Customer", requestId: `availability-${bookingId}` } });
        }} />}</Stack.Screen>
      </Stack.Navigator></NavigationContainer></NavigationIndependentTree>
    </SafeAreaView></SafeAreaProvider>}
  </Modal>;
}

function AlertList({ onOpen }: { onOpen: (target: AlertVehicleTarget) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [items, setItems] = useState<AvailabilityAlert[]>([]);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [busy, setBusy] = useState<number | null>(null), [error, setError] = useState("");
  useFocusEffect(useCallback(() => { setRevision(v => v + 1); }, []));
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    listAvailabilityAlerts(page).then(data => { if (active) { setItems(data.items); setTotal(data.totalCount); } })
      .catch(e => { if (active) setError(getApiErrorMessage(e, t("mobile:availabilityAlerts.list.loadError"))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, revision, t]);
  const button = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.brandSoft };
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision(v => v + 1)} tintColor={theme.brand} />}>
    <AppText style={{ color: theme.muted }}>{t("mobile:availabilityAlerts.list.intro")}</AppText>
    {error ? <View><AppText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</AppText><Pressable style={button} onPress={() => setRevision(v => v + 1)}><AppText style={{ color: theme.brand }}>{t("common:retry")}</AppText></Pressable></View> : null}
    {loading && !items.length ? <ActivityIndicator color={theme.brand} /> : null}
    {!loading && !error && !items.length ? <View style={{ alignItems: "center", padding: 30, gap: 12 }}><BellRing size={34} color={theme.brand} /><AppText style={{ color: theme.text, textAlign: "center" }}>{t("mobile:availabilityAlerts.list.empty")}</AppText></View> : null}
    {items.map(item => <View key={item.id} style={{ padding: 16, borderRadius: 16, gap: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
      <AppText display style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>{item.vehicleName}</AppText><AppText style={{ color: theme.muted }}>{item.licensePlate}</AppText>
      <AppText style={{ color: theme.text }}>{formatAlertDate(item.startDate)} → {formatAlertDate(item.endDate)}</AppText>
      <AppText style={{ color: item.status === "Active" ? theme.brand : item.status === "Notified" ? theme.success : theme.muted, fontWeight: "700" }}>{alertStatusLabels[item.status]}</AppText>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Pressable accessibilityRole="button" onPress={() => onOpen({ vehicleId: item.vehicleId, startDate: localRentalDate(item.startDate), endDate: localRentalDate(item.endDate) })} style={button}><AppText style={{ color: theme.brand, fontWeight: "600" }}>{t("mobile:availabilityAlerts.list.viewVehicle")}</AppText></Pressable>
        {item.status === "Active" ? <Pressable accessibilityRole="button" disabled={busy !== null} style={button} onPress={async () => {
          setBusy(item.id); setError("");
          try { await cancelAvailabilityAlert(item.id); setRevision(v => v + 1); } catch (e) { setError(getApiErrorMessage(e, t("mobile:availabilityAlerts.list.cancelError"))); } finally { setBusy(null); }
        }}>{busy === item.id ? <ActivityIndicator color={theme.brand} /> : <AppText style={{ color: theme.danger, fontWeight: "600" }}>{t("mobile:availabilityAlerts.list.unwatch")}</AppText>}</Pressable> : null}
      </View>
    </View>)}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}><Pressable disabled={loading || page <= 1} onPress={() => setPage(v => v - 1)} style={[button, { opacity: page <= 1 ? 0.4 : 1 }]}><AppText style={{ color: theme.brand }}>{t("common:previousPage")}</AppText></Pressable><AppText style={{ color: theme.text }}>{page} / {Math.max(1, Math.ceil(total / 20))}</AppText><Pressable disabled={loading || page * 20 >= total} onPress={() => setPage(v => v + 1)} style={[button, { opacity: page * 20 >= total ? 0.4 : 1 }]}><AppText style={{ color: theme.brand }}>{t("common:nextPage")}</AppText></Pressable></View>
  </ScrollView>;
}
