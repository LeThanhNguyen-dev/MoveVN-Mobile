import { createElement, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [photo, setPhoto] = useState<CapturedInspectionPhoto | null>(null);
  const ownedUrl = useRef<string | null>(null);
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    let stream: MediaStream | undefined;
    if (!navigator.mediaDevices?.getUserMedia) setError(t("mobile:inspection.cameraWeb.httpsError"));
    else void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(media => {
      if (!alive.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      if (video.current) { video.current.srcObject = media; void video.current.play().catch(() => setError(t("mobile:inspection.cameraWeb.playError"))); }
    }).catch(() => { if (alive.current) setError(t("mobile:inspection.cameraWeb.openError")); });
    return () => { alive.current = false; stream?.getTracks().forEach(track => track.stop()); if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current); };
  }, []);
  async function capture() {
    if (!video.current || !ready || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) throw new Error(t("mobile:inspection.cameraWeb.notReady"));
      context.drawImage(video.current, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(t("mobile:inspection.cameraWeb.captureError"))), "image/jpeg", 0.9));
      const stamped = await stampWebPhoto(blob, [`MoveVN | ${bookingCode} | ${type === "CheckIn" ? "CHECK-IN" : "CHECK-OUT"}`]);
      if (!alive.current) { URL.revokeObjectURL(stamped.previewUrl); return; }
      ownedUrl.current = stamped.previewUrl;
      setPhoto({ id: `camera-${Date.now()}`, uri: stamped.previewUrl, capturedAt: stamped.capturedAt, source: "camera", file: { uri: stamped.previewUrl, name: `camera-${Date.now()}.jpg`, type: "image/jpeg" }, uploadBlob: stamped.blob });
    } catch { if (alive.current) setError(t("mobile:inspection.cameraWeb.stampError")); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <Modal visible onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16, gap: 12 }}>
      <Text style={{ color: theme.text, fontWeight: "700", fontSize: 20 }}>{t("booking:inspection.camera.title")}</Text>
      {createElement("video", { ref: video, autoPlay: true, playsInline: true, muted: true, onLoadedData: () => setReady(true), style: { width: "100%", maxHeight: "60vh", display: photo ? "none" : "block" } })}
      {photo && createElement("img", { src: photo.uri, alt: t("mobile:inspection.cameraWeb.photoAlt"), style: { width: "100%", maxHeight: "60vh", objectFit: "contain" } })}
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>}
      {photo ? <View style={{ gap: 12 }}><BookingButton secondary title={t("mobile:inspection.camera.retake")} onPress={() => { if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current); ownedUrl.current = null; setPhoto(null); }} /><BookingButton title={t("mobile:inspection.camera.usePhoto")} onPress={() => { ownedUrl.current = null; onCaptured(photo); onClose(); }} /></View> : <BookingButton title={t("booking:inspection.camera.button")} busy={busy} disabled={!ready} onPress={() => void capture()} />}
      <BookingButton secondary title={t("mobile:inspection.camera.closeAria")} disabled={busy} onPress={onClose} />
    </SafeAreaView>
  </Modal>;
}
