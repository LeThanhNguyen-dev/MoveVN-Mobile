import { createElement, useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { stampWebPhoto } from "../utils/stampWebPhoto";
import type { InspectionType } from "../bookingDisplay";
import type { CapturedInspectionPhoto } from "../inspectionPhoto";
import { BookingButton } from "./BookingControls";

export type RawPhoto = { uri: string; width: number; height: number; capturedAt: string };
export default function InspectionCameraModal({ bookingCode, type, onCaptured, onClose }: {
  bookingCode: string; type: InspectionType; onCaptured: (photo: CapturedInspectionPhoto) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [photo, setPhoto] = useState<CapturedInspectionPhoto | null>(null);
  const ownedUrl = useRef<string | null>(null);
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    let stream: MediaStream | undefined;
    if (!navigator.mediaDevices?.getUserMedia) setError("Camera cần kết nối HTTPS và quyền truy cập camera.");
    else void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(media => {
      if (!alive.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      if (video.current) { video.current.srcObject = media; void video.current.play().catch(() => setError("Không phát được camera. Vui lòng mở lại.")); }
    }).catch(() => { if (alive.current) setError("Không mở được camera. Kiểm tra quyền camera và thiết bị."); });
    return () => { alive.current = false; stream?.getTracks().forEach(track => track.stop()); if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current); };
  }, []);
  async function capture() {
    if (!video.current || !ready || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) throw new Error("Camera chưa sẵn sàng");
      context.drawImage(video.current, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Không chụp được ảnh")), "image/jpeg", 0.9));
      const stamped = await stampWebPhoto(blob, [`MoveVN | ${bookingCode} | ${type === "CheckIn" ? "CHECK-IN" : "CHECK-OUT"}`]);
      if (!alive.current) { URL.revokeObjectURL(stamped.previewUrl); return; }
      ownedUrl.current = stamped.previewUrl;
      setPhoto({ id: `camera-${Date.now()}`, uri: stamped.previewUrl, capturedAt: stamped.capturedAt, source: "camera", file: { uri: stamped.previewUrl, name: `camera-${Date.now()}.jpg`, type: "image/jpeg" }, uploadBlob: stamped.blob });
    } catch { if (alive.current) setError("Không chụp hoặc đóng dấu được ảnh. Vui lòng chụp lại."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <Modal visible onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16, gap: 12 }}>
      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 20 }}>Chụp ảnh biên bản</Text>
      {createElement("video", { ref: video, autoPlay: true, playsInline: true, muted: true, onLoadedData: () => setReady(true), style: { width: "100%", maxHeight: "60vh", display: photo ? "none" : "block" } })}
      {photo && createElement("img", { src: photo.uri, alt: "Ảnh chụp xe đã có watermark", style: { width: "100%", maxHeight: "60vh", objectFit: "contain" } })}
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
      {photo ? <View style={{ gap: 12 }}><BookingButton secondary title="Chụp lại" onPress={() => { if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current); ownedUrl.current = null; setPhoto(null); }} /><BookingButton title="Dùng ảnh này" onPress={() => { ownedUrl.current = null; onCaptured(photo); onClose(); }} /></View> : <BookingButton title="Chụp ảnh xe" busy={busy} disabled={!ready} onPress={() => void capture()} />}
      <BookingButton secondary title="Đóng camera" disabled={busy} onPress={onClose} />
    </SafeAreaView>
  </Modal>;
}
