# Booking: web và mobile

Phạm vi: các thao tác booking của khách thuê và chủ xe. Quyền thao tác cuối cùng vẫn do backend kiểm tra. `src/features/booking/bookingActions.ts` ở hai ứng dụng dùng cùng quy tắc; kiểm thử so sánh cả hai với cùng dữ liệu trạng thái.

| Nhóm | Web và mobile |
| --- | --- |
| Chờ duyệt | Chủ xe duyệt, từ chối; khách hủy theo điều kiện |
| Đặt cọc | Ví MoveVN, PayOS, khóa khi hết hạn; cọc gia hạn tách riêng |
| Nhận xe | Chủ xe lập/lập lại biên bản; khách xem ảnh, tải PDF, đồng ý hoặc yêu cầu sửa; báo không được giao xe |
| Trả xe | Báo bàn giao; chủ xe lập/sửa biên bản theo phiên bản; khách kiểm tra rồi xác nhận |
| Phụ thu | Trả trễ, vượt km và các khoản theo điều khoản đã lưu; chọn ví hoặc trả trực tiếp |
| Nhận tiền trực tiếp | Chủ xe ghi chú và xác nhận nhận phụ thu; thao tác riêng với xác nhận nhận xe |
| Hoàn tất | Chủ xe xác nhận nhận lại xe; giải ngân cọc sau thời gian giữ 48 giờ |
| Hợp đồng | Xem, ký, tải PDF; chủ xe gia hạn; khách thanh toán cọc bổ sung |
| Hỗ trợ | Tranh chấp, báo cáo vi phạm booking, ảnh bằng chứng; mobile theo dõi báo cáo đã gửi |
| Thông tin | Mở xe và hồ sơ công khai của chủ xe/khách thuê; đánh giá sau chuyến |

## Bố cục

- Trang booking chỉ giữ tóm tắt check-in/check-out và liên kết đến màn riêng.
- Web dùng `…/bookings/:id/check-in` và `…/bookings/:id/check-out`, đồng thời hỗ trợ đường dẫn `/booking/:id/check-in` và `/booking/:id/check-out`.
- Mobile dùng `TripHandover` / `OwnerBookingHandover`; mở ví và quay lại được biên bản đang xem.
- Giá theo ngày, điều khoản phụ thu và lịch sử được thu gọn mặc định.
- Ẩn nút chatbot nổi khi xem bàn giao để không che số tiền hoặc nút xác nhận.

## Tiền và ảnh

- Tiền booking, phần thanh toán qua hệ thống và tiền thuê đối chiếu trực tiếp thuộc nhóm riêng.
- Tổng phụ thu chỉ gồm phụ thu chờ xác nhận và phụ thu chưa thanh toán. Không cộng tiền thuê hoặc thế chấp vào nhóm này; PDF áp dụng cùng cách tách.
- Không tự ghi nhận tiền thuê trả trực tiếp là đã thu: hai bên cần đối chiếu chứng từ.
- Biên bản chỉ nhận ảnh chụp từ camera qua giao diện; không còn nút/chọn file thư viện. Ảnh có watermark và được xem lại trước khi gửi. Các biên bản cũ vẫn xem được.
- Ảnh bằng chứng trong booking cũng dùng camera. Không thay đổi chọn ảnh đại diện hoặc ảnh ở các tính năng khác.

## Kiểm tra

Mobile: `npm run typecheck`, `npm test`, `npx expo export --platform all --output-dir .expo/booking-parity-build`.

Web: `npm run build`, `npx playwright test checkout-revision-ui.spec.ts`, `npx playwright test --config playwright.mobile-booking.config.ts` (cần bản export mobile ở trên).

Backend: kiểm thử `BookingServiceStaffCheckInTests` và `InspectionPdfImageTests`. Camera trong kiểm thử trình duyệt dùng nguồn ảnh giả; vẫn cần kiểm tra quyền camera và chụp trên Android/iOS thật trước khi phát hành.
