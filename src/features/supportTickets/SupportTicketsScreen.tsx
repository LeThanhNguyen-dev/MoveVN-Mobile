import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { ChevronLeft, ChevronRight, Headphones, MessageCircle, Plus, Search, Send } from "lucide-react-native";
import AppText from "@/components/AppText";
import { getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/theme/useTheme";
import { createSupportTicket, getMySupportTickets, getSupportTicketById, addSupportTicketMessage } from "./supportTicketService";
import type { SupportTicketDetailResponse, SupportTicketListRequest, TicketEntry } from "./types";
import { supportTicketCategoryOptions, supportTicketPriorityOptions, supportTicketPriorityLabels, supportTicketStatusOptions } from "./supportTicketConstants";
import { isTicketClosed, ticketDate, ticketError, validateReply, validateTicket } from "./ticketModel";
import { TicketButton, TicketChoice, TicketHeader, TicketNotice, TicketStatus, ticketStyles } from "./TicketUi";
import { TicketGallery, TicketImageInput, useTicketImages } from "./TicketAttachments";
import { useTicketData } from "./useTicketData";
import TicketQualityPanel from "./TicketQualityPanel";

type Route = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: number };
export default function SupportTicketsScreen({ entry, onClose, registerBack }: { entry: TicketEntry; onClose: () => void; registerBack?: (action: () => void) => void }) {
  const [route, setRoute] = useState<Route>(entry.ticketId ? { kind: "detail", id: entry.ticketId } : entry.create ? { kind: "create" } : { kind: "list" });
  const [filters, setFilters] = useState<SupportTicketListRequest>({ page: 1, pageSize: 10, bookingId: entry.bookingId });
  const back = () => route.kind === "list" || (entry.ticketId && route.kind === "detail") ? onClose() : setRoute({ kind: "list" });
  const context = entry.bookingId ? `${entry.bookingCode || `Booking #${entry.bookingId}`} · Yêu cầu của bạn` : "Chỉ hiển thị yêu cầu của bạn";
  useEffect(() => { if (route.kind === "list") registerBack?.(onClose); }, [route.kind, registerBack, onClose]);
  return route.kind === "create" ? <TicketCreate entry={entry} onBack={back} registerBack={registerBack} onCreated={ticket => setRoute({ kind: "detail", id: ticket.id })} />
    : route.kind === "detail" ? <TicketDetail key={route.id} id={route.id} onBack={back} registerBack={registerBack} />
      : <TicketList filters={filters} onFilters={setFilters} subtitle={context} onBack={onClose} onCreate={() => setRoute({ kind: "create" })} onOpen={id => setRoute({ kind: "detail", id })} />;
}

function TicketList({ filters, onFilters, subtitle, onBack, onCreate, onOpen }: { filters: SupportTicketListRequest; onFilters: (q: SupportTicketListRequest) => void; subtitle: string; onBack: () => void; onCreate: () => void; onOpen: (id: number) => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme); const [keyword, setKeyword] = useState(filters.keyword ?? "");
  const loader = useCallback((signal: AbortSignal) => getMySupportTickets(filters, signal), [filters]);
  const query = useTicketData(loader); const totalPages = query.data ? Math.ceil(query.data.totalCount / query.data.pageSize) : 0;
  const page = filters.page ?? 1;
  useEffect(() => { if (query.data && totalPages > 0 && page > totalPages) onFilters({ ...filters, page: totalPages }); }, [query.data, totalPages, page, filters, onFilters]);
  useEffect(() => { const back = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; }); return () => back.remove(); }, [onBack]);
  return <View style={styles.screen}><TicketHeader title="Yêu cầu hỗ trợ" subtitle={subtitle} onBack={onBack} onRefresh={query.refresh} busy={query.refreshing} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.refreshing && !query.loading} onRefresh={query.refresh} tintColor={theme.brand} />}>
      <View style={[styles.card, { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder }]}><Headphones size={27} color={theme.brand} /><AppText display style={styles.title}>MoveVN luôn sẵn sàng hỗ trợ</AppText><AppText style={styles.body}>Gửi vấn đề, theo dõi tiến độ và trao đổi trực tiếp với đội ngũ hỗ trợ.</AppText><TicketButton title="Tạo yêu cầu mới" icon={<Plus size={18} color={theme.onBrand} />} onPress={onCreate} /></View>
      <View style={styles.card}><AppText style={styles.label}>Tìm yêu cầu</AppText><TextInput accessibilityLabel="Tìm theo mã hoặc tiêu đề" style={styles.input} value={keyword} onChangeText={setKeyword} maxLength={100} placeholder="Nhập mã hoặc tiêu đề" placeholderTextColor={theme.placeholder} returnKeyType="search" onSubmitEditing={() => onFilters({ ...filters, keyword: keyword.trim() || undefined, page: 1 })} />
        <TicketButton title="Tìm kiếm" secondary icon={<Search size={18} color={theme.brand} />} onPress={() => onFilters({ ...filters, keyword: keyword.trim() || undefined, page: 1 })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{supportTicketStatusOptions.map(option => <TicketChoice key={option.value} title={option.label ?? option.value} selected={(filters.status ?? "") === option.value} onPress={() => onFilters({ ...filters, status: option.value || undefined, page: 1 })} />)}</ScrollView>
        <AppText style={styles.muted}>Nhóm yêu cầu</AppText><View style={styles.row}>{[{ value: "", label: "Tất cả nhóm" }, ...supportTicketCategoryOptions].map(option => <TicketChoice key={option.value} title={option.label} selected={(filters.category ?? "") === option.value} onPress={() => onFilters({ ...filters, category: option.value || undefined, page: 1 })} />)}</View>
        {Boolean(filters.status || filters.category || filters.keyword) && <TicketButton title="Xóa bộ lọc" secondary onPress={() => { setKeyword(""); onFilters({ bookingId: filters.bookingId, page: 1, pageSize: 10 }); }} />}
      </View>
      {query.loading && <View style={styles.empty}><ActivityIndicator size="large" color={theme.brand} /><AppText style={styles.muted}>Đang tải yêu cầu…</AppText></View>}
      {query.error && <TicketNotice message={query.error} onRetry={query.refresh} />}
      {!query.loading && query.data && <><AppText style={styles.muted}>{query.data.totalCount} yêu cầu phù hợp · Sắp theo hoạt động mới nhất</AppText>
        {query.data.items.length === 0 && !query.error && <View style={styles.empty}><MessageCircle color={theme.faint} size={42} /><AppText style={styles.title}>Chưa có yêu cầu phù hợp</AppText><AppText style={styles.muted}>Thử thay đổi bộ lọc hoặc tạo yêu cầu mới.</AppText><TicketButton title="Gửi yêu cầu hỗ trợ" onPress={onCreate} /></View>}
        {query.data.items.map(ticket => <Pressable accessibilityRole="button" accessibilityLabel={`Mở yêu cầu ${ticket.ticketNumber}`} onPress={() => onOpen(ticket.id)} key={ticket.id} style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontWeight: "700", fontSize: 12 }}>{ticket.ticketNumber}</AppText><TicketStatus status={ticket.status} /></View><AppText style={styles.title}>{ticket.subject}</AppText><AppText style={styles.muted}>{supportTicketCategoryOptions.find(c => c.value === ticket.category)?.label ?? ticket.category} · Ưu tiên: {supportTicketPriorityLabels[ticket.priority] ?? ticket.priority}</AppText><AppText style={styles.muted}>{ticket.assignedStaffName ? `Phụ trách: ${ticket.assignedStaffName}` : "Đang chờ phân công nhân viên"}</AppText><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>{ticket.messageCount} tin nhắn · {ticketDate(ticket.lastMessageAt ?? ticket.createdAt)}</AppText><ChevronRight color={theme.brand} size={18} /></View></Pressable>)}
        {totalPages > 1 && <View style={[styles.card, styles.row, { justifyContent: "space-between" }]}><AppText style={styles.muted}>Trang {page}/{totalPages}</AppText><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Trang trước" disabled={page <= 1 || query.refreshing} onPress={() => onFilters({ ...filters, page: page - 1 })} style={[styles.iconButton, { backgroundColor: theme.brandSoft, opacity: page <= 1 ? 0.4 : 1 }]}><ChevronLeft size={20} color={theme.brand} /></Pressable>{[...new Set([1, page, totalPages])].map(p => <TicketChoice key={p} title={`${p}`} selected={page === p} disabled={query.refreshing} onPress={() => onFilters({ ...filters, page: p })} />)}<Pressable accessibilityRole="button" accessibilityLabel="Trang sau" disabled={page >= totalPages || query.refreshing} onPress={() => onFilters({ ...filters, page: page + 1 })} style={[styles.iconButton, { backgroundColor: theme.brandSoft, opacity: page >= totalPages ? 0.4 : 1 }]}><ChevronRight size={20} color={theme.brand} /></Pressable></View></View>}
      </>}
    </ScrollView>
  </View>;
}

function TicketCreate({ entry, onBack, onCreated, registerBack }: { entry: TicketEntry; onBack: () => void; onCreated: (ticket: SupportTicketDetailResponse) => void; registerBack?: (action: () => void) => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [category, setCategory] = useState(entry.bookingId ? "Booking" : "Other"); const [priority, setPriority] = useState("Normal"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const images = useTicketImages(); const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function back() {
    if (lock.current || images.picking) return;
    if (!subject.trim() && !message.trim() && !images.photos.length) return onBack();
    Alert.alert("Bỏ nội dung đang soạn?", "Yêu cầu này chưa được gửi.", [{ text: "Soạn tiếp", style: "cancel" }, { text: "Bỏ nội dung", style: "destructive", onPress: onBack }]);
  }
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; }); return () => sub.remove(); });
  useEffect(() => { registerBack?.(back); });
  async function send() {
    if (lock.current || images.picking) return;
    const request = { bookingId: entry.bookingId, category, priority, subject: subject.trim(), message: message.trim() };
    const validation = validateTicket(request); if (validation) { setError(validation); return; }
    lock.current = true; setBusy(true); setError(""); const generation = getSessionGeneration();
    try {
      const attachmentUrls = await images.upload();
      if (!alive.current || generation !== getSessionGeneration()) return;
      const result = await createSupportTicket({ ...request, attachmentUrls });
      if (alive.current && generation === getSessionGeneration()) onCreated(result);
    } catch (e) { if (alive.current && generation === getSessionGeneration()) setError(ticketError(e, "Chưa gửi được yêu cầu. Nội dung và ảnh vẫn được giữ để thử lại.")); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><TicketHeader title="Tạo yêu cầu hỗ trợ" onBack={back} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {entry.bookingId && <View style={[styles.card, { backgroundColor: theme.brandSoft }]}><AppText style={styles.label}>Liên quan: {entry.bookingCode || `Booking #${entry.bookingId}`}</AppText><AppText style={styles.muted}>Nếu bạn đã có yêu cầu đang mở cho booking này, nội dung sẽ được gửi vào yêu cầu đó.</AppText></View>}
    <View style={styles.card}><AppText style={styles.label}>Nhóm vấn đề</AppText><View style={styles.row}>{(entry.bookingId ? supportTicketCategoryOptions.filter(c => c.value === "Booking") : supportTicketCategoryOptions).map(c => <TicketChoice key={c.value} title={c.label} selected={category === c.value} disabled={busy} onPress={() => setCategory(c.value)} />)}</View>
      <AppText style={styles.label}>Tiêu đề *</AppText><TextInput accessibilityLabel="Tiêu đề yêu cầu" editable={!busy} value={subject} onChangeText={setSubject} maxLength={entry.bookingId ? 160 : 200} placeholder="Tóm tắt vấn đề bạn gặp" placeholderTextColor={theme.placeholder} style={styles.input} /><AppText style={styles.count}>{subject.length}/{entry.bookingId ? 160 : 200}</AppText>
      <AppText style={styles.label}>Mức ưu tiên</AppText><View style={styles.row}>{supportTicketPriorityOptions.map(p => <TicketChoice key={p.value} title={p.label ?? p.value} selected={priority === p.value} disabled={busy} onPress={() => setPriority(p.value)} />)}</View><AppText style={styles.muted}>Chọn theo mức độ ảnh hưởng thực tế. Nhân viên sẽ xử lý theo chính sách hỗ trợ.</AppText>
      <AppText style={styles.label}>Nội dung *</AppText><TextInput accessibilityLabel="Nội dung yêu cầu" editable={!busy} multiline value={message} onChangeText={setMessage} maxLength={4000} placeholder="Mô tả sự việc, thời điểm xảy ra và điều bạn cần hỗ trợ…" placeholderTextColor={theme.placeholder} style={[styles.input, styles.textarea]} /><AppText style={styles.count}>{message.length}/4.000</AppText>
      <TicketImageInput images={images} disabled={busy} />
    </View>
    {error && <TicketNotice message={error} />}
    <TicketButton title="Gửi yêu cầu" busy={busy} disabled={images.picking} icon={<Send size={18} color={theme.onBrand} />} onPress={() => { void send(); }} />
    <AppText style={styles.muted}>Sau khi gửi, bạn có thể theo dõi trạng thái và phản hồi trong chi tiết yêu cầu.</AppText>
  </ScrollView></KeyboardAvoidingView>;
}

function TicketDetail({ id, onBack, registerBack }: { id: number; onBack: () => void; registerBack?: (action: () => void) => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  const loader = useCallback((signal: AbortSignal) => getSupportTicketById(id, signal), [id]); const query = useTicketData(loader, true);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const images = useTicketImages(); const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const ticket = query.data; const closed = ticket ? isTicketClosed(ticket.status) : true;
  function back() { if (lock.current || images.picking) return; if (!message.trim() && !images.photos.length) return onBack(); Alert.alert("Bỏ phản hồi đang soạn?", "Nội dung này chưa được gửi.", [{ text: "Soạn tiếp", style: "cancel" }, { text: "Bỏ nội dung", style: "destructive", onPress: onBack }]); }
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; }); return () => sub.remove(); });
  useEffect(() => { registerBack?.(back); });
  async function reply() {
    if (lock.current || images.picking || !ticket || closed) return;
    const validation = validateReply(message); if (validation) { setError(validation); return; }
    lock.current = true; setBusy(true); setError(""); const generation = getSessionGeneration();
    try {
      const attachmentUrls = await images.upload();
      if (!alive.current || generation !== getSessionGeneration()) return;
      const updated = await addSupportTicketMessage(id, { message: message.trim(), attachmentUrls });
      if (alive.current && generation === getSessionGeneration()) { query.accept(updated); setMessage(""); images.clear(); }
    } catch (e) { if (alive.current && generation === getSessionGeneration()) { setError(ticketError(e, "Chưa gửi được phản hồi. Nội dung và ảnh vẫn được giữ.")); query.refresh(); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><TicketHeader title="Chi tiết yêu cầu" subtitle={ticket?.ticketNumber} onBack={back} onRefresh={query.refresh} busy={query.refreshing || busy} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.refreshing && !query.loading} onRefresh={query.refresh} tintColor={theme.brand} />}>
      {query.loading && <View style={styles.empty}><ActivityIndicator size="large" color={theme.brand} /><AppText style={styles.muted}>Đang tải nội dung hỗ trợ…</AppText></View>}
      {query.error && <TicketNotice message={query.error} onRetry={query.refresh} />}
      {ticket && <><View style={styles.card}><View style={[styles.row, { justifyContent: "space-between" }]}><AppText style={{ color: theme.brand, fontWeight: "700" }}>{ticket.ticketNumber}</AppText><TicketStatus status={ticket.status} /></View><AppText display style={styles.title}>{ticket.subject}</AppText><AppText style={styles.muted}>{supportTicketCategoryOptions.find(c => c.value === ticket.category)?.label ?? ticket.category} · Ưu tiên {supportTicketPriorityLabels[ticket.priority] ?? ticket.priority}</AppText><AppText style={styles.body}>Phụ trách: {ticket.assignedStaffName || "Chưa phân công"}</AppText><AppText style={styles.muted}>Tạo lúc: {ticketDate(ticket.createdAt)}{ticket.resolvedAt ? `\nKết thúc: ${ticketDate(ticket.resolvedAt)}` : ""}{ticket.bookingId ? `\nLiên quan booking #${ticket.bookingId}` : ""}</AppText></View>
        <View style={styles.row}><MessageCircle color={theme.brand} size={20} /><AppText style={styles.title}>Trao đổi ({ticket.messages.length})</AppText></View>
        <AppText style={styles.muted}>Tin mới nhất ở cuối. Tự kiểm tra phản hồi mỗi 20 giây khi màn hình đang hoạt động; bạn cũng có thể kéo xuống để làm mới.</AppText>
        {[...ticket.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id).map(item => {
          const own = item.senderId === ticket.userId; const staff = !own && item.senderRoles.some(r => r === "Staff" || r === "Admin");
          return <View key={item.id} style={[styles.card, { alignSelf: own ? "flex-end" : "flex-start", maxWidth: "94%", minWidth: "55%", backgroundColor: own ? theme.brandSoft : theme.surface, borderColor: own ? theme.brandBorder : theme.border }]}><AppText style={{ color: own ? theme.brand : theme.text, fontSize: 12, fontWeight: "700" }}>{own ? "Bạn" : `${item.senderName}${staff ? " · Nhân viên hỗ trợ" : ""}`}</AppText><AppText selectable style={styles.body}>{item.message}</AppText><TicketGallery value={item.attachmentUrls} /><AppText style={styles.muted}>{ticketDate(item.createdAt)}</AppText></View>;
        })}
        <View style={styles.card}>{closed ? <><AppText style={styles.label}>Yêu cầu đã kết thúc</AppText><AppText style={styles.muted}>Không thể gửi thêm phản hồi. Nếu cần hỗ trợ thêm, hãy tạo yêu cầu mới từ danh sách.</AppText></> : <><AppText style={styles.label}>Bổ sung thông tin</AppText><TextInput accessibilityLabel="Nội dung phản hồi" editable={!busy} multiline value={message} onChangeText={setMessage} maxLength={4000} placeholder="Nhập phản hồi cho đội ngũ hỗ trợ…" placeholderTextColor={theme.placeholder} style={[styles.input, styles.textarea]} /><AppText style={styles.count}>{message.length}/4.000</AppText><TicketImageInput images={images} disabled={busy} />{error && <TicketNotice message={error} />}<TicketButton title="Gửi phản hồi" busy={busy} disabled={images.picking || Boolean(query.error)} icon={<Send size={18} color={theme.onBrand} />} onPress={() => { void reply(); }} /></>}</View>
        <TicketQualityPanel id={id} closed={closed} revision={`${ticket.status}:${ticket.messages.length}:${Math.floor(Date.now() / 30000)}`} />
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
