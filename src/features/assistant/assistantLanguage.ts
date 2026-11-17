export type AssistantLocale = "vi" | "en";
export const normalizeAssistantLocale = (value: unknown): AssistantLocale | undefined =>
  typeof value === "string" && /^(vi|en)(?:[-_].*)?$/i.test(value) ? (value.toLowerCase().startsWith("en") ? "en" : "vi") : undefined;
export const deviceAssistantLocale = (): AssistantLocale => normalizeAssistantLocale(Intl.DateTimeFormat().resolvedOptions().locale) ?? "vi";
let locale: AssistantLocale = deviceAssistantLocale();
let requestLocale: AssistantLocale | undefined;
export const getAssistantRequestLocale = () => requestLocale ?? locale;
export const setAssistantRequestLocale = (value: AssistantLocale | undefined) => { requestLocale = value; };
const listeners = new Set<() => void>();
export const getAssistantLocale = () => locale;
export const subscribeAssistantLocale = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setAssistantLocale(next: AssistantLocale) { if (next !== locale) { locale = next; listeners.forEach(listener => listener()); } }

const en: Record<string, string> = {
  "Yêu cầu #": "Support request #",
  "Đã chọn xe #": "Selected car #",
  "Xem đơn #": "View booking #",
  "Xác nhận hủy đơn #": "Cancel booking #",
  "Số tự động": "Automatic",
  "Số sàn": "Manual",
  "Xăng": "Petrol",
  "Dầu": "Diesel",
  "Điện": "Electric",
  "Hỗ trợ từ trợ lý MoveVN": "Support from MoveVN assistant",
  "Xem xe": "View car",
  "Đang lưu…": "Saving…",
  "Chuyển sang tiếng Việt": "Switch to Vietnamese",
  "Tư vấn cùng AI": "Chat with AI",
  "Đang chờ nhân viên": "Waiting for support",
  "Nhân viên đang hỗ trợ": "Support agent connected",
  "Cuộc trò chuyện đã kết thúc": "Conversation closed",
  "Trợ lý MoveVN": "MoveVN assistant",
  "Lịch sử trò chuyện": "Conversation history",
  "Cuộc trò chuyện mới": "New conversation",
  "Đóng trợ lý": "Close assistant",
  "Đóng trợ lý MoveVN": "Close MoveVN assistant",
  "Mở trợ lý MoveVN": "Open MoveVN assistant",
  "Ẩn trợ lý MoveVN": "Hide MoveVN assistant",
  "Thuê xe cần giấy tờ gì?": "What documents do I need to rent a car?",
  "Tìm xe phù hợp với tôi": "Help me find a suitable car",
  "Tôi muốn xem booking của mình": "Show my bookings",
  "Tìm ô tô dưới 1 triệu/ngày": "Find a car under 1,000,000 VND per day",
  "Có mã giảm giá nào không?": "Are there any promotions?",
  "Xem thêm xe": "Show more cars",
  "Chào bạn, mình là trợ lý MoveVN": "Hi, I am the MoveVN assistant",
  "Đăng nhập để trò chuyện nhé.": "Sign in to start chatting.",
  "Mình có thể giúp gì cho bạn?": "How can I help?",
  "Cùng tìm chiếc xe phù hợp hoặc giải đáp về chuyến đi của bạn.": "Find a suitable car or get help with your trip.",
  "Trò chuyện với MoveVN": "Chat with MoveVN",
  "Chưa có cuộc trò chuyện.": "No conversations yet.",
  "Xem tin trước": "Load earlier messages",
  "Nhân viên MoveVN": "MoveVN support",
  "Câu trả lời hữu ích": "Helpful response",
  "Câu trả lời chưa hữu ích": "Unhelpful response",
  "Chưa nhận được câu trả lời": "No response received yet",
  "MoveVN đang tìm câu trả lời…": "MoveVN is finding an answer…",
  "Đang tìm xe…": "Finding cars…",
  "Đang kiểm tra ngày trống…": "Checking availability…",
  "Đang tính giá chuyến đi…": "Calculating your quote…",
  "Đang chuẩn bị xác nhận…": "Preparing confirmation…",
  "MoveVN đang xử lý…": "MoveVN is processing…",
  "Kết nối đang gián đoạn. Tin nhắn vẫn được giữ; MoveVN sẽ kiểm tra lại trạng thái.": "Connection interrupted. Your message is saved; MoveVN will check its status.",
  "Yêu cầu đã được gửi. Bạn có thể nhắn thêm trong lúc chờ nhân viên.": "Your request was sent. You can send more details while waiting for support.",
  "Nhân viên đã tiếp nhận. Bạn tiếp tục trao đổi tại đây nhé.": "A support agent has joined. Continue chatting here.",
  "Chuyển sang nhân viên?": "Contact a support agent?",
  "Nhân viên sẽ được xem nội dung cuộc trò chuyện để hỗ trợ bạn.": "The support agent can view this conversation to help you.",
  "Bạn cần hỗ trợ vấn đề gì?": "What do you need help with?",
  "Đồng ý chuyển": "Confirm handoff",
  "Bắt đầu trò chuyện mới": "Start a new conversation",
  "Nhắn cho nhân viên…": "Message support…",
  "Hỏi MoveVN…": "Ask MoveVN…",
  "Gửi tin nhắn": "Send message",
  "Gặp nhân viên": "Contact support",
  "Quay lại": "Back",
  "‹ Quay lại": "‹ Back",
  "Đóng": "Close",
  "Thử lại": "Retry",
  "Đặt xe nhanh": "Book a car",
  "Ngày thuê": "Rental dates",
  "Chọn xe": "Choose a car",
  "Khuyến mãi": "Promotions",
  "Nhận xe": "Pickup",
  "Xác nhận": "Confirm",
  "Chưa chọn": "Not selected",
  "Ngày nhận:": "Pickup:",
  "Ngày trả:": "Return:",
  "Chọn ngày và giờ thuê": "Choose rental dates and times",
  "Nhờ trợ lý tìm xe trong chat; xe tìm được sẽ xuất hiện ở đây.": "Ask the assistant to find cars; the results will appear here.",
  "Mã khuyến mãi (nếu có)": "Promo code (optional)",
  "Mã khuyến mãi": "Promo code",
  "Mã sẽ được kiểm tra khi báo giá.": "The promo code will be checked when the quote is prepared.",
  "Cách nhận xe": "Pickup method",
  "Tự đến nhận tại chủ xe": "Collect from the owner",
  "Giao xe tận nơi — tính phí theo khoảng cách": "Delivery — fee based on distance",
  "Địa chỉ giao xe": "Delivery address",
  "Địa chỉ trả (nếu khác điểm nhận)": "Return address (if different)",
  "Phí giao được tính theo cấu hình booking và hiển thị trước khi xác nhận.": "Delivery fees will be shown before confirmation.",
  "Ghi chú": "Notes",
  "Tiếp tục": "Continue",
  "Số nhà, đường...": "House number, street…",
  "Xóa địa chỉ": "Clear address",
  "Không lấy được tọa độ địa chỉ.": "Could not locate this address.",
  "Chọn ngày nhận trong tương lai và ngày trả sau ngày nhận.": "Choose a future pickup and a later return time.",
  "Bạn chọn một xe để tiếp tục nhé.": "Choose a car to continue.",
  "Chọn cách nhận xe và nhập địa chỉ nếu cần giao xe.": "Choose a pickup method and enter an address for delivery.",
  "Chọn địa chỉ giao từ danh sách gợi ý để tính phí theo khoảng cách.": "Select a suggested delivery address to calculate the fee.",
  "Chọn địa chỉ trả từ danh sách gợi ý hoặc để trống để trả tại điểm nhận.": "Select a suggested return address, or leave blank to return at pickup.",
  "Chưa tải được thông tin đặt xe.": "Could not load your booking details.",
  "Thông tin đã thay đổi hoặc chưa hợp lệ. Vui lòng kiểm tra lại.": "Details changed or are invalid. Please review them.",
  "Báo giá chuyến đi": "Trip quote",
  "Tiền thuê:": "Rental:",
  "Giảm theo thời gian thuê: −": "Duration discount: −",
  "Khuyến mãi: −": "Promotion: −",
  "Phí giao xe": "Delivery fee",
  "Miễn phí": "Free",
  "Tổng tiền thuê:": "Rental total:",
  "Thanh toán trước:": "Advance payment:",
  "Tiền bảo đảm:": "Security deposit:",
  "Nhận xe tại địa chỉ của chủ xe.": "Collect from the owner's address.",
  "Giá được kiểm tra lại khi xác nhận.": "The price is checked again at confirmation.",
  "Trả xe:": "Return:",
  "Đường dẫn thanh toán không hợp lệ.": "Invalid payment link.",
  "Chưa kết nối được thanh toán. Bạn có thể mở đơn để thử lại.": "Could not connect to payment. Open your booking to retry.",
  "Chưa ghi nhận thanh toán.": "Payment has not been recorded yet.",
  "Đã ghi nhận thanh toán.": "Payment recorded.",
  "Chưa kiểm tra được thanh toán.": "Could not check payment status.",
  "Mở trang thanh toán": "Open payment page",
  "Lấy đường dẫn thanh toán": "Get payment link",
  "Mã QR thanh toán": "Payment QR code",
  "Tôi đã thanh toán — kiểm tra": "I have paid — check status",
  "Giá thay đổi, vui lòng xác nhận lại.": "The price changed. Please confirm again.",
  "Xác nhận đã hết hạn hoặc thông tin đã thay đổi. Vui lòng báo giá lại.": "Confirmation expired or details changed. Request a new quote.",
  "Chưa thể báo giá lại.": "Could not refresh the quote.",
  "Hoàn:": "Refund:",
  "· Khấu trừ:": "· Deduction:",
  "Giá tăng so với báo giá trước. Tôi đồng ý giá mới.": "The price increased. I accept the new price.",
  "Đơn đã hủy.": "Booking cancelled.",
  "Đơn đã tạo, bạn có thể thanh toán bên dưới.": "Booking created. You can pay below.",
  "Xác nhận hủy đơn": "Confirm cancellation",
  "Xác nhận đặt xe": "Confirm booking",
  "Báo giá lại": "Refresh quote",
  "Thông tin đặt xe đã lưu. Bạn có thể tiếp tục trong chat hoặc mở Đặt xe nhanh.": "Booking details saved. Continue in chat or open Book a car.",
  "Tra cứu đang gián đoạn. Bạn thử lại nhé.": "Lookup is temporarily unavailable. Please retry.",
  "Giá cơ bản; cần ngày nhận và trả để kiểm tra lịch trống.": "Indicative price; pickup and return dates are needed to check availability.",
  "Lịch thuê:": "Rental period:",
  "Xe này chưa có đánh giá công khai.": "This car has no public reviews yet.",
  "Hiện chưa có mã giảm giá nào.": "No promotions are available at the moment.",
  "Dự kiến hoàn:": "Estimated refund:",
  "Đơn tối thiểu:": "Minimum order:",
  "HSD:": "Valid until:",
  "Xem booking": "View booking",
  "Xem chi tiết": "View details",
  "Đặt xe này": "Book this car",
  "· giữ ngày đã chọn": "· keep selected dates",
  "Dùng mã này": "Use this code",
  "Giảm": "Discount",
  "tối đa": "up to",
  "đánh giá": "reviews",
  "/ngày": "/day",
  "ngày": "days",
  "chỗ": "seats",
  "Nguồn chính sách": "Policy sources",
  "Không tải được hội thoại.": "Could not load the conversation.",
  "Không tải được tin nhắn trước.": "Could not load earlier messages.",
  "Chưa tải được tin nhắn cũ.": "Could not load earlier messages.",
  "Không tải được lịch sử.": "Could not load history.",
  "Chưa kết nối được với máy chủ. Bạn thử lại nhé.": "Could not connect to the server. Please retry.",
  "Chưa xác nhận tin nhắn đã được nhận. Thử gửi lại sẽ giữ nguyên mã tin nhắn.": "Message delivery is unconfirmed. Retry will reuse the same message ID.",
  "Chưa chuyển được cho nhân viên.": "Could not connect you to support.",
  "Chưa chuyển được yêu cầu. Bạn thử lại nhé.": "Could not send your support request. Please retry.",
  "Chưa mở được đặt xe nhanh. Bạn thử lại nhé.": "Could not open booking. Please retry.",
  "Chưa gửi được đánh giá.": "Could not send feedback.",
  "Tin nhắn đã được nhận. Chưa tải được kết quả; hãy kiểm tra lại trạng thái.": "Message received. The result is not available yet; check its status."
};
/** Only assistant-owned UI labels are translated; model/user text is rendered verbatim. */
export function assistantText(value: string, selected: AssistantLocale = getAssistantLocale()): string {
  if (selected !== "en") return value;
  const key = value.trim();
  if (en[key]) return value.replace(key, en[key]);
  const patterns: [RegExp, string][] = [[/^Yêu cầu #(\d+)$/, "Support request #$1"], [/^Đã chọn xe #(\d+)$/, "Selected car #$1"], [/^Xem đơn #(\d+)$/, "View booking #$1"], [/^Xác nhận hủy đơn #(\d+)$/, "Cancel booking #$1"], [/^(\d+) chỗ$/, "$1 seats"], [/^Giảm (.+)$/, "Discount $1"], [/^(.+) ngày$/, "$1 days"]];
  for (const [pattern, replacement] of patterns) if (pattern.test(key)) return value.replace(key, key.replace(pattern, replacement));
  return value;
}
export const assistantMoney = (value: number, selected: AssistantLocale = getAssistantLocale()) => new Intl.NumberFormat(selected === "en" ? "en-GB" : "vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
/** Translate only known catalog enum labels; preserve custom catalog values verbatim. */
export function assistantVehicleLabel(value: string, selected: AssistantLocale = getAssistantLocale()): string {
  const labels: Record<string, [string, string]> = {
    automatic: ["Số tự động", "Automatic"], "số tự động": ["Số tự động", "Automatic"],
    manual: ["Số sàn", "Manual"], "số sàn": ["Số sàn", "Manual"],
    gasoline: ["Xăng", "Petrol"], petrol: ["Xăng", "Petrol"], "xăng": ["Xăng", "Petrol"],
    diesel: ["Dầu", "Diesel"], "dầu": ["Dầu", "Diesel"],
    electric: ["Điện", "Electric"], "điện": ["Điện", "Electric"],
    hybrid: ["Hybrid", "Hybrid"], "plug-in hybrid": ["Plug-in Hybrid", "Plug-in Hybrid"],
    cvt: ["CVT", "CVT"], dct: ["DCT", "DCT"],
  };
  return labels[value.trim().toLowerCase()]?.[selected === "en" ? 1 : 0] ?? value;
}
export const RENTAL_TIME_ZONE = "Asia/Ho_Chi_Minh";
export function rentalParts(value?: string | null) {
  if (!value) return { date: "", time: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: "" };
  const instant = new Date(value);
  if (!Number.isFinite(+instant)) return { date: "", time: "" };
  const shifted = new Date(+instant + 7 * 3600000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
export function rentalInstant(parts: { date: string; time: string }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(parts.time)) return null;
  const value = new Date(`${parts.date}T${parts.time}:00+07:00`);
  if (!Number.isFinite(+value)) return null;
  const roundtrip = rentalParts(value.toISOString());
  return roundtrip.date === parts.date && roundtrip.time === parts.time ? value.toISOString() : null;
}
export function assistantDate(value: string, selected: AssistantLocale = getAssistantLocale()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) ? new Intl.DateTimeFormat(selected === "en" ? "en-GB" : "vi-VN", { timeZone: RENTAL_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(parsed) : "?";
}
