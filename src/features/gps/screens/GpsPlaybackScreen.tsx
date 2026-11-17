import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Navigation,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getGpsRoadPath, getGpsRoute, getGpsSummary } from "../gpsService";
import { buildPlaybackMapHtml, type PlaybackMapTheme } from "../components/playbackMapHtml";
import GpsInfoButton from "../components/GpsInfoButton";
import {
  anchorIndexAt,
  buildPlaybackModel,
  frameAtTime,
  stepAnchorTime,
  type PlaybackFrame,
  type PlaybackModel,
} from "../playbackModel";
import type { GpsRoadPathResponse, GpsTripSummaryResponse } from "../types";

const SPEED_STEPS = [1, 2, 4, 8] as const;
/** Nén thời gian chuyến thật: 1 phút của chuyến = 1 giây phát (giống web). */
const TIME_SCALE = 60;
const PLAY_TICK_MS = 100;

function formatKm(value: number) {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
}

function formatSpeed(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")} km/h`;
}

function formatClock(timeMs: number) {
  return new Date(timeMs).toLocaleTimeString("vi-VN", { hour12: false });
}

function formatTimeShort(timeMs: number) {
  return new Date(timeMs).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

type HistoryItem = { k: number; time: string; speed: number };
type HistoryGroup = { hour: string; items: HistoryItem[] };

/**
 * Phát lại hành trình chuyến đi (khách thuê + chủ xe dùng chung) — bố cục bám
 * theo bản web: tiêu đề + trạng thái lộ trình, map có nút "Theo xe", thanh phát
 * (lùi/phát/tiến + tốc độ + ẩn lộ trình), rồi thẻ tổng hợp và lịch sử theo giờ.
 *
 * Tiến trình chạy theo THỜI GIAN thật của chuyến nên khúc quẹo giữa chuyến và
 * khoảng dừng 3–4 phút vẫn được giữ đúng như web; marker dùng mũi tên + chip
 * tốc độ, không tự xoay khi xe đỗ.
 */
export default function GpsPlaybackScreen({
  bookingId,
  vehicleName,
  live = false,
  onBack,
}: {
  bookingId: number;
  vehicleName?: string;
  /** Chuyến đang thuê: backend trả GPS thật (không map matching) — chỉ khác nhãn chú thích. */
  live?: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapTheme = useMemo<PlaybackMapTheme>(
    () => ({
      brand: theme.brand,
      background: theme.surfaceAlt,
      surface: theme.surface,
      text: theme.text,
      pending: theme.border,
      outline: "#ffffff",
    }),
    [theme],
  );
  const mapHeight = Math.max(220, Math.round(windowHeight * 0.42));
  // Giữ nguyên tham chiếu source giữa các render — WebView reload lại HTML
  // mỗi lần nhận source mới, làm mất tuyến và bắn "ready" liên tục.
  const mapSource = useMemo(() => ({ html: buildPlaybackMapHtml(mapTheme) }), [mapTheme]);

  const webRef = useRef<WebView<object>>(null);
  const headingRef = useRef(0);
  const trackWidthRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [road, setRoad] = useState<GpsRoadPathResponse | null>(null);
  const [summary, setSummary] = useState<GpsTripSummaryResponse | null>(null);
  const [model, setModel] = useState<PlaybackModel | null>(null);

  const [playing, setPlaying] = useState(false);
  const [follow, setFollow] = useState(true);
  const [speedStep, setSpeedStep] = useState<(typeof SPEED_STEPS)[number]>(1);
  const [routeVisible, setRouteVisible] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [openHours, setOpenHours] = useState<string[]>([]);
  const [timeMs, setTimeMs] = useState(0);
  const [frame, setFrame] = useState<PlaybackFrame | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [roadPath, tripSummary, points] = await Promise.all([
          getGpsRoadPath(bookingId).catch(() => null),
          getGpsSummary(bookingId).catch(() => null),
          getGpsRoute(bookingId).catch(() => []),
        ]);
        if (!active) return;
        setRoad(roadPath);
        setSummary(tripSummary);

        // Không khớp được đường phố (hoặc chuyến đang chạy) → nối trực tiếp các
        // điểm GPS để vẫn phát lại được.
        const fallbackRoad: GpsRoadPathResponse | null =
          roadPath && roadPath.path.length >= 2
            ? roadPath
            : points.length >= 2
              ? {
                  bookingId,
                  matched: false,
                  path: points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
                }
              : null;

        const nextModel = buildPlaybackModel(points, fallbackRoad);
        if (!nextModel) {
          showAppAlert(t("mobile:gps.playback.emptyTitle"), t("mobile:gps.playback.emptyBody"));
          return;
        }
        headingRef.current = 0;
        setModel(nextModel);
        setTimeMs(nextModel.startTime);
      } catch (error) {
        showAppAlert(t("mobile:gps.errorTitle"), getApiErrorMessage(error, t("mobile:gps.playback.loadError")));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId, t]);

  // Tính khung hình hiện tại; giữ nguyên hướng mũi tên khi xe đứng yên.
  useEffect(() => {
    if (!model) {
      setFrame(null);
      return;
    }
    const next = frameAtTime(model, timeMs, headingRef.current);
    headingRef.current = next.heading;
    setFrame(next);
  }, [model, timeMs]);

  // Đồng hồ phát: cộng dồn thời gian thật rồi nhân tốc độ phát.
  // Updater của setTimeMs phải thuần: React chạy nó trong lúc render, gọi
  // setPlaying bên trong sẽ tạo render-phase update lặp vô hạn khi tới cuối.
  useEffect(() => {
    if (!playing || !model) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = (now - last) * TIME_SCALE * speedStep;
      last = now;
      setTimeMs((value) => Math.min(model.endTime, value + delta));
    }, PLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [playing, speedStep, model]);

  // Chạm cuối hành trình → dừng phát (tách khỏi updater phía trên).
  useEffect(() => {
    if (playing && model && timeMs >= model.endTime) setPlaying(false);
  }, [playing, model, timeMs]);

  // Nạp polyline khi map sẵn sàng (chỉ 1 lần).
  useEffect(() => {
    if (!mapReady || !model) return;
    webRef.current?.injectJavaScript(
      `window.setPath(${JSON.stringify(model.path)}); window.setRouteVisible(${routeVisible}); true;`,
    );
  }, [mapReady, model]);

  useEffect(() => {
    if (!mapReady) return;
    webRef.current?.injectJavaScript(`window.setRouteVisible(${routeVisible}); true;`);
  }, [mapReady, routeVisible]);

  // Mỗi khung hình: tách tuyến đã đi / chưa đi + xoay mũi tên + chip tốc độ.
  useEffect(() => {
    if (!mapReady || !frame) return;
    const shouldFollow = follow && playing;
    webRef.current?.injectJavaScript(
      `window.setProgress(${frame.vertex},${frame.latitude},${frame.longitude});`
      + `window.moveVehicle(${frame.latitude},${frame.longitude},${frame.heading.toFixed(1)},${frame.speedKmh.toFixed(1)},${shouldFollow}); true;`,
    );
  }, [mapReady, frame, playing, follow]);

  const seekTo = useCallback((x: number) => {
    if (!model || trackWidthRef.current <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / trackWidthRef.current));
    setPlaying(false);
    setTimeMs(model.startTime + (model.endTime - model.startTime) * ratio);
  }, [model]);

  // PanResponder chỉ tạo 1 lần nên phải đi qua ref, nếu không nó giữ `model` của
  // lần render đầu (null) và kéo thanh trượt sẽ không có tác dụng.
  const seekRef = useRef(seekTo);
  seekRef.current = seekTo;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => seekRef.current(event.nativeEvent.locationX),
    onPanResponderMove: (event) => seekRef.current(event.nativeEvent.locationX),
  })).current;

  const stepPoint = useCallback((direction: -1 | 1) => {
    if (!model) return;
    setPlaying(false);
    setTimeMs((value) => stepAnchorTime(model, value, direction));
  }, [model]);

  const togglePlaying = useCallback(() => {
    if (!model) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (timeMs >= model.endTime) {
      headingRef.current = 0;
      setTimeMs(model.startTime);
    }
    setPlaying(true);
  }, [model, playing, timeMs]);

  const seekToPoint = useCallback((index: number) => {
    if (!model) return;
    const anchor = model.anchors[index];
    if (!anchor) return;
    setPlaying(false);
    setTimeMs(anchor.t);
  }, [model]);

  // Lịch sử theo giờ — giống web: mỗi giờ là một nhóm gập/mở được, mặc định đóng.
  // Dựng từ chính `model.anchors` để chỉ số dòng khớp với mốc đang phát (log GPS
  // có thể không theo thứ tự thời gian, còn anchors thì đã sắp xếp).
  const historyGroups = useMemo<HistoryGroup[]>(() => {
    if (!model) return [];
    const groups: HistoryGroup[] = [];
    model.anchors.forEach((anchor, index) => {
      const date = new Date(anchor.t);
      const hour = `${String(date.getHours()).padStart(2, "0")}:00`;
      const item: HistoryItem = {
        k: index,
        time: formatTimeShort(anchor.t),
        speed: Math.round(anchor.speedKmh),
      };
      const last = groups[groups.length - 1];
      if (last && last.hour === hour) last.items.push(item);
      else groups.push({ hour, items: [item] });
    });
    return groups;
  }, [model]);

  const progress = frame?.progress ?? 0;
  const atEnd = model != null && timeMs >= model.endTime;
  const activeIndex = model ? anchorIndexAt(model, timeMs) : 0;
  const pointTotal = model?.anchors.length ?? 0;
  const pointIndex = model ? activeIndex + 1 : 0;
  const historyCount = pointTotal;
  const stateLabel = live
    ? t("mobile:gps.playback.liveNote")
    : road?.matched
      ? t("mobile:gps.playback.matched")
      : t("mobile:gps.playback.unmatched");

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t("mobile:gps.backAria")}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <AppText numberOfLines={1} style={styles.headerTitle}>
            {t("mobile:gps.playback.title", { name: vehicleName || t("mobile:gps.bookingFallback", { id: bookingId }) })}
          </AppText>
          <AppText numberOfLines={1} style={styles.headerSubtitle}>{stateLabel}</AppText>
        </View>
        <GpsInfoButton size={36} />
      </View>

      <View style={[styles.mapWrap, { height: mapHeight }]}>
        <WebView<object>
          ref={webRef}
          source={mapSource}
          style={styles.map}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event: WebViewMessageEvent) => {
            try {
              const message: unknown = JSON.parse(event.nativeEvent.data);
              if (!message || typeof message !== "object" || !("type" in message)) return;
              if (message.type === "ready") {
                setMapReady(true);
              } else if (message.type === "followOff") {
                // Người dùng tự kéo/zoom map → tắt "Theo xe" như web.
                setFollow(false);
              }
            } catch {
              // Bỏ qua message không liên quan.
            }
          }}
        />
        <Pressable
          style={[styles.mapButton, follow && styles.mapButtonActive]}
          onPress={() => {
            const next = !follow;
            setFollow(next);
            if (next && frame) {
              webRef.current?.injectJavaScript(
                `window.moveVehicle(${frame.latitude},${frame.longitude},${frame.heading.toFixed(1)},${frame.speedKmh.toFixed(1)},true); true;`,
              );
            }
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: follow }}
          accessibilityLabel={t("mobile:gps.playback.follow")}
        >
          <Navigation size={16} color={follow ? theme.onBrand : theme.muted} />
        </Pressable>
        {loading ? (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={theme.brand} />
            <AppText style={styles.loadingText}>{t("mobile:gps.playback.loading")}</AppText>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <View style={styles.card}>
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.smallButton, (!model || activeIndex <= 0) && styles.disabled]}
              disabled={!model || activeIndex <= 0}
              onPress={() => stepPoint(-1)}
              accessibilityRole="button"
              accessibilityLabel={t("mobile:gps.playback.prevPoint")}
            >
              <ChevronLeft size={18} color={theme.muted} />
            </Pressable>
            <Pressable
              style={[styles.playButton, !model && styles.disabled]}
              disabled={!model}
              onPress={togglePlaying}
              accessibilityRole="button"
              accessibilityLabel={
                playing
                  ? t("mobile:gps.playback.pause")
                  : atEnd
                    ? t("mobile:gps.playback.replay")
                    : t("mobile:gps.playback.play")
              }
            >
              {playing
                ? <Pause size={20} color={theme.onBrand} />
                : atEnd
                  ? <RotateCcw size={20} color={theme.onBrand} />
                  : <Play size={20} color={theme.onBrand} />}
            </Pressable>
            <Pressable
              style={[styles.smallButton, (!model || pointIndex >= pointTotal) && styles.disabled]}
              disabled={!model || pointIndex >= pointTotal}
              onPress={() => stepPoint(1)}
              accessibilityRole="button"
              accessibilityLabel={t("mobile:gps.playback.nextPoint")}
            >
              <ChevronRight size={18} color={theme.muted} />
            </Pressable>
            <View style={styles.speedGroup}>
              {SPEED_STEPS.map((step) => (
                <Pressable
                  key={step}
                  onPress={() => setSpeedStep(step)}
                  style={[styles.speedButton, speedStep === step && styles.speedButtonActive]}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile:gps.playback.speedAria", { speed: step })}
                >
                  <AppText style={[styles.speedText, speedStep === step && styles.speedTextActive]}>×{step}</AppText>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setRouteVisible((value) => !value)}
              style={[styles.routeButton, routeVisible && styles.routeButtonActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: routeVisible }}
              accessibilityLabel={routeVisible ? t("mobile:gps.playback.hideRoute") : t("mobile:gps.playback.showRoute")}
            >
              {routeVisible ? <Eye size={16} color={routeVisible ? theme.onBrand : theme.muted} /> : <EyeOff size={16} color={theme.muted} />}
            </Pressable>
          </View>

          <View
            style={styles.sliderTrackWrap}
            onLayout={(event) => {
              trackWidthRef.current = event.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
            accessibilityLabel={t("mobile:gps.playback.sliderAria")}
          >
            {/* Con bên trong không nhận touch: locationX của kéo phải tính theo khung thanh, không theo knob/fill. */}
            <View style={styles.sliderTrack} pointerEvents="none" />
            <View style={[styles.sliderFill, { width: `${Math.round(progress * 100)}%` }]} pointerEvents="none" />
            <View style={[styles.sliderKnob, { left: `${Math.round(progress * 100)}%` }]} pointerEvents="none" />
          </View>

          <View style={styles.metaRow}>
            <AppText style={styles.metaText}>
              {t("mobile:gps.playback.pointCounter", { current: pointIndex, total: pointTotal })}
            </AppText>
            <AppText style={styles.metaStrong}>{frame ? formatClock(frame.timeMs) : "--:--:--"}</AppText>
            <AppText style={styles.metaText}>
              <AppText style={styles.metaStrong}>{Math.round(frame?.speedKmh ?? 0)}</AppText> km/h
            </AppText>
          </View>
        </View>

        <View style={styles.card}>
          <AppText style={styles.cardTitle}>{t("mobile:gps.playback.summaryTitle")}</AppText>
          {summary ? (
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <AppText style={styles.summaryLabel}>{t("mobile:gps.playback.distance")}</AppText>
                <AppText style={styles.summaryValue}>{formatKm(summary.distanceKm)}</AppText>
              </View>
              <View style={styles.summaryRow}>
                <AppText style={styles.summaryLabel}>{t("mobile:gps.playback.maxSpeed")}</AppText>
                <AppText style={styles.summaryValue}>{formatSpeed(summary.maxSpeedKmh)}</AppText>
              </View>
              <View style={styles.summaryRow}>
                <AppText style={styles.summaryLabel}>{t("mobile:gps.playback.avgSpeed")}</AppText>
                <AppText style={styles.summaryValue}>{formatSpeed(summary.avgSpeedKmh)}</AppText>
              </View>
              <View style={styles.summaryRow}>
                <AppText style={styles.summaryLabel}>{t("mobile:gps.playback.pointCount")}</AppText>
                <AppText style={styles.summaryValue}>{summary.pointCount.toLocaleString("vi-VN")}</AppText>
              </View>
              <View style={styles.summaryRow}>
                <AppText style={styles.summaryLabel}>{t("mobile:gps.playback.signalLost")}</AppText>
                <AppText style={[styles.summaryValue, summary.signalLostCount > 0 ? { color: theme.danger } : { color: theme.success }]}>
                  {summary.signalLostCount}
                </AppText>
              </View>
              {!summary.persisted ? (
                <AppText style={styles.temporaryNote}>{t("mobile:gps.playback.provisionalNote")}</AppText>
              ) : null}
            </View>
          ) : (
            <AppText style={styles.emptyText}>{t("mobile:gps.playback.noSummary")}</AppText>
          )}
        </View>

        <View style={[styles.card, styles.historyCard]}>
          <Pressable
            style={styles.historyHeader}
            onPress={() => setHistoryOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: historyOpen }}
          >
            <View style={styles.historyTitleWrap}>
              <AppText style={styles.cardTitle}>{t("mobile:gps.playback.historyTitle")}</AppText>
              {historyCount > 0 ? <AppText style={styles.historyCount}>({historyCount})</AppText> : null}
            </View>
            <ChevronDown
              size={16}
              color={theme.muted}
              style={historyOpen ? undefined : styles.chevronCollapsed}
            />
          </Pressable>

          {historyOpen ? (
            <View style={styles.historyBody}>
              {historyCount === 0 ? (
                <AppText style={styles.emptyText}>{t("mobile:gps.playback.historyEmpty")}</AppText>
              ) : (
                historyGroups.map((group) => {
                  const hourOpen = openHours.includes(group.hour);
                  return (
                    <View key={group.hour}>
                      <Pressable
                        style={styles.hourRow}
                        onPress={() =>
                          setOpenHours((prev) =>
                            prev.includes(group.hour) ? prev.filter((hour) => hour !== group.hour) : [...prev, group.hour],
                          )
                        }
                        accessibilityRole="button"
                        accessibilityState={{ expanded: hourOpen }}
                      >
                        {hourOpen
                          ? <ChevronDown size={13} color={theme.brand} />
                          : <ChevronRight size={13} color={theme.brand} />}
                        <AppText style={styles.hourText}>{group.hour}</AppText>
                        <AppText style={styles.hourCount}>{t("mobile:gps.playback.hourPoints", { count: group.items.length })}</AppText>
                        <View style={styles.hourLine} />
                      </Pressable>
                      {hourOpen
                        ? group.items.map((item) => {
                            const isActive = item.k === activeIndex;
                            return (
                              <Pressable
                                key={item.k}
                                onPress={() => seekToPoint(item.k)}
                                style={[styles.historyRow, isActive && styles.historyRowActive]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                              >
                                <View style={[styles.historyDot, isActive && styles.historyDotActive]} />
                                <AppText style={styles.historyTime}>{item.time}</AppText>
                                <AppText style={styles.historySpeed}>{item.speed} km/h</AppText>
                              </Pressable>
                            );
                          })
                        : null}
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  headerSubtitle: { color: theme.muted, fontSize: 11.5, marginTop: 1 },
  mapWrap: { backgroundColor: theme.surfaceAlt },
  map: { flex: 1 },
  mapButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    elevation: 2,
  },
  mapButtonActive: { backgroundColor: theme.brand, borderColor: theme.brand },
  loadingBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.surface,
    elevation: 2,
  },
  loadingText: { color: theme.text, fontSize: 12, fontWeight: "700" },
  sheet: { flex: 1, backgroundColor: theme.background },
  sheetContent: { padding: 12, gap: 10, paddingBottom: 28 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: 12,
  },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  smallButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  speedGroup: {
    flexDirection: "row",
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    padding: 2,
    marginLeft: "auto",
  },
  speedButton: { paddingHorizontal: 6, paddingVertical: 5, borderRadius: 999 },
  speedButtonActive: { backgroundColor: theme.surface },
  speedText: { color: theme.muted, fontSize: 11.5, fontWeight: "800" },
  speedTextActive: { color: theme.brand },
  routeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  routeButtonActive: { backgroundColor: theme.brand, borderColor: theme.brand },
  sliderTrackWrap: { height: 32, justifyContent: "center", position: "relative", marginTop: 6 },
  sliderTrack: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: theme.border },
  sliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: theme.brand },
  sliderKnob: {
    position: "absolute",
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.brand,
    borderWidth: 3,
    borderColor: theme.surface,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  metaText: { color: theme.muted, fontSize: 11.5, fontVariant: ["tabular-nums"] },
  metaStrong: { color: theme.text, fontSize: 11.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  cardTitle: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  summaryRows: { marginTop: 10, gap: 9 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: theme.muted, fontSize: 12.5 },
  summaryValue: { color: theme.text, fontSize: 12.5, fontWeight: "800" },
  temporaryNote: {
    color: theme.info,
    fontSize: 11,
    backgroundColor: theme.infoSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emptyText: { color: theme.muted, fontSize: 12.5, marginTop: 8 },
  historyCard: { padding: 0, overflow: "hidden" },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 45,
  },
  historyTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyCount: { color: theme.muted, fontSize: 11, fontWeight: "700" },
  chevronCollapsed: { transform: [{ rotate: "-90deg" }] },
  historyBody: { paddingHorizontal: 6, paddingBottom: 6 },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingTop: 8, paddingBottom: 4 },
  hourText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
  hourCount: { color: theme.muted, fontSize: 11 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
  },
  historyRowActive: { backgroundColor: theme.brandSoft },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.brandBorder },
  historyDotActive: { backgroundColor: theme.brand },
  historyTime: { color: theme.text, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 62 },
  historySpeed: { color: theme.muted, fontSize: 11.5, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
