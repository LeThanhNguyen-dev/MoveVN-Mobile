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
  cầu hợp đồng `Active`: cả hai bên xem bằng PIN và ký bằng OTP ngay trong app.
- Trong chuyến (`InProgress`/`Returning`), chủ xe lập biên bản check-out, nhập giờ
  bàn giao thực tế theo giờ Việt Nam (`YYYY-MM-DD HH:mm`). App gửi giờ ISO UTC;
  kilomet không thấp hơn check-in, có hư hại phải mô tả.
- Khách kiểm tra giờ bàn giao, ảnh, phiên bản và phụ phí rồi đồng ý cho thu phụ phí
  từ ví. Xác nhận chuyển sang `Returned`; chủ xe xác nhận đã nhận lại xe mới hoàn tất.
- Chủ xe có thể sửa checkout ở `Returning` trước khi khách xác nhận, bắt buộc lý do,
  giữ nguyên ảnh gốc. Phiên bản cũ bị backend từ chối, khách cần xem lại rồi xác nhận.
- Cả hai bên thấy lịch sử biên bản và phụ phí còn nợ, kể cả khi chuyến đã `Completed`.
- Danh sách khách/chủ xe hỗ trợ trạng thái, từ khóa và khoảng ngày; đổi bộ lọc về trang 1.
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

Sau khi export, chạy kiểm tra giao diện bằng API mock từ repo web cạnh repo mobile:

```powershell
cd ../MoveVN-FrontEnd
npx playwright test --config playwright.mobile-booking.config.ts
npx playwright test --config playwright.checkout.config.ts
npx playwright test --config playwright.turnaround.config.ts
```

Hai repo giữ cùng các ca giá cố định trong `tests/fixtures/booking-pricing.json` để
kiểm tra giá động, giảm theo số ngày, mã ưu đãi, phí giao xe, phí nền tảng và cọc.

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

Mobile hỗ trợ tạo hợp đồng (chủ xe), xem bằng PIN, ký OTP, gia hạn hợp đồng
Active/Overdue mới nhất (1–90 ngày), lịch sử hợp đồng và tải PDF. Gia hạn tạo
phiên bản cần ký lại; cả hai bên thấy cọc bổ sung và hạn thanh toán.

Check-out dùng điều khoản vượt km đã lưu trong booking: hạn mức theo ngày/chuyến,
đơn giá/km và trần phí. Chủ xe xem dự tính khi nhập/sửa km. Khách thấy phí trả
trễ, phí vượt km, tiền đã thu/chưa thu/chờ xác nhận trong hộp đồng ý. Các phiên
bản cũ bị từ chối, không tự gửi lại xác nhận nếu dữ liệu đã thay đổi.

Biên bản check-in/out và hợp đồng tải qua API có xác thực. Bản web tải PDF;
Android/iOS mở bảng chia sẻ để lưu/gửi file. Module `expo-sharing` cần được đưa
vào development build mới. File chia sẻ tạm được dọn sau khi đóng bảng chia sẻ.

Bảng đối chiếu tiền dùng cùng phép tính với web và PDF backend: tiền thuê còn
lại = tổng tiền - số hệ thống đã thu, cộng phụ phí chưa thu và chờ xác nhận.
Khoản khách trả trực tiếp chưa được hệ thống ghi nhận; cần đối chiếu chứng từ
để tránh thu trùng. Mobile giữ cùng giới hạn này với web.

Luồng chủ xe thực tế trong tab Đơn thuê dùng `InspectionFormScreen` chung:
Android/iOS chụp bằng camera, bản web chọn ảnh và đóng dấu. Các màn hiển thị
biên bản dùng chung bảng phí, lịch sử, ảnh và nút PDF.

Checklist kiểm thử thủ công: [BOOKING-TEST-CHECKLIST.md](BOOKING-TEST-CHECKLIST.md).
Các test tự động và export bundle không thay thế kiểm thử PayOS/OTP/camera/
bảng chia sẻ trên Android/iOS thật với môi trường test.

Ảnh biên bản hiện cho phép chọn từ thư viện trên web và điện thoại; camera là tùy chọn. Backend không bắt buộc EXIF hay ảnh chụp trong 24 giờ ở luồng check-in/check-out. Vẫn kiểm tra định dạng, dung lượng và số lượng ảnh.
