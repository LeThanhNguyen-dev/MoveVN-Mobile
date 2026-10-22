import { useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { createSupportTicket, uploadSupportTicketAttachment, getSupportTicketById, addSupportTicketMessage, getMySupportTickets } from "@/features/supportTickets/supportTicketService";
import type { SupportTicketDetailResponse } from "@/features/supportTickets/types";
import { BookingButton, BookingField } from "./BookingControls";

const reasons = ["Bàn giao nhận xe", "Bàn giao trả xe", "Thanh toán trực tiếp", "Xác nhận nhầm", "Vấn đề khác"];
type Photo = { uri: string; name: string; type: string };

export default function BookingAssistance({ bookingId, bookingCode }: { bookingId: number; bookingCode: string }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]!);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ticket, setTicket] = useState<SupportTicketDetailResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function pick() {
    if (lock.current) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setError("Cho phép camera để chụp ảnh bằng chứng."); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      if (result.assets.some(a => (a.fileSize ?? 0) > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(a.mimeType ?? "image/jpeg"))) {
        setError("Chỉ nhận JPG, PNG hoặc WebP, mỗi ảnh tối đa 5MB."); return;
      }
      setPhotos(current => [...current, ...result.assets.map(a => ({ uri: a.uri, name: a.fileName ?? "bang-chung.jpg", type: a.mimeType ?? "image/jpeg" }))].slice(0, 6));
    } catch (e) { setError(getApiErrorMessage(e, "Không chọn được ảnh.")); }
  }
  async function send() {
    if (lock.current || !message.trim()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const urls: string[] = [];
      for (const photo of photos) urls.push(await uploadSupportTicketAttachment(photo));
      const updated = ticket
        ? await addSupportTicketMessage(ticket.id, { message: message.trim(), attachmentUrls: urls.join("\n") || undefined })
        : await createSupportTicket({ bookingId, category: "Booking", subject: reason, message: message.trim(), priority: "High", attachmentUrls: urls.join("\n") || undefined });
      setTicket(updated); setMessage(""); setPhotos([]);
    } catch (e) { setError(getApiErrorMessage(e, "Chưa gửi được yêu cầu. Nội dung vẫn được giữ để bạn thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  }
  async function show() {
    if (lock.current) return;
    setOpen(true); lock.current = true; setBusy(true); setError("");
    try {
      const page = await getMySupportTickets({ bookingId, page: 1, pageSize: 1 });
      if (page.items[0]) setTicket(await getSupportTicketById(page.items[0].id));
    } catch (e) { setError(getApiErrorMessage(e, "Chưa tải được yêu cầu hỗ trợ trước đó.")); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() {
    if (!ticket || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { setTicket(await getSupportTicketById(ticket.id)); }
    catch (e) { setError(getApiErrorMessage(e, "Chưa tải được phản hồi.")); }
    finally { lock.current = false; setBusy(false); }
  }
  const close = () => { if (!lock.current) setOpen(false); };
  const closed = ticket && ["Closed", "Resolved"].includes(ticket.status);
  return <>
    <BookingButton secondary title="Yêu cầu hỗ trợ / Gửi bằng chứng" onPress={() => void show()} />
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 16 }}>
        <View style={{ maxHeight: "92%", backgroundColor: theme.surface, padding: 16, borderRadius: 14, gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>Hỗ trợ booking {bookingCode}</Text>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.muted }}>Nhân viên sẽ đối chiếu biên bản, bằng chứng và lịch sử. Gửi yêu cầu không tự xác nhận trả xe, nhận tiền hoặc hoàn tiền.</Text>
            {ticket ? <>
              <Text style={{ color: theme.brand, fontWeight: "700" }}>Yêu cầu {ticket.ticketNumber} · {({ Open: "Đang chờ xử lý", InProgress: "Đang hỗ trợ", Resolved: "Đã xử lý", Closed: "Đã đóng" } as Record<string, string>)[ticket.status] ?? ticket.status}</Text>
              <BookingButton secondary title="Tải phản hồi mới" disabled={busy} onPress={() => void refresh()} />
              {ticket.messages.map(item => <View key={item.id} style={{ backgroundColor: theme.surfaceAlt, padding: 10, borderRadius: 8, gap: 4 }}>
                <Text style={{ color: theme.text, fontWeight: "700" }}>{item.senderName}</Text>
                <Text style={{ color: theme.text }}>{item.message}</Text>
                {(item.attachmentUrls ?? "").split(/[\n,]+/).filter(url => /^https:\/\//.test(url.trim())).map(url => <Image key={url} source={{ uri: url.trim() }} accessibilityLabel="Ảnh bằng chứng hỗ trợ" style={{ width: 140, height: 140, borderRadius: 8 }} />)}
              </View>)}
            </> : <View style={{ gap: 8 }}>{reasons.map(value => <BookingButton key={value} secondary title={(reason === value ? "✓ " : "") + value} disabled={busy} onPress={() => setReason(value)} />)}</View>}
            {!closed ? <>
              <BookingField label="Mô tả sự việc / Nội dung phản hồi" value={message} onChangeText={setMessage} editable={!busy} multiline />
              <BookingButton secondary title={"Chụp ảnh bằng chứng (" + photos.length + "/6)"} disabled={busy || photos.length >= 6} onPress={() => void pick()} />
              {photos.map((photo, index) => <Pressable key={photo.uri + index} disabled={busy} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))}><Text style={{ color: theme.danger }}>Xóa ảnh {index + 1}: {photo.name}</Text></Pressable>)}
              <BookingButton title={ticket ? "Gửi phản hồi" : "Gửi yêu cầu hỗ trợ"} busy={busy} disabled={!message.trim()} onPress={() => void send()} />
            </> : <BookingButton secondary title="Gửi yêu cầu mới" onPress={() => { setTicket(null); setMessage(""); setPhotos([]); }} />}
            {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
            {busy ? <ActivityIndicator color={theme.brand} /> : null}
          </ScrollView>
          <BookingButton secondary title="Đóng" disabled={busy} onPress={close} />
        </View>
      </View>
    </Modal>
  </>;
}
