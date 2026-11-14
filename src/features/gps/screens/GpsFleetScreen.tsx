import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { ArrowLeft, Clock3, Crosshair, MapPin, Navigation, RefreshCw, TriangleAlert } from "lucide-react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useGpsStore } from "../gpsStore";
import { useFleetTracking } from "../useFleetTracking";
import { buildFleetMapHtml } from "../components/trackingMapHtml";
import type { GpsLiveState, GpsSharingState } from "../types";

type FleetRow = {
  bookingId: number;
  bookingCode: string;
  vehicleId: number;
  licensePlate: string | null;
  state: GpsLiveState;
  sharingState: GpsSharingState;
  latitude: number | null;
  longitude: number | null;
  lastUpdatedAt: string | null;
  isMock: boolean;
};

type FleetBadge = { labelKey: string; fg: string; bg: string; border: string };

/** Nhãn ưu tiên lý do khách chủ động dừng/từ chối hơn trạng thái mất tín hiệu. */
function fleetBadge(row: FleetRow, theme: Theme): FleetBadge {
  if (row.sharingState === "paused") {
    return { labelKey: "mobile:gps.fleet.sharing.paused", fg: theme.brand, bg: theme.brandSoft, border: theme.brandBorder };
  }
  if (row.state === "stale") {
    return { labelKey: "mobile:gps.fleet.state.stale", fg: theme.danger, bg: theme.dangerSoft, border: theme.dangerBorder };
  }
  if (row.sharingState === "declined") {
    return { labelKey: "mobile:gps.fleet.sharing.declined", fg: theme.muted, bg: theme.surfaceAlt, border: theme.border };
  }
  if (row.sharingState === "notShared" || row.state === "none") {
    return { labelKey: "mobile:gps.fleet.state.none", fg: theme.muted, bg: theme.surfaceAlt, border: theme.border };
  }
  if (row.state === "live") {
    return { labelKey: "mobile:gps.fleet.state.live", fg: theme.success, bg: theme.successSoft, border: theme.success };
  }
  return { labelKey: "mobile:gps.fleet.state.ended", fg: theme.muted, bg: theme.surfaceAlt, border: theme.border };
}

export default function GpsFleetScreen({
  onBack,
  onOpenTracking,
}: {
  onBack: () => void;
  onOpenTracking: (bookingId: number, vehicleName?: string) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const webRef = useRef<WebView<object>>(null);
  const [mapReady, setMapReady] = useState(false);
  const { items, loading, failed, updatedAt, refresh } = useFleetTracking();
  const positions = useGpsStore((state) => state.positions);
  const statuses = useGpsStore((state) => state.statuses);
  const sharingStates = useGpsStore((state) => state.sharingStates);

  const rows = useMemo<FleetRow[]>(() => items.map((item) => {
    const position = positions[item.bookingId];
    return {
      bookingId: item.bookingId,
      bookingCode: item.bookingCode,
      vehicleId: item.vehicleId,
      licensePlate: item.licensePlate ?? null,
      state: statuses[item.bookingId] ?? item.state,
      sharingState: sharingStates[item.bookingId] ?? item.sharingState,
      latitude: position?.latitude ?? item.latitude,
      longitude: position?.longitude ?? item.longitude,
      lastUpdatedAt: position?.lastUpdatedAt ?? item.lastUpdatedAt,
      isMock: position?.isMock ?? item.isMock ?? false,
    };
  }), [items, positions, statuses, sharingStates]);

  const mapVehicles = useMemo(
    () => rows
      .filter((row) => row.latitude != null && row.longitude != null)
      .map((row) => ({
        bookingId: row.bookingId,
        label: row.licensePlate || t("mobile:gps.fleet.vehicleFallback", { id: row.vehicleId }),
        latitude: row.latitude!,
        longitude: row.longitude!,
        state: row.state,
      })),
    [rows, t],
  );

  // Đẩy danh sách xe vào WebView mỗi khi vị trí/trạng thái đổi.
  useEffect(() => {
    if (!mapReady) return;
    webRef.current?.injectJavaScript(`window.setVehicles(${JSON.stringify(mapVehicles)}); true;`);
  }, [mapReady, mapVehicles]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message: unknown = JSON.parse(event.nativeEvent.data);
      if (!message || typeof message !== "object" || !("type" in message)) return;
      if (message.type === "ready") {
        setMapReady(true);
      } else if (message.type === "vehicle" && "bookingId" in message && typeof message.bookingId === "number") {
        const row = rows.find((item) => item.bookingId === message.bookingId);
        onOpenTracking(message.bookingId, row?.licensePlate ?? undefined);
      }
    } catch {
      // Bỏ qua message không liên quan.
    }
  }, [onOpenTracking, rows]);

  const lastUpdated = updatedAt ? new Date(updatedAt).toLocaleTimeString("vi-VN") : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton} accessibilityLabel={t("mobile:gps.backAria")}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <View style={styles.headerBody}>
          <AppText numberOfLines={1} style={styles.headerTitle}>{t("mobile:gps.fleet.title")}</AppText>
          <AppText numberOfLines={1} style={styles.headerSubtitle}>
            {lastUpdated
              ? t("mobile:gps.fleet.subtitle", { count: rows.length }) + " · " + t("mobile:gps.fleet.updatedAt", { time: lastUpdated })
              : t("mobile:gps.fleet.subtitle", { count: rows.length })}
          </AppText>
        </View>
        <Pressable onPress={() => void refresh()} style={styles.headerButton} accessibilityLabel={t("mobile:gps.fleet.refreshAria")}>
          {loading && rows.length > 0 ? <ActivityIndicator size="small" color={theme.brand} /> : <RefreshCw color={theme.text} size={19} />}
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <WebView<object>
          ref={webRef}
          source={{ html: buildFleetMapHtml(theme.brand, theme.surfaceAlt) }}
          style={styles.map}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
        {mapVehicles.length === 0 && !loading ? (
          <View pointerEvents="none" style={styles.mapEmpty}>
            <AppText style={styles.mapEmptyText}>
              {rows.length === 0 ? t("mobile:gps.fleet.empty") : t("mobile:gps.fleet.state.none")}
            </AppText>
          </View>
        ) : null}
        {mapVehicles.length > 0 ? (
          <Pressable
            style={styles.recenter}
            accessibilityLabel={t("mobile:gps.tracking.recenterAria")}
            onPress={() => webRef.current?.injectJavaScript("window.fitVehicles(); true;")}
          >
            <Crosshair size={19} color={theme.brand} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {loading && rows.length === 0 ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color={theme.brand} />
            <AppText style={styles.stateText}>{t("mobile:gps.fleet.loading")}</AppText>
          </View>
        ) : failed && rows.length === 0 ? (
          <View style={styles.stateBox}>
            <AppText style={[styles.stateText, { color: theme.danger }]}>{t("mobile:gps.fleet.error")}</AppText>
            <Pressable onPress={() => void refresh()} style={styles.retryButton}>
              <AppText style={styles.retryText}>{t("mobile:gps.fleet.retry")}</AppText>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <MapPin size={26} color={theme.faint} />
            <AppText style={styles.stateText}>{t("mobile:gps.fleet.empty")}</AppText>
          </View>
        ) : rows.map((row) => {
          const badge = fleetBadge(row, theme);
          const updated = row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toLocaleTimeString("vi-VN") : null;
          const outOfSignal = row.state === "stale" || row.sharingState === "paused";
          return (
            <Pressable
              key={row.bookingId}
              onPress={() => onOpenTracking(row.bookingId, row.licensePlate ?? undefined)}
              style={[styles.row, outOfSignal && styles.rowAlert]}
              accessibilityRole="button"
            >
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <AppText numberOfLines={1} style={styles.plate}>{row.licensePlate || t("mobile:gps.fleet.licensePlateUnknown")}</AppText>
                  <AppText numberOfLines={1} style={styles.bookingCode}>{t("mobile:gps.fleet.bookingCode", { code: row.bookingCode })}</AppText>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <View style={[styles.badgeDot, { backgroundColor: badge.fg }]} />
                  <AppText numberOfLines={1} style={[styles.badgeText, { color: badge.fg }]}>{t(badge.labelKey)}</AppText>
                </View>
              </View>
              <View style={styles.rowMeta}>
                {updated ? (
                  <View style={styles.metaItem}>
                    <Clock3 size={13} color={theme.muted} />
                    <AppText style={styles.metaText}>{t("mobile:gps.fleet.updatedAt", { time: updated })}</AppText>
                  </View>
                ) : null}
                {row.isMock ? (
                  <View style={styles.metaItem}>
                    <TriangleAlert size={13} color={theme.brand} />
                    <AppText style={[styles.metaText, { color: theme.brand }]}>{t("mobile:gps.fleet.mockWarning")}</AppText>
                  </View>
                ) : null}
                <View style={styles.metaItem}>
                  <Navigation size={13} color={theme.brand} />
                  <AppText style={[styles.metaText, { color: theme.brand }]}>{t("mobile:gps.fleet.viewTracking")}</AppText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface },
  headerButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  headerBody: { flex: 1, minWidth: 0 },
  headerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  headerSubtitle: { color: theme.muted, fontSize: 11, marginTop: 1 },
  mapWrap: { flex: 1, minHeight: 220, backgroundColor: theme.surfaceAlt },
  map: { flex: 1 },
  mapEmpty: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 24 },
  mapEmptyText: { color: theme.muted, fontSize: 12, textAlign: "center", backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, overflow: "hidden" },
  recenter: { position: "absolute", right: 14, bottom: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", elevation: 3 },
  list: { maxHeight: "44%", backgroundColor: theme.surface },
  listContent: { padding: 12, gap: 8 },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 22 },
  stateText: { color: theme.muted, fontSize: 12, textAlign: "center" },
  retryButton: { backgroundColor: theme.brandSoft, borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: theme.brand, fontSize: 12, fontWeight: "700" },
  row: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 14, padding: 11, gap: 7 },
  rowAlert: { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowTitleWrap: { flex: 1, minWidth: 0 },
  plate: { color: theme.text, fontSize: 13, fontWeight: "800" },
  bookingCode: { color: theme.muted, fontSize: 11, marginTop: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 170 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", flexShrink: 1 },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: theme.muted, fontSize: 11 },
});