import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Crosshair, Navigation } from "lucide-react-native";
import AppText from "@/components/AppText";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getGpsAddress, getGpsLivePosition, getGpsRoute, requestGpsEnable } from "../gpsService";
import { useGpsConnection } from "../useGpsConnection";
import { useGpsStore } from "../gpsStore";
import { buildTrackingMapHtml } from "../components/trackingMapHtml";
import type { GpsLiveState, GpsRoutePointResponse } from "../types";

type TrackingRoute = RouteProp<OwnerBookingsStackParamList, "OwnerTracking">;
type TrackingNav = NativeStackNavigationProp<OwnerBookingsStackParamList>;

const STATE_LABEL: Record<GpsLiveState, string> = {
  live: "Đang cập nhật",
  stale: "Mất tín hiệu",
  ended: "Đã kết thúc",
  none: "Chưa có dữ liệu",
};

export default function GpsTrackingScreen({
  route,
  navigation,
}: {
  route: TrackingRoute;
  navigation: TrackingNav;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId, vehicleName } = route.params;
  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initial, setInitial] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [followed, setFollowed] = useState(true);

  const { position, status } = useGpsConnection(bookingId);

  // Vị trí + trạng thái lần đầu từ REST; sau đó SignalR (useGpsConnection) cập nhật liên tục.
  const loadInitial = useCallback(async () => {
    try {
      const [live, routePoints] = await Promise.all([
        getGpsLivePosition(bookingId),
        getGpsRoute(bookingId).catch(() => [] as GpsRoutePointResponse[]),
      ]);
      setTrackingActive(live.trackingActive);
      if (live.latitude != null && live.longitude != null) {
        setInitial({ latitude: live.latitude, longitude: live.longitude });
      }
      if (!useGpsStore.getState().positions[bookingId] && live.lastUpdatedAt) {
        useGpsStore.getState().setStatus(bookingId, live.state);
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
      if (routePoints.length >= 2) {
        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        await delay(400); // đợi map JS sẵn sàng
        webRef.current?.injectJavaScript(
          `window.setRoute(${JSON.stringify(routePoints.map((point) => [point.latitude, point.longitude]))}); true;`,
        );
      }
    } catch (error) {
      Alert.alert("Lỗi", getApiErrorMessage(error, "Không tải được vị trí xe."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { void loadInitial(); }, [loadInitial]));

  const state: GpsLiveState = status ?? (position ? "live" : "none");
  const stateColor = state === "live" ? theme.success : state === "stale" ? theme.danger : theme.muted;

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

  // Vị trí realtime từ SignalR: đẩy vào map mỗi khi đổi.
  useEffect(() => {
    if (!mapReady || !position) return;
    webRef.current?.injectJavaScript(
      `window.updatePosition(${position.latitude},${position.longitude},${JSON.stringify(
        state === "live" ? "" : state === "stale" ? "stale" : "ended",
      )}); true;`,
    );
  }, [mapReady, position?.latitude, position?.longitude, state]);

  useEffect(() => {
    if (!mapReady) return;
    webRef.current?.injectJavaScript(`window.setFollowed(${followed ? "true" : "false"}); true;`);
  }, [mapReady, followed]);

  const lastUpdated = position?.lastUpdatedAt
    ? new Date(position.lastUpdatedAt).toLocaleTimeString("vi-VN")
    : null;

  const onRequestGps = useCallback(async () => {
    setRequesting(true);
    try {
      await requestGpsEnable(bookingId);
      Alert.alert("Đã gửi yêu cầu", "Khách thuê sẽ nhận thông báo yêu cầu bật GPS.");
    } catch (error) {
      Alert.alert("Lỗi", getApiErrorMessage(error, "Không gửi được yêu cầu bật GPS."));
    } finally {
      setRequesting(false);
    }
  }, [bookingId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => goBackOrFallback(navigation, () => navigation.goBack())} style={styles.backButton} accessibilityLabel="Quay lại">
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <AppText numberOfLines={1} style={styles.headerTitle}>Vị trí xe · {vehicleName || `Booking #${bookingId}`}</AppText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.mapWrap}>
        <WebView
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
            <AppText style={styles.loadingText}>Đang tải vị trí xe...</AppText>
          </View>
        ) : null}
        <Pressable
          style={styles.recenter}
          accessibilityLabel="Về vị trí xe"
          onPress={() => {
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
          <AppText style={[styles.statusText, { color: stateColor }]}>{STATE_LABEL[state]}</AppText>
          {lastUpdated ? <AppText style={styles.lastUpdated}>· cập nhật {lastUpdated}</AppText> : null}
        </View>
        {position?.speedKmh != null ? (
          <AppText style={styles.speedText}>Tốc độ: {Math.round(position.speedKmh)} km/h</AppText>
        ) : null}
        {state !== "none" && (address || (position?.latitude != null && position?.longitude != null)) ? (
          <AppText numberOfLines={2} style={styles.addressText}>
            {address ?? `Tọa độ: ${position?.latitude.toFixed(5)}, ${position?.longitude.toFixed(5)}`}
          </AppText>
        ) : null}
        {state === "stale" ? (
          <AppText style={styles.staleHint}>
            Không nhận được vị trí mới trong một thời gian. Khách thuê có thể đã tắt GPS hoặc mất kết nối — vị trí hiển thị là điểm cuối cùng.
          </AppText>
        ) : null}
        {state === "stale" && trackingActive ? (
          <Pressable style={[styles.requestButton, requesting && styles.requestButtonDisabled]} onPress={() => void onRequestGps()} disabled={requesting} accessibilityLabel="Yêu cầu khách bật GPS">
            <Navigation size={17} color={theme.onBrand} />
            <AppText style={styles.requestButtonText}>{requesting ? "Đang gửi..." : "Yêu cầu khách bật GPS"}</AppText>
          </Pressable>
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
  requestButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.brandSolid, borderRadius: 12, paddingVertical: 12 },
  requestButtonDisabled: { opacity: 0.6 },
  requestButtonText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
});
