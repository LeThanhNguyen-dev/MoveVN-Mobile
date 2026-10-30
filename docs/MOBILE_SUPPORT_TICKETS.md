# Ticket hỗ trợ trên mobile

## Vào chức năng

- Khách thuê hoặc Chủ xe → **Tài khoản → Yêu cầu hỗ trợ của tôi**.
- **Tài khoản → Trung tâm hỗ trợ** có nút gửi và xem yêu cầu, giữ nguyên FAQ.
- Chi tiết chuyến đi/đơn thuê → **Hỗ trợ đơn thuê này**: chỉ hiện yêu cầu của tài khoản đang đăng nhập liên quan đến booking đó; tạo mới tự gắn booking.
- Trong chi tiết thông báo hỗ trợ, chọn **Xem yêu cầu hỗ trợ**. Chỉ nhận `ticketId` hợp lệ và đường dẫn ticket của người gửi; không chuyển link hàng đợi nhân viên sang luồng khách.

Mobile dành cho Customer/Owner. Nhân viên tiếp nhận, trả lời, phân công và đổi trạng thái trên web như hiện có. API kiểm tra quyền trên mỗi yêu cầu; UI không tự đổi trạng thái ticket.

## Luồng và quy tắc

- Danh sách của chính tài khoản: tìm theo mã/tiêu đề, lọc trạng thái và nhóm vấn đề, phân trang 10 yêu cầu. Đổi bộ lọc về trang 1, hủy phản hồi tải cũ để không ghi đè kết quả mới. Lỗi tải hiển thị lỗi có thử lại, không giả lập danh sách rỗng.
- Tạo: nhóm Booking/Payment/Vehicle/Account/Other; ưu tiên Low/Normal/High/Urgent; tiêu đề bắt buộc tối đa 200 ký tự (160 nếu liên kết booking để chừa tiền tố mã booking); nội dung bắt buộc tối đa 4.000 ký tự, không nhận toàn khoảng trắng.
- Tối đa 6 ảnh trong mỗi lần gửi, mỗi ảnh tối đa 5 MB; JPG/PNG/WebP. Ảnh HEIC trên iPhone được đổi thành JPEG trước khi tải. Có chọn ảnh, chụp bằng camera, bỏ ảnh và xem ảnh đính kèm. API hiện chỉ nhận ảnh, không nhận PDF/video.
- Tải ảnh trước khi gửi. Khi tạo/phản hồi lỗi, giữ nội dung và ảnh; tải lại không gửi trùng ảnh đã tải thành công. Khóa bấm gửi trùng, kiểm tra phiên đăng nhập giữa quá trình tải ảnh và gửi. Với timeout, cần kiểm tra danh sách/trao đổi trước khi gửi lại vì API tạo ticket chung chưa có khóa idempotency.
- Với booking, server tái sử dụng ticket đang mở của đúng người gửi và booking, bổ sung phản hồi vào đó. Ticket đã kết thúc không ngăn tạo yêu cầu mới. Không tự chọn nhầm ticket đóng cuối cùng như hộp hỗ trợ cũ.
- Chi tiết: phân biệt tin của bạn/nhân viên, thời gian theo Việt Nam, người phụ trách và trạng thái. Kéo làm mới; tự kiểm tra phản hồi mỗi 20 giây khi app hoạt động và khi quay lại foreground. Đây là polling, không khẳng định chat realtime.
- `Resolved`/`Closed` không gửi thêm phản hồi; trạng thái server là quyết định cuối cùng nếu thay đổi giữa lúc soạn và gửi. Tải lỗi vẫn giữ bản cũ và báo lỗi; khóa gửi đến khi cập nhật được.
- Phần tiến độ dùng API Support Quality, hiển thị thời hạn phản hồi/xử lý của đợt hiện tại. Không tự gán hạn cho ticket cũ chưa theo dõi. Giờ Việt Nam; thời hạn tính 24/7; phản hồi AI không được tính là phản hồi của nhân viên.
- Chỉ đánh giá khi API trả `canRate` và ticket đã kết thúc: 1–5 sao, nhận xét tối đa 1.000 ký tự. Server chặn đánh giá lặp cho cùng đợt. Giữ nhận xét đang soạn khi làm mới; hiển thị các đánh giá đã lưu.
- Màn hình độc lập theo tài khoản/phiên; đóng khi đăng xuất. Quay lại trên Android và nút trong màn hình có bảo vệ nội dung chưa gửi.

## API hiện có

`GET /api/support-tickets/my`, `POST /api/support-tickets`, `GET /api/support-tickets/{id}`, `POST /api/support-tickets/{id}/messages`, `POST /api/support-tickets/attachments`, `GET /api/support-quality/tickets/{id}`, `POST /api/support-quality/tickets/{id}/feedback`.

Không thêm dependency, migration hoặc thay đổi backend. Giữ cấu hình IP API riêng trong `.env.local`/Terminal, không commit địa chỉ Wi-Fi của người phát triển.

## Kiểm tra

`npm run typecheck`; `npm test -- supportTickets.test.ts supportTicketScreen.test.ts bookingAssistance.test.ts`; `npx expo export --platform web --output-dir .expo/support-tickets-preview`.

Kiểm thử API hợp đồng và màn hình dùng dữ liệu giả, không ghi database chung. Bản Expo web được kiểm tra bằng trình duyệt ở kích thước điện thoại với API giả: cả sáng/tối, tạo kèm ảnh, phản hồi và đánh giá. Camera, thư viện ảnh, chia sẻ quyền iOS/Android và chuyển modal từ thông báo trên iPhone cần kiểm tra thêm trên thiết bị thật.

Kiểm thử toàn repo còn lỗi cũ `bookingFilters.test.ts` (customer): test tìm `BookingSearchFilters` trong `TripListScreen`, trong khi màn hình này chưa có component đó. Hai file này không được thay đổi trong chức năng ticket.
