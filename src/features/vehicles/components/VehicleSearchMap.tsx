import { Image } from "expo-image";
import { Bike, Car, ChevronUp, MapPin } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { aiFilterMapPublicVehicles, getPublicMapVehicles } from "@/features/vehicles/services/publicVehicleService";
import type { PublicVehicleAiSearchFilters, VehicleListItemResponse } from "@/features/vehicles/types";
import { formatVehicleCurrency } from "@/features/vehicles/components/VehicleListCard";
import { buildVehicleSearchMapHtml } from "@/features/vehicles/components/vehicleSearchMapHtml";
import type { MapVehiclePoint } from "@/features/vehicles/components/vehicleSearchMapHtml";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type SearchParams = Record<string, string | number | boolean | undefined>;
type Center = { latitude: number; longitude: number } | null;
type MapResult = { items: VehicleListItemResponse[]; totalCount: number };
type LocatedVehicle = VehicleListItemResponse & { latitude: number; longitude: number };
type CacheEntry = { result?: MapResult; promise?: Promise<MapResult>; expiresAt: number };

const MAX_MAP_VEHICLES = 300;
const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_LIMIT = 10;
const mapCache = new Map<string, CacheEntry>();

function isLocated(vehicle: VehicleListItemResponse): vehicle is LocatedVehicle {
  return Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude)
    && vehicle.latitude !== null && vehicle.longitude !== null
    && Math.abs(vehicle.latitude) <= 90 && Math.abs(vehicle.longitude) <= 180;
}

function cachedResult(key: string) {
  const entry = mapCache.get(key);
  if (entry && (entry.promise || entry.expiresAt > Date.now())) return entry;
  mapCache.delete(key);
  return undefined;
}

function saveResult(key: string, result: MapResult) {
  mapCache.delete(key);
  mapCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  while (mapCache.size > CACHE_LIMIT) mapCache.delete(mapCache.keys().next().value!);
}

function fetchMapResult(key: string, params: SearchParams, aiQuery: string, aiFilters: PublicVehicleAiSearchFilters) {
  const entry = cachedResult(key);
  if (entry?.result) return Promise.resolve(entry.result);
  if (entry?.promise) return entry.promise;
  const request = aiQuery
    ? aiFilterMapPublicVehicles({
      query: aiQuery,
      currentFilters: aiFilters,
      sortBy: String(params.sortBy || ""),
      page: 1,
      pageSize: MAX_MAP_VEHICLES,
    }).then((response) => {
      if (!response?.result) throw new Error("Missing AI map results");
      return response.result;
    })
    : getPublicMapVehicles(params);
  const pending = request.then((result) => {
    if (mapCache.get(key)?.promise === pending) saveResult(key, result);
    return result;
  }).catch((error: unknown) => {
    if (mapCache.get(key)?.promise === pending) mapCache.delete(key);
    throw error;
  });
  mapCache.set(key, { promise: pending, expiresAt: 0 });
  return pending;
}

export default function VehicleSearchMap({
  params,
  aiQuery,
  aiFilters,
  aiSearching,
  aiSearchVersion,
  aiPreview,
  center,
  radiusKm,
  onOpenVehicle,
}: {
  params: SearchParams;
  aiQuery: string;
  aiFilters: PublicVehicleAiSearchFilters;
  aiSearching: boolean;
  aiSearchVersion: number;
  aiPreview: MapResult | null;
  center: Center;
  radiusKm: number;
  onOpenVehicle: (vehicleId: number) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const webRef = useRef<WebView>(null);
  const cacheKey = useMemo(() => aiQuery
    ? JSON.stringify(["ai", aiQuery, aiFilters, params.sortBy ?? "", aiSearchVersion])
    : JSON.stringify(["filter", params]), [aiQuery, aiFilters, params, aiSearchVersion]);
  const [result, setResult] = useState<MapResult>(() => cachedResult(cacheKey)?.result ?? aiPreview ?? { items: [], totalCount: 0 });
  const [loading, setLoading] = useState(() => !cachedResult(cacheKey)?.result);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterIds, setClusterIds] = useState<number[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapCenter = center && Number.isFinite(center.latitude) && Number.isFinite(center.longitude)
    && Math.abs(center.latitude) <= 90 && Math.abs(center.longitude) <= 180 ? center : null;
  const safeRadius = Number.isFinite(radiusKm) ? Math.max(1, Math.min(radiusKm, 200)) : 10;

  useEffect(() => {
    if (aiSearching) return;
    const completePreview = aiQuery && aiPreview && aiPreview.totalCount <= aiPreview.items.length
      ? aiPreview : null;
    if (completePreview) saveResult(cacheKey, completePreview);
    const cached = completePreview ?? cachedResult(cacheKey)?.result;
    setResult(cached ?? (aiQuery ? aiPreview : null) ?? { items: [], totalCount: 0 });
    setLoading(!cached);
    setError(false);
    setSelectedId(null);
    setClusterIds(null);
    if (cached) return;

    let active = true;
    const timer = setTimeout(() => {
      void fetchMapResult(cacheKey, params, aiQuery, aiFilters)
        .then((next) => { if (active) setResult(next); })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    }, aiQuery ? 0 : 250);
    return () => { active = false; clearTimeout(timer); };
  }, [cacheKey, params, aiQuery, aiFilters, aiSearching, aiPreview]);

  const located = useMemo(() => result.items.filter(isLocated), [result.items]);
  const points = useMemo<MapVehiclePoint[]>(() => located.map((vehicle) => ({
    id: vehicle.id,
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    vehicleType: vehicle.vehicleType,
    price: vehicle.averageDailyPrice ?? vehicle.pricePerDay,
    name: `${vehicle.brandName} ${vehicle.modelName}`,
    featuredImage: vehicle.featuredImage,
    totalPrice: vehicle.totalDynamicPrice,
    distanceKm: vehicle.distanceKm,
  })), [located]);
  const html = useMemo(() => buildVehicleSearchMapHtml(points, mapCenter, safeRadius, theme.brand, theme.surfaceAlt),
    [points, mapCenter?.latitude, mapCenter?.longitude, safeRadius, theme.brand, theme.surfaceAlt]);
  const webSource = useMemo(() => ({ html }), [html]);
  const visibleVehicles = clusterIds
    ? located.filter((vehicle) => clusterIds.includes(vehicle.id)) : located;
  const availableHeight = mapHeight || windowHeight * 0.6;
  const sheetHeight = expanded
    ? Math.min(availableHeight * 0.82, 560)
    : Math.min(55 + Math.max(insets.bottom, 8), availableHeight * 0.3);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -35) setExpanded(true);
      if (gesture.dy > 35) setExpanded(false);
    },
  })).current;

  function focusVehicle(vehicleId: number) {
    setSelectedId(vehicleId);
    setClusterIds(null);
    setExpanded(false);
    if (mapReady) webRef.current?.injectJavaScript(`window.focusVehicle(${vehicleId}); true;`);
  }

  function handleMapMessage(event: WebViewMessageEvent) {
    try {
      const message: unknown = JSON.parse(event.nativeEvent.data);
      if (!message || typeof message !== "object" || !("type" in message)) return;
      if (message.type === "ready") {
        setMapReady(true);
      } else if (message.type === "select" && "id" in message && Number.isInteger(message.id)
        && located.some((vehicle) => vehicle.id === message.id)) {
        setSelectedId(message.id as number);
        setClusterIds(null);
        setExpanded(false);
      } else if (message.type === "open" && "id" in message && Number.isInteger(message.id)
        && located.some((vehicle) => vehicle.id === message.id)) {
        onOpenVehicle(message.id as number);
      } else if (message.type === "cluster" && "ids" in message && Array.isArray(message.ids)) {
        const ids = message.ids.filter((id): id is number => Number.isInteger(id)
          && located.some((vehicle) => vehicle.id === id));
        if (ids.length > 0) {
          setClusterIds(ids);
          setExpanded(true);
        }
      }
    } catch {
      // Ignore messages unrelated to map selection.
    }
  }

  return (
    <View style={styles.container} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <WebView
        ref={webRef}
        source={webSource}
        style={styles.map}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMapMessage}
        onLoadStart={() => {
          setMapReady(false);
          setMapError(false);
        }}
        onError={() => setMapError(true)}
      />
      {mapCenter ? (
        <Pressable style={[styles.recenter, { bottom: sheetHeight + 38 }]} onPress={() => {
          if (mapReady) webRef.current?.injectJavaScript("window.focusPickup(); true;");
        }} accessibilityLabel="Về điểm nhận xe">
          <MapPin size={19} color={theme.brand} />
        </Pressable>
      ) : null}
      <View style={[styles.attribution, { bottom: sheetHeight + 6 }]}>
        <Text style={styles.attributionText}>
          © <Text style={styles.attributionLink} onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}>OpenStreetMap</Text>
          {" contributors · © "}
          <Text style={styles.attributionLink} onPress={() => void Linking.openURL("https://carto.com/attribution/")}>CARTO</Text>
        </Text>
      </View>
      {loading ? (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={styles.loadingText}>Đang tải xe trên bản đồ...</Text>
        </View>
      ) : null}
      {error || mapError ? (
        <View style={styles.errorBadge}>
          <Text style={styles.errorText}>{mapError ? "Không tải được bản đồ." : "Không tải thêm được xe trên bản đồ."}</Text>
        </View>
      ) : null}
      <View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View {...panResponder.panHandlers}>
          <Pressable onPress={() => setExpanded((value) => !value)} style={styles.sheetHandleArea}
            accessibilityLabel={expanded ? "Thu gọn danh sách xe" : "Mở danh sách xe"}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>{clusterIds ? `${visibleVehicles.length} xe tại vị trí này` : `${located.length} xe trên bản đồ`}</Text>
                {expanded && result.totalCount > located.length ? (
                  <Text style={styles.sheetSubtitle}>{result.totalCount} xe phù hợp · chỉ hiện xe có vị trí</Text>
                ) : null}
              </View>
              <ChevronUp size={18} color={theme.muted} style={expanded ? { transform: [{ rotate: "180deg" }] } : undefined} />
            </View>
          </Pressable>
        </View>
        {expanded ? (
          <FlatList
            data={visibleVehicles}
            keyExtractor={(vehicle) => String(vehicle.id)}
            contentContainerStyle={styles.vehicleList}
            renderItem={({ item }) => (
              <View style={[styles.vehicleRow, selectedId === item.id && styles.vehicleRowSelected]}>
                <Pressable onPress={() => focusVehicle(item.id)} style={styles.vehicleRowMain}>
                  {item.featuredImage ? <Image source={{ uri: item.featuredImage }} style={styles.rowImage} contentFit="cover" />
                    : <View style={styles.rowImageFallback}>{item.vehicleType === "Motorbike"
                      ? <Bike size={25} color={theme.brand} /> : <Car size={25} color={theme.brand} />}</View>}
                  <View style={styles.rowInfo}>
                    <Text numberOfLines={1} style={styles.vehicleName}>{item.brandName} {item.modelName} {item.year}</Text>
                    <Text style={styles.vehiclePrice}>{formatVehicleCurrency(item.averageDailyPrice ?? item.pricePerDay)}/ngày</Text>
                    {item.distanceKm != null ? <Text style={styles.vehicleDistance}>Cách điểm nhận {item.distanceKm.toFixed(1)} km</Text> : null}
                  </View>
                </Pressable>
                <Pressable onPress={() => onOpenVehicle(item.id)} style={styles.detailLink} accessibilityLabel={`Xem xe ${item.brandName} ${item.modelName}`}>
                  <Text style={styles.detailLinkText}>Xem xe</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Chưa có xe phù hợp có vị trí trên bản đồ.</Text> : null}
          />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surfaceAlt },
  map: { flex: 1, backgroundColor: theme.surfaceAlt },
  recenter: { position: "absolute", right: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", elevation: 3 },
  attribution: { position: "absolute", right: 8, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: theme.prominentBg },
  attributionText: { color: theme.text, fontSize: 10 },
  attributionLink: { color: theme.brand, textDecorationLine: "underline" },
  loadingBadge: { position: "absolute", top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.surface, elevation: 2 },
  loadingText: { color: theme.text, fontSize: 12, fontWeight: "700" },
  errorBadge: { position: "absolute", top: 12, alignSelf: "center", borderRadius: 10, backgroundColor: theme.errorSoft, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { color: theme.error, fontSize: 12, fontWeight: "700" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden", elevation: 8 },
  sheetHandleArea: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 7 },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 7 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sheetTitleWrap: { flex: 1 },
  sheetTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
  sheetSubtitle: { color: theme.muted, fontSize: 11, marginTop: 2 },
  vehicleName: { color: theme.text, fontSize: 13, fontWeight: "800" },
  vehiclePrice: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  vehicleDistance: { color: theme.muted, fontSize: 11 },
  vehicleList: { paddingHorizontal: 12, paddingBottom: 14, gap: 8 },
  vehicleRow: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, padding: 8, backgroundColor: theme.surface },
  vehicleRowSelected: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
  vehicleRowMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowImage: { width: 76, height: 62, borderRadius: 9 },
  rowImageFallback: { width: 76, height: 62, borderRadius: 9, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 3 },
  detailLink: { alignSelf: "flex-end", marginTop: 5, paddingHorizontal: 6, paddingVertical: 3 },
  detailLinkText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
  emptyText: { color: theme.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 16, paddingTop: 10 },
});
