import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, ChevronDown, ChevronUp, Crosshair, ListOrdered, Navigation, TriangleAlert } from "lucide-react-native";
import AppText from "@/components/AppText";
import { translatedLabels } from "@/i18n/liveLabels";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getGpsAddress, getGpsLivePosition, getGpsRoute, requestGpsEnable } from "../gpsService";
import { useGpsConnection } from "../useGpsConnection";
import { useGpsStore } from "../gpsStore";
import { buildTrackingMapHtml } from "../components/trackingMapHtml";
import { formatLogTime, mergeLogPoints, rewindPath, type GpsLogPoint } from "../gpsLogPoints";
import type { GpsLiveState, GpsRoutePointResponse } from "../types";
type TrackingRoute = RouteProp<OwnerBookingsStackParamList, "OwnerTracking">;
type TrackingNav = NativeStackNavigationProp<OwnerBookingsStackParamList>;

// Nhãn trạng thái resolve mỗi lần đọc để đổi theo ngôn ngữ đang chọn.
const STATE_LABEL: Record<GpsLiveState, string> = translatedLabels<GpsLiveState>("mobile:gps", {
  live: "mobile:gps.tracking.status.live",
  stale: "mobile:gps.tracking.status.stale",
  ended: "mobile:gps.tracking.status.ended",
  none: "mobile:gps.tracking.status.none",
});

export default function GpsTrackingScreen({
  route,
  navigation,
}: {
  route: TrackingRoute;
  navigation: TrackingNav;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId, vehicleName } = route.params;
  const webRef = useRef<WebView<object>>(null);
  const routeFitRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [initial, setInitial] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [followed, setFollowed] = useState(true);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [logPoints, setLogPoints] = useState<GpsLogPoint[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  // Dòng log đang xem lại (null = đang theo dõi trực tiếp).
  const [inspect, setInspect] = useState<GpsLogPoint | null>(null);

  const { position, status, sharingState } = useGpsConnection(bookingId);

  // Vị trí + trạng thái lần đầu từ REST; sau đó SignalR (useGpsConnection) cập nhật liên tục.
  const loadInitial = useCallback(async () => {
    // Vào lại màn hình (hoặc đổi chuyến) thì luôn bắt đầu ở chế độ trực tiếp.
    setInspect(null);
    try {
      const [live, history] = await Promise.all([
        getGpsLivePosition(bookingId),
        getGpsRoute(bookingId).catch(() => [] as GpsRoutePointResponse[]),
      ]);
      setTrackingActive(live.trackingActive);
      useGpsStore.getState().setSharingState(bookingId, live.sharingState);
      useGpsStore.getState().setStatus(bookingId, live.state);
      if (live.latitude != null && live.longitude != null) {
        setInitial({ latitude: live.latitude, longitude: live.longitude });
      }
      if (!useGpsStore.getState().positions[bookingId] && live.lastUpdatedAt) {
        if (live.latitude != null && live.longitude != null) {
          useGpsStore.getState().setPosition(bookingId, {
            latitude: live.latitude,
            longitude: live.longitude,
            speedKmh: live.speedKmh,
            heading: live.heading,
            isMock: live.isMock,
            status: live.status,
            lastUpdatedAt: live.lastUpdatedAt,
          });
        }
      }
      setRouteCoords(history.map((point) => [point.latitude, point.longitude] as [number, number]));
      // Nhật ký toạ độ: gộp với điểm realtime đã về trước khi REST trả lời.
      setLogPoints((current) => mergeLogPoints(
        history.map((point) => ({
          timestamp: point.timestamp,
          latitude: point.latitude,
          longitude: point.longitude,
          speedKmh: point.speedKmh ?? null,
        })),
        current,
      ));
    } catch (error) {
      showAppAlert(t("mobile:gps.errorTitle"), getApiErrorMessage(error, t("mobile:gps.tracking.loadError")));
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  useFocusEffect(useCallback(() => { void loadInitial(); }, [loadInitial]));

  const state: GpsLiveState = status ?? (position ? "live" : "none");
  const shareLabel = sharingState === "paused"
    ? t("mobile:gps.tracking.status.sharingPaused")
    : sharingState === "declined"
      ? t("mobile:gps.tracking.status.sharingDeclined")
      : sharingState === "notShared" && state === "none"
        ? t("mobile:gps.tracking.status.notShared")
        : null;
  const stateColor = sharingState === "paused"
    ? theme.brand
    : sharingState === "declined" || sharingState === "notShared"
      ? theme.muted
      : state === "live" ? theme.success : state === "stale" ? theme.danger : theme.muted;
  const hint = sharingState === "paused"
    ? t("mobile:gps.tracking.sharingPausedHint")
    : sharingState === "declined"
      ? t("mobile:gps.tracking.sharingDeclinedHint")
      : sharingState === "notShared" && state === "none"
        ? t("mobile:gps.tracking.sharingNotSharedHint")
        : state === "stale"
          ? t("mobile:gps.tracking.staleHint")
          : state === "none"
            ? t("mobile:gps.tracking.noDataHint")
            : null;

  // Địa chỉ chi tiết: gọi Goong (cache server) khi có vị trí, chỉ fetch lại
  // khi di chuyển >~55m hoặc sau 60s để không spam API.
  const [address, setAddress] = useState<string | null>(null);
  const addressFetchRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const last = addressFetchRef.current;
    const movedFar = !last || Math.abs(position.latitude - last.lat) + Math.abs(position.longitude - last.lng) > 0.0005;
    const timedOut = !last || Date.now() - last.at > 60_000;
    if (!movedFar && !timedOut) return;
    addressFetchRef.current = { lat: position.latitude, lng: position.longitude, at: Date.now() };
    void getGpsAddress(bookingId, position.latitude, position.longitude)
      .then((value) => { if (value) setAddress(value); })
      .catch(() => undefined);
  }, [bookingId, position?.latitude, position?.longitude]);

  // Vị trí realtime từ SignalR: đẩy vào map mỗi khi đổi (tạm dừng khi đang xem lại quá khứ).
  useEffect(() => {
    if (!mapReady || !position || inspect) return;
    webRef.current?.injectJavaScript(
      `window.updatePosition(${position.latitude},${position.longitude},${JSON.stringify(
        state === "live" ? "" : state === "stale" ? "stale" : "ended",
      )}); true;`,
    );
  }, [mapReady, position?.latitude, position?.longitude, state, inspect]);

  // Vệt đường realtime: nối tiếp vào vệt lịch sử để trở lại trực tiếp không bị mất đoạn mới.
  useEffect(() => {
    if (!position) return;
    setRouteCoords((previous) => {
      const last = previous[previous.length - 1];
      if (last && Math.abs(last[0] - position.latitude) < 1e-6 && Math.abs(last[1] - position.longitude) < 1e-6) {
        return previous;
      }
      return [...previous, [position.latitude, position.longitude] as [number, number]];
    });
  }, [position?.latitude, position?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vệt đường: chỉ inject khi WebView đã sẵn sàng; fitBounds mỗi lần vẽ đầu, sau đó giữ zoom người dùng.
  useEffect(() => {
    if (!mapReady || inspect || routeCoords.length < 1) return;
    const fit = !routeFitRef.current;
    routeFitRef.current = true;
    webRef.current?.injectJavaScript(`window.setRoute(${JSON.stringify(routeCoords)},${fit}); true;`);
  }, [mapReady, routeCoords, inspect]);

  // Nhật ký toạ độ: thêm điểm mới ngay khi SignalR/REST cập nhật (bỏ qua trùng lặp).
  useEffect(() => {
    if (!position?.lastUpdatedAt) return;
    const next: GpsLogPoint = {
      timestamp: position.lastUpdatedAt,
      latitude: position.latitude,
      longitude: position.longitude,
      speedKmh: position.speedKmh ?? null,
      isMock: position.isMock,
    };
    setLogPoints((previous) => {
      const first = previous[0];
      if (first
        && Math.abs(Date.parse(first.timestamp) - Date.parse(next.timestamp)) < 1_000
        && Math.abs(first.latitude - next.latitude) < 1e-5
        && Math.abs(first.longitude - next.longitude) < 1e-5) {
        return previous;
      }
      return mergeLogPoints([next], previous);
    });
  }, [position?.lastUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady) return;
    webRef.current?.injectJavaScript(`window.setFollowed(${followed ? "true" : "false"}); true;`);
  }, [mapReady, followed]);

  // Tua ngược: cắt vệt tại mốc đã chọn; trở lại trực tiếp thì vẽ lại toàn bộ và bám xe.
  useEffect(() => {
    if (!mapReady) return;
    if (inspect) {
      const prefix = rewindPath(logPoints, inspect.timestamp);
      webRef.current?.injectJavaScript(
        `window.setRoute(${JSON.stringify(prefix)},false); window.setFollowed(false); window.showPoint(${inspect.latitude},${inspect.longitude}); true;`,
      );
      setFollowed(false);
      return;
    }
    webRef.current?.injectJavaScript(
      `window.clearPoint(); window.setFollowed(true);${position ? ` window.updatePosition(${position.latitude},${position.longitude},${JSON.stringify(
        state === "live" ? "" : state === "stale" ? "stale" : "ended",
      )});` : ""} true;`,
    );
    setFollowed(true);
  }, [mapReady, inspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastUpdated = position?.lastUpdatedAt
    ? new Date(position.lastUpdatedAt).toLocaleTimeString("vi-VN")
    : null;

  const onRequestGps = useCallback(async () => {
    setRequesting(true);
    try {
      await requestGpsEnable(bookingId);
      showAppAlert(t("mobile:gps.tracking.requestSentTitle"), t("mobile:gps.tracking.requestSentBody"));
    } catch (error) {
      showAppAlert(t("mobile:gps.errorTitle"), getApiErrorMessage(error, t("mobile:gps.tracking.requestError")));
    } finally {
      setRequesting(false);
    }
  }, [bookingId, t]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => goBackOrFallback(navigation, () => navigation.navigate("OwnerBookingList"))} style={styles.backButton} accessibilityLabel={t("mobile:gps.backAria")}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <AppText numberOfLines={1} style={styles.headerTitle}>
          {t("mobile:gps.tracking.title", { name: vehicleName || t("mobile:gps.bookingFallback", { id: bookingId }) })}
        </AppText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.mapWrap}>
        <WebView<object>
          ref={webRef}
          source={{ html: buildTrackingMapHtml(initial, theme.brand, theme.surfaceAlt) }}
          style={styles.map}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event: WebViewMessageEvent) => {
            try {
              const message: unknown = JSON.parse(event.nativeEvent.data);
              if (message && typeof message === "object" && "type" in message && message.type === "ready") {
                setMapReady(true);
              } else if (message && typeof message === "object" && "type" in message && message.type === "drag") {
                setFollowed(false);
              }
            } catch {
              // Bỏ qua message không liên quan.
            }
          }}
        />
        {loading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={theme.brand} />
            <AppText style={styles.loadingText}>{t("mobile:gps.tracking.loading")}</AppText>
          </View>
        ) : null}
        <Pressable
          style={styles.recenter}
          accessibilityLabel={t("mobile:gps.tracking.recenterAria")}
          onPress={() => {
            // Bấm về vị trí xe = thoát chế độ xem lại và bám lại realtime.
            setInspect(null);
            setFollowed(true);
            if (position && mapReady) {
              webRef.current?.injectJavaScript(`window.updatePosition(${position.latitude},${position.longitude},null); true;`);
            }
          }}
        >
          <Crosshair size={19} color={theme.brand} />
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
          <AppText style={[styles.statusText, { color: stateColor }]}>{shareLabel ?? STATE_LABEL[state]}</AppText>
          {lastUpdated ? <AppText style={styles.lastUpdated}>{t("mobile:gps.tracking.updatedAt", { time: lastUpdated })}</AppText> : null}
        </View>
        {position?.speedKmh != null ? (
          <AppText style={styles.speedText}>{t("mobile:gps.tracking.speed", { speed: Math.round(position.speedKmh) })}</AppText>
        ) : null}
        {state !== "none" && (address || (position?.latitude != null && position?.longitude != null)) ? (
          <AppText numberOfLines={2} style={styles.addressText}>
            {address ?? t("mobile:gps.tracking.coordinates", { lat: position?.latitude.toFixed(5), lng: position?.longitude.toFixed(5) })}
          </AppText>
        ) : null}
        {hint ? (
          <AppText style={styles.staleHint}>{hint}</AppText>
        ) : null}
        {position?.isMock ? (
          <View style={styles.mockWarning}>
            <TriangleAlert size={14} color={theme.brand} />
            <AppText style={styles.mockWarningText}>{t("mobile:gps.tracking.mockWarning")}</AppText>
          </View>
        ) : null}
        {trackingActive && state !== "live" && state !== "ended" ? (
          <Pressable style={[styles.requestButton, requesting && styles.requestButtonDisabled]} onPress={() => void onRequestGps()} disabled={requesting} accessibilityLabel={t("mobile:gps.tracking.requestGps")}>
            <Navigation size={17} color={theme.onBrand} />
            <AppText style={styles.requestButtonText}>{requesting ? t("mobile:gps.tracking.requesting") : t("mobile:gps.tracking.requestGps")}</AppText>
          </Pressable>
        ) : null}

        {inspect ? (
          <View style={styles.inspectBanner}>
            <View style={styles.inspectInfo}>
              <AppText style={styles.inspectTitle}>
                {t("mobile:gps.tracking.log.viewing", { time: formatLogTime(inspect.timestamp) })}
              </AppText>
              <AppText numberOfLines={1} style={styles.inspectMeta}>
                {inspect.latitude.toFixed(5)}, {inspect.longitude.toFixed(5)}
                {inspect.speedKmh != null
                  ? ` · ${t("mobile:gps.tracking.log.speed", { speed: Math.round(inspect.speedKmh) })}`
                  : ""}
              </AppText>
            </View>
            <Pressable
              onPress={() => setInspect(null)}
              style={styles.liveButton}
              accessibilityRole="button"
              accessibilityLabel={t("mobile:gps.tracking.log.backToLive")}
            >
              <Crosshair size={13} color={theme.onBrand} />
              <AppText style={styles.liveButtonText}>{t("mobile:gps.tracking.log.backToLive")}</AppText>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => setLogExpanded((value) => !value)}
          style={styles.logToggle}
          accessibilityRole="button"
          accessibilityLabel={t("mobile:gps.tracking.log.toggleAria")}
        >
          <ListOrdered size={15} color={theme.text} />
          <AppText style={styles.logTitle}>{t("mobile:gps.tracking.log.title")}</AppText>
          <AppText style={styles.logCount}>{t("mobile:gps.tracking.log.count", { count: logPoints.length })}</AppText>
          {logExpanded ? <ChevronUp size={16} color={theme.muted} /> : <ChevronDown size={16} color={theme.muted} />}
        </Pressable>
        {logExpanded ? (
          logPoints.length === 0 ? (
            <AppText style={styles.logEmpty}>{t("mobile:gps.tracking.log.empty")}</AppText>
          ) : (
            <>
              <AppText style={styles.logHint}>{t("mobile:gps.tracking.log.selectHint")}</AppText>
              <FlatList
                style={styles.logList}
                contentContainerStyle={styles.logListContent}
                data={logPoints}
                keyExtractor={(item) => item.timestamp}
                initialNumToRender={12}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                renderItem={({ item: point }) => {
                  const selected = inspect?.timestamp === point.timestamp;
                  return (
                    <Pressable
                      onPress={() => setInspect((current) => (current?.timestamp === point.timestamp ? null : point))}
                      style={[styles.logRow, selected && styles.logRowSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${formatLogTime(point.timestamp)} ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                      accessibilityHint={t("mobile:gps.tracking.log.selectHint")}
                    >
                      <AppText style={styles.logTime}>{formatLogTime(point.timestamp)}</AppText>
                      <AppText numberOfLines={1} style={styles.logCoords}>
                        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                      </AppText>
                      {point.isMock ? (
                        <View style={styles.logMock}>
                          <TriangleAlert size={11} color={theme.brand} />
                          <AppText style={styles.logMockText}>{t("mobile:gps.tracking.log.mock")}</AppText>
                        </View>
                      ) : null}
                      <AppText style={styles.logSpeed}>
                        {point.speedKmh != null ? t("mobile:gps.tracking.log.speed", { speed: Math.round(point.speedKmh) }) : "—"}
                      </AppText>
                    </Pressable>
                  );
                }}
              />
            </>
          )
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface },
  backButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: theme.text, fontSize: 15, fontWeight: "800" },
  mapWrap: { flex: 1, backgroundColor: theme.surfaceAlt },
  map: { flex: 1 },
  loadingBadge: { position: "absolute", top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.surface, elevation: 2 },
  loadingText: { color: theme.text, fontSize: 12, fontWeight: "700" },
  recenter: { position: "absolute", right: 14, bottom: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", elevation: 3 },
  footer: { backgroundColor: theme.surface, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: "800" },
  lastUpdated: { color: theme.muted, fontSize: 12 },
  speedText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  addressText: { color: theme.text, fontSize: 13 },
  staleHint: { color: theme.muted, fontSize: 12 },
  mockWarning: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  mockWarningText: { flex: 1, color: theme.brand, fontSize: 12 },
  requestButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 12 },
  requestButtonDisabled: { opacity: 0.6 },
  requestButtonText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  logToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, borderTopWidth: 1, borderTopColor: theme.divider },
  logTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
  logCount: { flex: 1, color: theme.muted, fontSize: 11 },
  logEmpty: { color: theme.muted, fontSize: 12, paddingBottom: 4 },
  logHint: { color: theme.muted, fontSize: 11, paddingBottom: 4 },
  logList: { maxHeight: 168 },
  logListContent: { paddingBottom: 2 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
  logRowSelected: { backgroundColor: theme.brandSoft },
  logTime: { width: 58, color: theme.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  logCoords: { flex: 1, color: theme.text, fontSize: 11, fontVariant: ["tabular-nums"] },
  logMock: { flexDirection: "row", alignItems: "center", gap: 2 },
  logMockText: { color: theme.brand, fontSize: 9, fontWeight: "700" },
  logSpeed: { width: 52, textAlign: "right", color: theme.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  inspectBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", paddingHorizontal: 10, paddingVertical: 8 },
  inspectInfo: { flex: 1, gap: 1 },
  inspectTitle: { color: "#92400e", fontSize: 12, fontWeight: "800" },
  inspectMeta: { color: "#92400e", fontSize: 11, fontVariant: ["tabular-nums"] },
  liveButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.brand, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  liveButtonText: { color: theme.onBrand, fontSize: 11, fontWeight: "800" },
});
