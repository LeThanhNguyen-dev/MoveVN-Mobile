# Thống kê đội xe trên mobile

Vai trò **Chủ xe** → tab **Tổng quan**. Màn hình này thay phần placeholder cũ bằng thống kê thực từ `/api/owner/analytics`.

Có bộ lọc khoảng ngày/từng xe/nhóm ngày-tuần-tháng; so sánh kỳ trước; bảng xếp hạng đơn hợp lệ và thu nhập qua ví; ngày có lịch thuê, tỷ lệ hủy, đánh giá, bảng xe phân trang và giải thích số liệu.

**Xuất Excel** gọi API theo đúng bộ lọc, rồi mở hộp lưu/chia sẻ file của hệ điều hành. Không cần quyền đọc toàn bộ bộ nhớ thiết bị. File tạm được xóa sau chia sẻ.

API chỉ đọc số liệu; phần định nghĩa đầy đủ ở `MoveVN-Backend/docs/OWNER_ANALYTICS.md`. Thu nhập ví không bao gồm tiền thanh toán trực tiếp, không đồng nghĩa lợi nhuận hoặc tiền đã chuyển ngân hàng.

Sau khi pull dependency mới của development, chạy `npm ci`. Development build cần có các module native đã khai báo (đặc biệt `expo-sharing` cho xuất file); nếu APK cũ chưa có, cần build lại theo quy trình Android hiện có. Không thêm dependency mới cho riêng chức năng thống kê.

Kiểm tra: `npm run typecheck`; `npm test -- ownerAnalytics.test.ts ownerAnalyticsScreen.test.ts`; Expo export web xác nhận bundle. Các kiểm thử sử dụng API giả lập và không thao tác database chung.
