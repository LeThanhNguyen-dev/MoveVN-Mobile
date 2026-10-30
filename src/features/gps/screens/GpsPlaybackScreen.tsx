import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, PanResponder, Pressable, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react-native";
import AppText from "@/components/AppText";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getGpsRoadPath, getGpsSummary } from "../gpsService";
import { buildPlaybackMapHtml } from "../components/playbackMapHtml";
import type { GpsRoadPathResponse, GpsTripSummaryResponse } from "../types";

type PlaybackRoute = RouteProp<OwnerBookingsStackParamList, "OwnerPlayback">;
type PlaybackNav = NativeStackNavigationProp<OwnerBookingsStackParamList>;

const SPEED_STEPS = [1, 2, 4, 8] as const;
/** Mỗi tick tiến speedStep điểm (tuyến đã decimate ~95 đỉnh) — ~8 điểm/giây ở ×1. */
const PLAY_TICK_MS = 120;

function formatKm(value: number) {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
}

function formatSpeed(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")} km/h`;
}

/**
 * Phát lại hành trình chuyến đi cho chủ xe: polyline map matching theo đường phố
 * (OSRM), Play/Pause ×tốc độ + slider kéo (tự viết bằng PanResponder — không cần
 * native module), kèm thẻ tổng hợp từ TripSummaries.
 */
export default function GpsPlaybackScreen({
  route,
  navigation,
}: {
  route: PlaybackRoute;
  navigation: PlaybackNav;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId, vehicleName } = route.params;
  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [road, setRoad] = useState<GpsRoadPathResponse | null>(null);
  const [summary, setSummary] = useState<GpsTripSummaryResponse | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speedStep, setSpeedStep] = useState<(typeof SPEED_STEPS)[number]>(1);
  const [index, setIndex] = useState(0);
  const trackWidthRef = useRef(0);

  const path = road?.path ?? [];
  const lastIndex = Math.max(0, path.length - 1);
  const current = path.length > 0 ? path[Math.min(index, lastIndex)] : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [roadPath, tripSummary] = await Promise.all([
          getGpsRoadPath(bookingId).catch(() => null),
          getGpsSummary(bookingId).catch(() => null),
        ]);
        if (!active) return;
        setRoad(roadPath);
        setSummary(tripSummary);
        if (!roadPath || roadPath.path.length < 2) {
          Alert.alert("Chưa có hành trình", "Chuyến này chưa có đủ điểm GPS để phát lại.");
        }
      } catch (error) {
        Alert.alert("Lỗi", getApiErrorMessage(error, "Không tải được hành trình chuyến đi."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  // Đẩy polyline vào map ngay khi map JS sẵn sàng + có dữ liệu.
  useEffect(() => {
    if (!mapReady || path.length === 0) return;
    webRef.current?.injectJavaScript(
      `window.setPath(${JSON.stringify(path.map((point) => [point.latitude, point.longitude]))}); true;`,
    );
  }, [mapReady, road]);

  // Di chuyển marker theo index (slider hoặc Play).
  useEffect(() => {
    if (!mapReady || !current) return;
    webRef.current?.injectJavaScript(`window.moveMarker(${current.latitude},${current.longitude}); true;`);
  }, [mapReady, current?.latitude, current?.longitude]);

  // Play: tick đều đặn, tự dừng ở cuối tuyến.
  useEffect(() => {
    if (!playing || lastIndex < 1) return;
    const timer = setInterval(() => {
      setIndex((value) => {
        const next = value + speedStep;
        if (next >= lastIndex) {
          setPlaying(false);
          return lastIndex;
        }
        return next;
      });
    }, PLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [playing, speedStep, lastIndex]);

  // Slider tự viết: chạm/kéo trên track để nhảy tới vị trí bất kỳ.
  const seekTo = useCallback((x: number) => {
    if (trackWidthRef.current <= 0 || lastIndex < 1) return;
    setPlaying(false);
    const ratio = Math.min(1, Math.max(0, x / trackWidthRef.current));
    setIndex(Math.round(ratio * lastIndex));
  }, [lastIndex]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => seekTo(event.nativeEvent.locationX),
    onPanResponderMove: (event) => seekTo(event.nativeEvent.locationX),
  })).current;

  const elapsedLabel = useMemo(() => {
    const start = summary?.startedAt ? Date.parse(summary.startedAt) : null;
    const end = summary?.endedAt ? Date.parse(summary.endedAt) : null;
    if (start == null || end == null || end <= start || lastIndex < 1) return null;
    const at = start + (end - start) * (Math.min(index, lastIndex) / lastIndex);
    return new Date(at).toLocaleString("vi-VN");
  }, [summary, index, lastIndex]);

  const handleBack = () => goBackOrFallback(navigation, () => navigation.goBack());
  const progressRatio = lastIndex > 0 ? Math.min(index, lastIndex) / lastIndex : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Quay lại">
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <AppText numberOfLines={1} style={styles.headerTitle}>Hành trình · {vehicleName || `Booking #${bookingId}`}</AppText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          source={{ html: buildPlaybackMapHtml(theme.brand, theme.surfaceAlt) }}
          style={styles.map}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event: WebViewMessageEvent) => {
            try {
              const message: unknown = JSON.parse(event.nativeEvent.data);
              if (message && typeof message === "object" && "type" in message && message.type === "ready") {
                setMapReady(true);
              }
            } catch {
              // Bỏ qua message không liên quan.
            }
          }}
        />
        {loading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={theme.brand} />
            <AppText style={styles.loadingText}>Đang tải hành trình...</AppText>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <View style={styles.controlsRow}>
          <Pressable
            style={[styles.playButton, lastIndex < 1 && styles.disabled]}
            disabled={lastIndex < 1}
            onPress={() => (index >= lastIndex ? (setIndex(0), setPlaying(true)) : setPlaying((value) => !value))}
            accessibilityLabel={playing ? "Tạm dừng" : index >= lastIndex ? "Phát lại" : "Phát"}
          >
            {playing
              ? <Pause size={20} color={theme.onBrand} />
              : index >= lastIndex
                ? <RotateCcw size={20} color={theme.onBrand} />
                : <Play size={20} color={theme.onBrand} />}
          </Pressable>
          <View style={styles.speedGroup}>
            {SPEED_STEPS.map((step) => (
              <Pressable
                key={step}
                onPress={() => setSpeedStep(step)}
                style={[styles.speedButton, speedStep === step && styles.speedButtonActive]}
                accessibilityLabel={`Tốc độ phát ×${step}`}
              >
                <AppText style={[styles.speedText, speedStep === step && styles.speedTextActive]}>×{step}</AppText>
              </Pressable>
            ))}
          </View>
          {elapsedLabel ? <AppText style={styles.elapsedText}>{elapsedLabel}</AppText> : null}
        </View>

        <View
          style={styles.sliderTrackWrap}
          onLayout={(event) => {
            trackWidthRef.current = event.nativeEvent.layout.width;
          }}
          {...panResponder.panHandlers}
          accessibilityLabel="Vị trí phát lại trong hành trình"
        >
          <View style={styles.sliderTrack} />
          <View style={[styles.sliderFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
          <View style={[styles.sliderKnob, { left: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.sliderMeta}>
          <AppText style={styles.metaText}>Điểm {lastIndex > 0 ? Math.min(index, lastIndex) + 1 : 0}/{lastIndex + 1}</AppText>
          {road ? (
            <AppText style={styles.metaText}>
              {road.matched ? "Đã khớp theo đường phố" : "Nối giữa các điểm GPS"}
            </AppText>
          ) : null}
        </View>

        {summary ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>Quãng đường</AppText>
              <AppText style={styles.summaryValue}>{formatKm(summary.distanceKm)}</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>Tốc độ tối đa / trung bình</AppText>
              <AppText style={styles.summaryValue}>{formatSpeed(summary.maxSpeedKmh)} · {formatSpeed(summary.avgSpeedKmh)}</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={styles.summaryLabel}>Số lần mất tín hiệu</AppText>
              <AppText style={[styles.summaryValue, summary.signalLostCount > 0 && { color: theme.danger }]}>
                {summary.signalLostCount}
              </AppText>
            </View>
            {!summary.persisted ? (
              <AppText style={styles.temporaryNote}>Chuyến chưa kết thúc — số liệu tính tạm từ log hiện có.</AppText>
            ) : null}
          </View>
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
  footer: { backgroundColor: theme.surface, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  speedGroup: { flexDirection: "row", borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: "hidden" },
  speedButton: { paddingHorizontal: 10, paddingVertical: 7 },
  speedButtonActive: { backgroundColor: theme.brand },
  speedText: { color: theme.muted, fontSize: 12, fontWeight: "800" },
  speedTextActive: { color: theme.onBrand },
  elapsedText: { flex: 1, textAlign: "right", color: theme.muted, fontSize: 12 },
  sliderTrackWrap: { height: 36, justifyContent: "center", position: "relative" },
  sliderTrack: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: theme.border },
  sliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: theme.brand },
  sliderKnob: { position: "absolute", marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.brand, borderWidth: 3, borderColor: theme.surface },
  sliderMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { color: theme.muted, fontSize: 11 },
  summaryCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 12, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: theme.muted, fontSize: 12.5 },
  summaryValue: { color: theme.text, fontSize: 12.5, fontWeight: "800" },
  temporaryNote: { color: theme.info, fontSize: 11 },
});
