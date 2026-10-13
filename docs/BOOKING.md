# Booking và bàn giao xe trên mobile

## Luồng sử dụng

- Khách: Khám phá → Chi tiết xe → Yêu cầu thuê xe. Chọn lịch thuê, xem phụ phí,
  nhập ghi chú/mã khuyến mãi và gửi yêu cầu. Nhận/trả xe tại địa chỉ chủ xe.
- Chủ xe: Đơn thuê → Chi tiết → duyệt hoặc từ chối (có lý do).
- Khách: Chuyến đi → Chi tiết → thanh toán đặt cọc qua trang thanh toán hiện có.
  Khi quay lại app, đơn được tải lại; có thể bấm kiểm tra thanh toán trong phiên đó.
- Chủ xe: Khi đơn `DepositPaid`, có thể lập biên bản check-in từ 2 giờ trước
  lịch nhận nếu xe trống. Backend kiểm tra cả lịch thuê khác, chuyến chưa trả
  và lịch bị chủ xe khóa; kiểm tra lại khi khách/nhân viên xác nhận nhận xe.
  Audit log ghi nhận thao tác nhận sớm. Giờ thuê, giờ trả và giá trên đơn giữ nguyên.
- Khách: Xem ảnh, số km, nhiên liệu, hư hại rồi xác nhận nhận xe. Backend vẫn yêu
  cầu hợp đồng `Active`: cả hai bên cần ký hợp đồng trên web nếu chưa ký.
- Trong chuyến (`InProgress`), chủ xe lập biên bản check-out; khách kiểm tra,
  xác nhận trả xe để chuyển sang `Completed`.
- Khách có thể xem chính sách hủy và khoản hoàn/không hoàn trước khi xác nhận hủy.

## Ảnh biên bản

Camera dùng `expo-camera` ngay trong app, không mở trình chọn ảnh hoặc thư viện.
Mỗi biên bản có 1–12 ảnh JPEG, mỗi ảnh tối đa 5MB như giới hạn của API.
Ảnh được chuẩn hóa chiều/orientation, cạnh dài tối đa 1600px, rồi compositing
ảnh và chữ bằng `react-native-view-shot`. Chờ ảnh giải mã và view layout xong
trước khi xuất JPEG; chỉ JPEG đã có watermark mới được đưa vào FormData.

Watermark có mã booking, CHECK-IN/CHECK-OUT và thời điểm bấm chụp theo
UTC+07:00, gồm ngày/tháng/năm và giờ/phút/giây. Thời điểm lấy từ đồng hồ thiết bị,
không đổi thành thời gian upload khi gửi lại. Đây là watermark trên pixel ảnh,
không chỉ là nhãn xem trước hoặc EXIF. Backend vẫn dùng API upload ảnh hiện có;
việc giới hạn nguồn ảnh ở đây áp dụng cho luồng mobile.

Cho phép chụp lại/xóa từng ảnh. Không gửi ảnh gốc khi watermark lỗi. Giữ bản
nháp khi upload lỗi để thử lại; xóa file cache khi xóa ảnh hoặc thoát biên bản.
Không lưu ảnh vào thư viện. Web preview không cung cấp nút chọn file thay thế.

## Kiểm tra

```powershell
npm run typecheck
npm test
npx expo export --platform android --platform ios --platform web --output-dir .expo/booking-build
```

Các test bao phủ quyền Owner/Customer, thời điểm và trạng thái cho check-in/out,
chống trùng biên bản, giới hạn ảnh, dữ liệu multipart, lỗi watermark, giữ ảnh khi
upload lỗi, chống gửi trùng và dọn ảnh tạm.

Để kiểm tra camera thực tế: chạy `npm run start:lan` rồi mở bằng Expo Go SDK 57.
Nếu dùng development build đã có trước thay đổi này, build lại để thêm
`expo-camera`, `react-native-view-shot` và cấu hình quyền camera.

Cần smoke test trên Android/iOS thật: cấp/từ chối quyền camera; chụp dọc/ngang;
xem ảnh đầy đủ có chữ rõ, đúng ngày giờ; chụp lại; xóa; gửi nhiều ảnh; thử upload
khi mất mạng; khách xem ảnh nhận được và xác nhận cả hai biên bản. Việc export
bundle và test mock không thay thế xác minh camera/compositing trên thiết bị.

Luồng ký hợp đồng, tranh chấp và quyết toán vẫn theo các chức năng hiện có
trên web; mobile không bỏ qua những điều kiện nghiệp vụ của backend.
