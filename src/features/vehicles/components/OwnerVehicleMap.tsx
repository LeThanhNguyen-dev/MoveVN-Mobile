import { Expand, MapPin } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type OwnerVehicleMapProps = {
  latitude: number | null;
  longitude: number | null;
  address: string;
  title: string;
  height?: number;
};

const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "").trim();

function tileUrl(): string {
  const base = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  return CARTO_API_KEY ? `${base}?key=${encodeURIComponent(CARTO_API_KEY)}` : base;
}

function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#f1f5f9;} .leaflet-control-zoom{display:none;}</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { scrollWheelZoom: false, dragging: false, zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 16);
L.tileLayer('${tileUrl()}', { subdomains: 'abcd', maxZoom: 20 }).addTo(map);
var icon = L.divIcon({ className: '', html: '<svg width="34" height="43" viewBox="0 0 42 52" fill="none"><path d="M21 50C21 50 38 31.9 38 18.8C38 9.3 30.4 2 21 2C11.6 2 4 9.3 4 18.8C4 31.9 21 50 21 50Z" fill="#6B19FF" stroke="white" stroke-width="4"/><circle cx="21" cy="19" r="7" fill="white"/></svg>', iconSize: [34, 43], iconAnchor: [17, 40] });
L.marker([${lat}, ${lng}], { icon: icon, interactive: false }).addTo(map);
</script></body></html>`;
}

function buildHtmlInteractive(lat: number, lng: number): string {
  return buildHtml(lat, lng).replace("dragging: false", "dragging: true");
}

function OwnerVehicleMap({ latitude, longitude, address, title, height = 180 }: OwnerVehicleMapProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(false);
  const hasCoords = latitude != null && longitude != null;

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const html = useMemo(
    () => (hasCoords ? buildHtml(Number(latitude), Number(longitude)) : ""),
    [hasCoords, latitude, longitude],
  );
  const htmlFull = useMemo(
    () => (hasCoords ? buildHtmlInteractive(Number(latitude), Number(longitude)) : ""),
    [hasCoords, latitude, longitude],
  );

  function openGoogleMaps() {
    void Linking.openURL(googleMapsUrl);
  }

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <MapPin color={theme.muted} size={15} />
          <Text style={styles.headTitle}>Vị trí xe</Text>
        </View>
        <Pressable onPress={openGoogleMaps} style={styles.mapsButton}>
          <Text style={styles.mapsText}>Mở Google Maps</Text>
        </Pressable>
      </View>
      <Text numberOfLines={2} style={styles.address}>
        {address}
      </Text>
      {hasCoords ? (
        <View style={[styles.mapBox, { height }]}>
          <WebView
            source={{ html }}
            style={styles.webview}
            scrollEnabled={false}
            nestedScrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
          />
          <Pressable onPress={() => setExpanded(true)} style={styles.expandBtn} accessibilityLabel="Mở rộng bản đồ">
            <Expand color={theme.brand} size={16} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.noCoords}>
          <MapPin color={theme.faint} size={20} />
          <Text style={styles.noCoordsText}>Chưa có tọa độ, xem vị trí theo địa chỉ trên Google Maps.</Text>
        </View>
      )}

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={[styles.full, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.fullHead}>
            <View style={styles.fullTitleWrap}>
              <Text numberOfLines={1} style={styles.fullTitle}>
                {title}
              </Text>
              <Text numberOfLines={1} style={styles.fullAddr}>
                {address}
              </Text>
            </View>
            <Pressable onPress={() => setExpanded(false)} style={styles.closeBtn}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>
          {hasCoords ? (
            <WebView
              source={{ html: htmlFull }}
              style={styles.fullMap}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["*"]}
            />
          ) : null}
          <View style={[styles.fullFoot, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable onPress={openGoogleMaps} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Mở Google Maps</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default memo(OwnerVehicleMap);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: { gap: 8 },
    headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    headLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    headTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    mapsButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    mapsText: { color: theme.text, fontSize: 12, fontWeight: "700" },
    address: { color: theme.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 },
    mapBox: {
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
    },
    webview: { flex: 1, backgroundColor: "transparent" },
    expandBtn: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    noCoords: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    noCoordsText: { color: theme.muted, fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },
    full: { flex: 1, backgroundColor: theme.background },
    fullHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    fullTitleWrap: { flex: 1, gap: 2 },
    fullTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    fullAddr: { color: theme.muted, fontSize: 12 },
    closeBtn: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    closeText: { color: theme.text, fontSize: 13, fontWeight: "800" },
    fullMap: { flex: 1 },
    fullFoot: { paddingHorizontal: 16, paddingTop: 10 },
    primaryBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
