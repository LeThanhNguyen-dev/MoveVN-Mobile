# Thông báo đẩy MoveVN

## Phạm vi

- Backend gửi những thông báo `InApp`/`Both` chưa đọc trong 24 giờ gần nhất: booking, hỗ trợ, tranh chấp, thanh toán, xe trống, broadcast và các loại khác. Thông báo chỉ gửi email không được đẩy lên điện thoại.
- Thiết bị phải được đăng ký trước khi thông báo được tạo. Tài khoản và phiên đăng nhập phải còn hiệu lực. Đăng xuất hoặc từ chối quyền thông báo sẽ hủy đăng ký thiết bị.
- Khi mở app, push và SignalR/polling dùng chung bộ chống báo trùng. Khi app ở nền/khóa màn hình, Expo chuyển thông báo đến FCM/APNs.
- Bấm booking mở đúng vai trò Customer/Owner. Các thông báo khác mở chi tiết trong hộp thư; từ đó có thể mở ticket, báo cáo vi phạm hoặc xe liên quan nếu thông báo có đích tương ứng.
- Nội dung dài được rút gọn trên màn hình khóa để giữ payload dưới 4 KiB; nội dung đầy đủ được lấy từ API có xác thực.

## Cấu hình của nhóm cần bổ sung

Không tạo project ID hay khóa giả. Không đưa khóa bí mật vào `EXPO_PUBLIC_*`, Git hoặc chat.

1. Dùng Node.js LTS >= 22.13.0, vào thư mục `MoveVN-Mobile`, chạy `npm ci`.
2. Đăng nhập Expo bằng tài khoản có quyền truy cập project của nhóm. Repository đã liên kết `@movevnmobile/movevn` trong `app.json`; thành viên pull code không cần tạo project mới:

   ```powershell
   npx.cmd eas-cli login
   npx.cmd eas-cli project:info
   ```

3. Điền trong `.env.local` **và môi trường EAS tương ứng** (`development`, `preview`, `production`):

   ```dotenv
   EXPO_PUBLIC_ENABLE_REMOTE_PUSH=true
   EXPO_PUBLIC_EAS_PROJECT_ID=<UUID thật của Expo project>
   MOVEVN_ANDROID_PACKAGE=<applicationId của nhóm>
   MOVEVN_IOS_BUNDLE_IDENTIFIER=<bundle ID của nhóm>
   MOVEVN_GOOGLE_SERVICES_FILE=./google-services.json
   EXPO_PUBLIC_API_BASE_URL=<URL backend điện thoại truy cập được>
   ```

   `.env.local` không được commit và không tự xuất hiện trên máy build EAS. Cấu hình các giá trị trên trong EAS Environment Variables. Với Firebase config, dùng biến **file** tên `MOVEVN_GOOGLE_SERVICES_FILE`, tải file lên EAS; EAS sẽ cấp đường dẫn tương ứng lúc build. Trên máy local, biến này trỏ đến file thật. Nếu chỉ build iOS, không cần file Firebase Android.

4. **Android:** tạo ứng dụng Firebase có package khớp với bản cài, tải `google-services.json`; cấu hình thêm **FCM v1 service account key** trong credentials của EAS. Hai file này khác nhau; có `google-services.json` thôi chưa đủ.

   ```powershell
   npx.cmd eas-cli credentials --platform android
   ```

5. **iPhone:** cần Apple Developer, bundle ID đúng và APNs push key/provisioning có quyền push. Với development build cài nội bộ, đăng ký thiết bị khi EAS yêu cầu.

   ```powershell
   npx.cmd eas-cli credentials --platform ios
   ```

6. Kiểm tra cấu hình local mà không chạy app, không in token/khóa:

   ```powershell
   npm.cmd run push:check
   ```

   Lệnh chỉ kiểm tra thông tin có trên máy, không xác minh được credentials trên Expo/Firebase/Apple. Config sẽ báo lỗi rõ nếu bật push mà thiếu/sai project ID.

7. Tạo và cài development build (lệnh build là thao tác riêng do người dùng chạy):

   ```powershell
   npx.cmd eas-cli build --profile development --platform android
   # Hoặc iPhone:
   npx.cmd eas-cli build --profile development --platform ios
   npx.cmd expo start --dev-client --lan
   ```

   Expo Go vẫn chạy toast/local notification nhưng **không dùng để test remote push**. Android dùng máy thật hoặc emulator có Google Play services; iOS dùng iPhone thật cho luồng đăng ký hiện tại. Đổi credentials/plugin/native config cần build lại; thay đổi JavaScript như sửa âm thanh mặc định chỉ cần reload development build.

## Backend

Trong `.env`/biến môi trường của **MoveVN-Backend**:

```dotenv
Push__Enabled=true
Push__ExpoAccessToken=
```

`Push__ExpoAccessToken` chỉ bắt buộc nếu Expo project bật enhanced push security. Đây là khóa backend, không đưa vào mobile. Sau khi thay đổi, khởi động lại backend. Các cấu hình mẫu mặc định giữ push tắt cho đến khi nhóm điền project/credentials thật.

PostgreSQL lưu thông báo và phiên đăng nhập; MongoDB lưu `PushTokens`, `PushDeliveries`. Backend phải truy cập được cả hai và HTTPS tới `exp.host`. Index Mongo được khai báo trong `MongoIndexInitializer`; không có thay đổi schema PostgreSQL nên không cần EF migration.

Luồng backend: controller/hosted worker → `IRemotePushService` → `IRemotePushRepository` và `IRemotePushSender`. Truy vấn SQL/Mongo ở Infrastructure repository, HTTP Expo ở sender. Worker kiểm tra khoảng 10 giây/lần, chống tạo trùng job theo thông báo + token, dùng lease, retry tối đa 5 lần. Ticket `ok` chưa phải receipt: receipt được kiểm tra sau 15 phút; khi retry receipt không gửi lại thông báo. Trạng thái `sent` nghĩa là provider đã chấp nhận qua receipt, không chứng minh người dùng đã nhìn thấy thông báo.

## Test thủ công

1. Cài development build, đăng nhập và cho phép thông báo. Kiểm tra request `PUT /api/notifications/push-devices` thành công; Mongo có thiết bị active và `SessionId`.
2. Sau đó tạo **thông báo mới** cho tài khoản đó: duyệt booking, phản hồi ticket, cập nhật tranh chấp, thanh toán, xe trống hoặc broadcast in-app. Không dùng lại thông báo cũ đã đọc để kết luận lỗi push.
3. Khi app đang mở: mỗi sự kiện chỉ có một banner/âm thanh dù SignalR và push cùng đến. Thử bấm và kiểm tra đích.
4. Đưa app về nền/khóa màn hình, tạo sự kiện mới. Kiểm tra nhận thông báo và mở app từ thông báo. Việc người dùng force-stop app, tắt quyền hoặc thiết bị hạn chế nền có thể ảnh hưởng việc nhận.
5. Bấm thông báo hỗ trợ/thanh toán: mở đúng chi tiết, kể cả khi thông báo nằm ngoài trang đầu. Không có nội dung tài khoản khác sau khi đổi tài khoản.
6. Đăng xuất rồi tạo thông báo: không gửi đến thiết bị vừa đăng xuất. Từ chối quyền hệ thống, mở app lại để đồng bộ hủy đăng ký.
7. Kiểm tra `PushDeliveries`: `pending` → `receipt` → `sent`; lỗi vĩnh viễn thành `failed`, tài khoản/phiên hết hiệu lực hoặc thông báo đã đọc thành `skipped`. Không chia sẻ token ra ngoài.

## Kiểm thử code (không chạy ứng dụng)

```powershell
npm.cmd run typecheck
npm.cmd test -- tests/pushNotifications.test.ts tests/localNotificationSetup.test.ts tests/remotePushRegistration.test.ts tests/pushNavigation.test.ts tests/systemNotificationPresentation.test.ts tests/notificationDelivery.test.ts tests/notificationCenter.test.ts
```

Backend:

```powershell
dotnet test tests/MoveVN.Tests/MoveVN.Tests.csproj --filter "FullyQualifiedName~RemotePushTests|FullyQualifiedName~PushDeviceTests"
```

Tài liệu chính thức: [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FCM v1](https://docs.expo.dev/push-notifications/fcm-credentials/), [troubleshooting](https://docs.expo.dev/push-notifications/faq/).
