import { useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import { getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import type { UploadFileInput } from "@/types/upload";
import { uploadSupportTicketAttachment } from "./supportTicketService";
import { parseSupportTicketAttachmentUrls, serializeSupportTicketAttachmentUrls } from "./supportTicketAttachments";
import { MAX_TICKET_IMAGES, MAX_TICKET_IMAGE_BYTES, ticketError } from "./ticketModel";
import { TicketButton, TicketNotice, ticketStyles } from "./TicketUi";

type Photo = { uri: string; input: UploadFileInput };
export function useTicketImages() {
  const [photos, setPhotos] = useState<Photo[]>([]); const [error, setError] = useState(""); const [picking, setPicking] = useState(false);
  const uploaded = useRef(new Map<string, string>()); const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function pick(camera = false) {
    if (lock.current || photos.length >= MAX_TICKET_IMAGES) return;
    lock.current = true; setPicking(true); setError("");
    const generation = getSessionGeneration();
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error("Hãy cho phép truy cập camera trong cài đặt của điện thoại."); }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: MAX_TICKET_IMAGES - photos.length, quality: 0.85 });
      if (result.canceled) return;
      const next: Photo[] = [];
      for (const asset of result.assets.slice(0, MAX_TICKET_IMAGES - photos.length)) {
        let uri = asset.uri; let mime = asset.mimeType ?? "";
        let name = asset.fileName ?? "";
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
          const converted = await manipulateAsync(uri, [], { compress: 0.85, format: SaveFormat.JPEG });
          uri = converted.uri; mime = "image/jpeg"; name = "";
        }
        const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        if (!new RegExp(`\\.${extension === "jpg" ? "jpe?g" : extension}$`, "i").test(name)) name = `support-${Date.now()}-${next.length}.${extension}`;
        let input: UploadFileInput;
        if (Platform.OS === "web") { const blob = await (await fetch(uri)).blob(); if (blob.size > MAX_TICKET_IMAGE_BYTES) throw new Error("Mỗi ảnh tối đa 5 MB. Hãy chọn ảnh nhỏ hơn."); input = new globalThis.File([blob], name, { type: mime }); }
        else { if (new File(uri).size > MAX_TICKET_IMAGE_BYTES) throw new Error("Mỗi ảnh tối đa 5 MB. Hãy chọn ảnh nhỏ hơn."); input = { uri, name, type: mime }; }
        next.push({ uri, input });
      }
      if (alive.current && generation === getSessionGeneration()) setPhotos(current => [...current, ...next].slice(0, MAX_TICKET_IMAGES));
    } catch (e) { if (alive.current) setError(ticketError(e, "Không chọn được ảnh. Vui lòng kiểm tra quyền truy cập ảnh.")); }
    finally { lock.current = false; if (alive.current) setPicking(false); }
  }
  async function upload() {
    const generation = getSessionGeneration(); const urls: string[] = [];
    for (const photo of photos) {
      if (!alive.current || generation !== getSessionGeneration()) throw new Error("Phiên đăng nhập đã thay đổi.");
      let url = uploaded.current.get(photo.uri);
      if (!url) { url = await uploadSupportTicketAttachment(photo.input); uploaded.current.set(photo.uri, url); }
      urls.push(url);
    }
    if (!alive.current || generation !== getSessionGeneration()) throw new Error("Phiên đăng nhập đã thay đổi.");
    const serialized = serializeSupportTicketAttachmentUrls(urls);
    if (serialized && serialized.length > 4000) throw new Error("Thông tin ảnh quá dài. Hãy bớt ảnh rồi thử lại.");
    return serialized;
  }
  return { photos, error, picking, pick, upload, remove: (uri: string) => setPhotos(p => p.filter(x => x.uri !== uri)), clear: () => { setPhotos([]); uploaded.current.clear(); setError(""); } };
}
export function TicketImageInput({ images, disabled }: { images: ReturnType<typeof useTicketImages>; disabled?: boolean }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <View style={{ gap: 10 }}><View style={styles.row}><AppText style={styles.label}>Ảnh đính kèm</AppText><AppText style={styles.muted}>{images.photos.length}/{MAX_TICKET_IMAGES} · JPG, PNG, WebP · tối đa 5 MB/ảnh</AppText></View>
    <View style={styles.row}><TicketButton secondary title="Chọn ảnh" icon={<ImagePlus size={18} color={theme.brand} />} disabled={disabled || images.picking || images.photos.length >= MAX_TICKET_IMAGES} onPress={() => { void images.pick(); }} /><TicketButton secondary title="Chụp ảnh" icon={<Camera size={18} color={theme.brand} />} disabled={disabled || images.picking || images.photos.length >= MAX_TICKET_IMAGES} onPress={() => { void images.pick(true); }} /></View>
    {images.error && <TicketNotice message={images.error} />}
    <View style={styles.row}>{images.photos.map((photo, index) => <View key={photo.uri + index}><Image source={{ uri: photo.uri }} style={{ width: 88, height: 88, borderRadius: 12 }} /><Pressable accessibilityRole="button" accessibilityLabel={`Xóa ảnh ${index + 1}`} disabled={disabled || images.picking} onPress={() => images.remove(photo.uri)} style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: theme.overlay, borderRadius: 12 }}><X color="#fff" size={19} /></Pressable></View>)}</View>
  </View>;
}
export function TicketGallery({ value }: { value?: string | null }) {
  const { theme } = useTheme(); const [selected, setSelected] = useState<string | null>(null);
  const urls = parseSupportTicketAttachmentUrls(value).filter(url => /^https?:\/\//i.test(url));
  if (!urls.length) return null;
  return <><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{urls.map((url, index) => <Pressable key={url + index} accessibilityRole="button" accessibilityLabel={`Xem ảnh đính kèm ${index + 1}`} onPress={() => setSelected(url)}><Image source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: theme.surfaceAlt }} /></Pressable>)}</View>
    <Modal visible={selected !== null} animationType="fade" onRequestClose={() => setSelected(null)}><SafeAreaView style={{ flex: 1, backgroundColor: "#101019" }}><Pressable accessibilityRole="button" accessibilityLabel="Đóng ảnh" onPress={() => setSelected(null)} style={{ minHeight: 48, alignSelf: "flex-end", padding: 14 }}><X color="#fff" size={24} /></Pressable><ScrollView contentContainerStyle={{ flexGrow: 1 }} maximumZoomScale={4} minimumZoomScale={1}>{selected && <Image source={{ uri: selected }} resizeMode="contain" style={{ flex: 1, minHeight: 400 }} />}</ScrollView></SafeAreaView></Modal>
  </>;
}
