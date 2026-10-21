import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, Linking, Modal, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, X } from "lucide-react-native";
import { captureRef } from "react-native-view-shot";
import { inspectionLabel, inspectionWatermark, type InspectionType } from "../bookingDisplay";
import { deleteInspectionPhoto, resizeCameraPhoto, stampedInspectionPhoto, type CapturedInspectionPhoto } from "../inspectionPhoto";
import { getServerTimeISO } from "../utils/serverTime";

export type RawPhoto = { uri: string; width: number; height: number; capturedAt: string };

// No image picker or library entry point is used in this capture flow.
export default function InspectionCameraModal({ bookingCode, type, sourcePhoto, onCaptured, onClose }: {
  bookingCode: string; type: InspectionType; sourcePhoto?: RawPhoto; onCaptured: (photo: CapturedInspectionPhoto) => void; onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const stampView = useRef<View>(null);
  const alive = useRef(true);
  const captureLock = useRef(false);
  const temporaryFiles = useRef(new Set<string>());
  const [active, setActive] = useState(AppState.currentState == null || AppState.currentState === "active");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(Boolean(sourcePhoto));
  const [error, setError] = useState("");
  const [raw, setRaw] = useState<RawPhoto | null>(sourcePhoto ?? null);
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [stamped, setStamped] = useState<CapturedInspectionPhoto | null>(null);

  useEffect(() => {
    alive.current = true;
    if (sourcePhoto) temporaryFiles.current.add(sourcePhoto.uri);
    const subscription = AppState.addEventListener("change", (state) => { setActive(state === "active"); setReady(false); });
    return () => {
      alive.current = false;
      subscription.remove();
      temporaryFiles.current.forEach((uri) => deleteInspectionPhoto(uri));
    };
  }, []);

  function track(uri: string) {
    if (!alive.current) { deleteInspectionPhoto(uri); return false; }
    temporaryFiles.current.add(uri);
    return true;
  }

  async function takePhoto() {
    if (!camera.current || !ready || captureLock.current) return;
    captureLock.current = true;
    setBusy(true); setError(""); setLoaded(false); setLaidOut(false);
    try {
      // Giờ hệ thống (server) để watermark không lệch theo giờ máy.
      const capturedAt = await getServerTimeISO();
      const photo = await camera.current.takePictureAsync({ quality: 0.9, exif: false });
      if (!photo) throw new Error("No camera photo returned");
      if (!track(photo.uri)) return;
      const resized = await resizeCameraPhoto(photo.uri, photo.width, photo.height);
      if (!track(resized.uri)) return;
      setRaw({ ...resized, capturedAt });
    } catch {
      if (alive.current) { setError("Không thể chụp ảnh. Vui lòng thử lại."); setBusy(false); }
      captureLock.current = false;
    }
  }

  useEffect(() => {
    if (!raw || !loaded || !laidOut) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (cancelled || !alive.current) return;
        try {
          // iOS renderInContext draws the layer at its point-sized bounds and
          // already applies the device pixel scale. Passing pixel dimensions
          // allocates a canvas 2-3 times too large without scaling its content,
          // leaving the photo in the corner of an otherwise blank JPEG.
          const size = Platform.OS === "ios" ? {} : { width: raw.width, height: raw.height };
          const uri = await captureRef(stampView, { format: "jpg", quality: 0.9, result: "tmpfile", ...size, useRenderInContext: Platform.OS === "ios" });
          if (!track(uri)) return;
          const stampedPhoto = stampedInspectionPhoto(uri, raw.capturedAt);
          const photo = sourcePhoto ? { ...stampedPhoto, source: "library" as const } : stampedPhoto;
          if (!cancelled) setStamped(photo);
        } catch {
          if (!cancelled && alive.current) setError("Không thể gắn watermark vào ảnh. Vui lòng chụp lại.");
        } finally {
          if (!cancelled && alive.current) setBusy(false);
          captureLock.current = false;
        }
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [raw, loaded, laidOut]);

  useEffect(() => {
    if (!raw || !busy) return;
    const timer = setTimeout(() => {
      setBusy(false); captureLock.current = false;
      setError("Xử lý ảnh quá lâu. Vui lòng chụp lại.");
    }, 20000);
    return () => clearTimeout(timer);
  }, [raw, busy]);

  function retake() {
    temporaryFiles.current.forEach((uri) => deleteInspectionPhoto(uri)); temporaryFiles.current.clear();
    setRaw(null); setStamped(null); setLoaded(false); setLaidOut(false); setReady(false); setError("");
  }

  const watermark = raw ? inspectionWatermark(bookingCode, type, raw.capturedAt) : [];
  if (sourcePhoto && watermark[1]) watermark[1] = `THÊM ẢNH: ${watermark[1]}`;
  const pixelRatio = Math.max(1, PixelRatio.get());
  const exportWidth = raw ? raw.width / pixelRatio : 0;
  const exportHeight = raw ? raw.height / pixelRatio : 0;
  const fontSize = Math.max(10, Math.round(exportWidth * 0.024));

  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}><Text style={styles.title}>{inspectionLabel(type)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng camera" disabled={busy} onPress={onClose} style={styles.close}><X color="#fff" size={24} /></Pressable>
      </View>
      {Platform.OS === "web" ? <View style={styles.center}><Text style={styles.copy}>Hãy dùng app Android/iOS để chụp ảnh bàn giao xe.</Text></View>
        : !raw && !permission ? <View style={styles.center}><ActivityIndicator color="#fff" /></View>
        : !raw && !permission?.granted ? <View style={styles.center}>
          <Text style={styles.copy}>Cần quyền camera để chụp ảnh xe. Bạn cũng có thể đóng camera và chọn ảnh từ thư viện.</Text>
          <Pressable style={styles.action} onPress={() => { void (permission?.canAskAgain ? requestPermission() : Linking.openSettings()).catch(() => setError("Không thể mở quyền camera.")); }}><Text style={styles.actionText}>{permission?.canAskAgain ? "Cho phép camera" : "Mở cài đặt"}</Text></Pressable>
        </View>
        : raw ? <View style={styles.preview}>
          <Image accessibilityLabel={stamped ? "Ảnh đã gắn watermark" : "Ảnh đang xử lý"} source={{ uri: stamped?.uri ?? raw.uri }} style={styles.previewImage} resizeMode="contain" />
          {busy ? <View style={styles.processing}><ActivityIndicator color="#fff" /><Text style={styles.copy}>Đang ghi ngày giờ lên ảnh…</Text></View> : null}
          {/* Keep the composition mounted at export resolution, outside the preview. */}
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.exportContainer}>
            <View ref={stampView} collapsable={false} onLayout={() => setLaidOut(true)} style={{ width: exportWidth, height: exportHeight, backgroundColor: "#000" }}>
              <Image source={{ uri: raw.uri }} fadeDuration={0} onLoad={() => setLoaded(true)} onError={() => { setError("Không đọc được ảnh. Vui lòng chụp lại."); setBusy(false); captureLock.current = false; }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              <View style={{ position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, maxWidth: "86%" }}>
                {watermark.map((line) => <Text key={line} allowFontScaling={false} style={{ color: "#fff", fontSize, lineHeight: fontSize * 1.45, fontWeight: "700" }}>{line}</Text>)}
              </View>
            </View>
          </View>
        </View> : active ? <CameraView ref={camera} style={styles.camera} facing="back" mode="picture" onCameraReady={() => setReady(true)}
          onMountError={() => { setError("Không thể mở camera trên thiết bị này."); setReady(false); }} /> : <View style={styles.center}><Text style={styles.copy}>Camera tạm dừng.</Text></View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.copy}>{sourcePhoto ? "Ảnh thư viện · Ngày giờ thêm ảnh (UTC+07:00)" : "Ảnh chụp camera · Watermark ngày giờ Việt Nam (UTC+07:00)"}</Text>
        {raw ? <View style={styles.buttons}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.action} onPress={sourcePhoto ? onClose : retake}><Text style={styles.actionText}>{sourcePhoto ? "Chọn ảnh khác" : "Chụp lại"}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!stamped || busy} style={[styles.action, (!stamped || busy) && styles.disabled]} onPress={() => {
            if (!stamped) return;
            temporaryFiles.current.delete(stamped.uri); onCaptured(stamped); onClose();
          }}><Text style={styles.actionText}>Dùng ảnh này</Text></Pressable>
        </View> : Platform.OS !== "web" && permission?.granted ? <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh xe" disabled={!ready || busy || !active} onPress={() => void takePhoto()} style={[styles.shutter, (!ready || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#000" /> : <Camera color="#000" size={30} />}
        </Pressable> : null}
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" }, header: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", minHeight: 56 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 }, close: { padding: 12 },
  camera: { flex: 1 }, center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 24 },
  copy: { color: "#fff", fontSize: 14, textAlign: "center", lineHeight: 22 }, footer: { padding: 20, gap: 16, alignItems: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  action: { backgroundColor: "#fff", padding: 14, borderRadius: 10, minWidth: 120, alignItems: "center" }, actionText: { color: "#111", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.4 }, buttons: { flexDirection: "row", gap: 12 }, error: { color: "#fca5a5", textAlign: "center", padding: 12 },
  preview: { flex: 1 }, previewImage: { width: "100%", height: "100%" }, processing: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 12 },
  exportContainer: { position: "absolute", left: -10000, top: 0 },
});
