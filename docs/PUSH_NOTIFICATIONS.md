# Thông báo booking để demo

## Demo khi app đang mở — không cần Firebase/APNs hoặc EAS Project ID

App nhận sự kiện booking từ backend qua SignalR (có polling dự phòng), sau đó tạo **thông báo hệ thống cục bộ**: banner trên màn hình, âm thanh và mục trong khay thông báo. Quyền thông báo được yêu cầu khi đăng nhập. Khi có quyền, booking dùng banner hệ điều hành thay cho toast; nếu không được phép hoặc thiết bị không hỗ trợ, app vẫn hiển thị toast.

1. Mở app trên điện thoại, đăng nhập và bấm **Cho phép** khi được hỏi quyền thông báo. Có thể dùng Expo Go cho thông báo cục bộ; bản development build đã cài từ trước cần build lại nếu chưa có thư viện `expo-notifications`.
2. Giữ app khách mở. Dùng tài khoản chủ xe trên web/thiết bị khác để duyệt đơn hoặc gửi biên bản check-in/check-out.
3. Điện thoại khách hiện banner và âm thanh; kéo khay thông báo xuống để xem. Chạm thông báo mở đúng booking. Làm ngược lại để thử phía chủ xe.
4. Nếu không thấy banner, kiểm tra quyền thông báo/banner/âm thanh của app (hoặc Expo Go), tắt chế độ Không làm phiền và kiểm tra kết nối backend. Polling dự phòng có thể mất khoảng 30 giây.

Thông báo xuất phát từ sự kiện booking thật, không tự tạo thêm đơn hay thay đổi trạng thái để giả lập. App phải đang hoạt động để nhận sự kiện này; tính năng demo không yêu cầu nhận sự kiện mới khi app đã đóng.

## Tùy chọn sau này: push khi app đóng

Code mobile và backend đã có luồng thông báo đẩy qua Expo Push Service. Android/iOS hiển thị thông báo khi app chạy nền hoặc đã đóng bình thường. Người dùng phải cho phép thông báo. Android không nhận push sau khi bấm **Buộc dừng / Force stop** cho đến khi mở lại app; việc nhận cũng phụ thuộc kết nối mạng và cài đặt hệ điều hành.

### Thiết lập lần đầu

1. Tạo/đăng nhập tài khoản Expo. Trong thư mục `MoveVN-Mobile`, chạy `npx eas-cli@latest login`, sau đó `npx eas-cli@latest init`. Lệnh init liên kết app với một dự án Expo; mã dự án (Project ID) nằm trong cấu hình được sinh ra. Không cần gửi mật khẩu hay khóa bí mật vào chat.
2. Đặt `EXPO_PUBLIC_EAS_PROJECT_ID` trong `.env` bằng Project ID này. Giữ nguyên ID nếu dự án đã có `extra.eas.projectId`.
3. **Android:** tạo ứng dụng Android trong Firebase, chọn cùng package với `MOVEVN_ANDROID_PACKAGE`. Tải `google-services.json`, đặt ở vị trí riêng trên máy và đặt `MOVEVN_GOOGLE_SERVICES_FILE` bằng đường dẫn đó. Chạy `npx eas-cli@latest credentials --platform android` và cấu hình FCM V1 service account theo hướng dẫn Expo. Khóa service account là bí mật, không đưa vào Git.
4. **iPhone:** đặt `MOVEVN_IOS_BUNDLE_IDENTIFIER`, cấu hình khóa APNs bằng `npx eas-cli@latest credentials --platform ios`; cần tài khoản Apple Developer phù hợp.
5. Chạy `npx eas-cli@latest build:configure`, rồi tạo bản development build (`npx eas-cli@latest build --profile development --platform android` hoặc `ios`) và cài lên điện thoại. Thư viện native mới yêu cầu build lại. **Expo Go không dùng để kiểm tra push từ xa.**
6. Bật thêm `EXPO_PUBLIC_ENABLE_REMOTE_PUSH=true` trong `.env` mobile và chạy backend với `Push__Enabled=true`. Mặc định cả hai đều tắt để demo không phụ thuộc dịch vụ push từ xa. Chỉ cần `Push__ExpoAccessToken` nếu dự án Expo đã bật Enhanced Push Security.
7. Đăng nhập trên điện thoại, chấp nhận quyền thông báo. App tự đăng ký token với `PUT /api/notifications/push-devices`. Khi đăng xuất, app hủy đăng ký. Backend còn kiểm tra phiên đăng nhập để ngừng gửi khi phiên đã bị thu hồi/hết hạn.

## Kiểm tra trên thiết bị thật

- Dùng một tài khoản khách trên điện thoại và một chủ xe trên thiết bị khác/web.
- Cho app khách chạy nền, khóa màn hình. Chủ xe duyệt booking hoặc gửi biên bản nhận/trả xe. Thông báo hệ thống phải xuất hiện; chạm vào phải mở đúng booking và vai trò.
- Đóng app bình thường rồi thực hiện một thay đổi booking mới. Chạm thông báo để kiểm tra khởi động app và mở đúng booking.
- Kiểm tra cả khách và chủ xe; hai điện thoại cùng tài khoản; từ chối quyền; mất mạng rồi mở app lại; đăng xuất/đổi tài khoản; phiên bị thu hồi.
- Khi app mở, sự kiện SignalR/polling tạo banner cục bộ. Banner foreground của push từ xa bị tắt để tránh báo hai lần.

## Cách backend gửi

Worker quét các thông báo `Booking*` chưa đọc đã commit trong SQL của 24 giờ gần nhất, mỗi 10 giây. Chỉ thiết bị đã đăng ký trước lúc thông báo được tạo mới nhận. Mỗi cặp thông báo/token có một bản ghi delivery trong MongoDB; lease ngăn nhiều API instance gửi cùng lúc. Lỗi tạm thời thử lại tối đa 5 lần với thời gian chờ tăng dần. Ticket Expo được lưu để kiểm tra receipt sau 15 phút; token `DeviceNotRegistered` bị vô hiệu hóa. Bản ghi delivery tự hết hạn sau 7 ngày.

Push là best effort: timeout sau khi nhà cung cấp đã nhận có thể tạo thông báo trùng khi thử lại. Backend không đánh dấu đã nhận chỉ vì Expo đã cấp ticket; trạng thái `sent` là receipt thành công từ dịch vụ push, không phải bằng chứng người dùng đã đọc.

Code đã kiểm tra build/typecheck và test tự động. Việc gửi thật qua Firebase/APNs phải được kiểm tra sau khi hoàn tất cấu hình và có development build trên thiết bị.

Tài liệu chính thức: [Thiết lập Expo Push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Gửi push và xử lý receipt](https://docs.expo.dev/push-notifications/sending-notifications/).
