# Thông báo trong ứng dụng mobile

## Phạm vi

- Customer và Owner mở thông báo từ chuông trên trang chính hoặc Tài khoản → Thông báo.
- Admin và Staff mở thông báo từ chuông bên cạnh Thông báo của bạn trên màn hình vai trò chưa hỗ trợ. Giữ nguyên giới hạn chức năng quản trị/vận hành trên mobile của development.
- Danh sách gồm Tất cả / Chưa đọc, kéo xuống làm mới, tải thêm từng trang 20 thông báo.
- Chạm một thông báo để xem toàn bộ nội dung và đánh dấu đã đọc trên server.
- Đọc tất cả cập nhật cả những thông báo chưa tải về, không chỉ danh sách đang thấy.
- Chuông hiển thị số chưa đọc thực tế; trên 99 hiển thị 99+, bằng 0 ẩn badge.
- SignalR cập nhật khi app hoạt động. Khi quay lại từ nền, app đồng bộ lại dữ liệu.
- Nếu kết nối trực tiếp mất, app thử lại và đồng bộ mỗi 30 giây trong foreground.
- Đổi vai trò giữ nguyên thông báo của cùng tài khoản; đăng xuất/đổi tài khoản xóa dữ liệu cũ.

Đây là thông báo **trong app**. Chưa bao gồm thông báo đẩy của Android khi app đóng.
Không thêm bảng, migration hoặc thay đổi backend/frontend. Mobile dùng API hiện có.

## API đang dùng

| API | Công dụng |
| --- | --- |
| `GET /api/notifications?page=1&pageSize=20` | Danh sách của tài khoản đang đăng nhập |
| `GET /api/notifications?unreadOnly=true&page=1&pageSize=20` | Danh sách chưa đọc |
| `GET /api/notifications/unread-count` | Tổng chưa đọc |
| `PUT /api/notifications/{id}/read` | Đánh dấu một thông báo đã đọc |
| `PUT /api/notifications/read-all` | Đánh dấu tất cả đã đọc |
| `/hubs/notifications` | SignalR: `notification.created`, `notification.unreadCountChanged` |

Chỉ thông báo kênh InApp và Both xuất hiện. Kênh Email không hiển thị trong app.
Backend xác định người nhận từ token đăng nhập và kiểm tra quyền sở hữu khi đánh dấu đọc.

## Chạy và tải lại

Giữ backend và terminal Metro đang chạy. Các thay đổi này chỉ là TypeScript/JavaScript,
không cần build lại APK. Tại terminal Metro nhấn `r` để reload sau khi sửa.

Nếu mở terminal PowerShell mới trên Windows:

```powershell
cd "D:\MoveVN-Mobile-Android"
$env:ANDROID_HOME = "C:\Users\ACER\AppData\Local\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
$env:EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:5171"
npx.cmd expo start --dev-client
```

Bật Pixel 6a rồi nhấn `a`. Với máy khác, thay đường dẫn bằng đường dẫn SDK của máy đó.

## Tạo thông báo để kiểm tra thủ công

1. Đăng nhập một tài khoản test trên mobile, ghi lại User ID từ danh sách người dùng trên web.
2. Trên web, đăng nhập Admin hoặc Staff, mở Gửi thông báo (`/admin/broadcast` hoặc `/staff/broadcast`).
3. Chọn kênh InApp, đối tượng theo người dùng (ByUser), nhập đúng User ID của tài khoản test.
4. Nhập tiêu đề `Kiểm tra thông báo mobile 01`, nội dung `Thông báo thử để kiểm tra nhận và đánh dấu đã đọc trên Android.`
5. Gửi thông báo. Khi app đang mở và kết nối tốt, badge tăng và thông báo mới hiện đầu danh sách.
6. Chạm thông báo: thấy đầy đủ nội dung, trạng thái Đã đọc và số badge giảm theo server.

Chỉ chọn tài khoản test cụ thể; không cần gửi cho toàn bộ nền tảng để thử chức năng.

## Checklist test trên Android thật / giả lập

| Trường hợp | Kết quả mong đợi |
| --- | --- |
| Đăng nhập Customer / Owner / Admin / Staff | Có lối mở danh sách thông báo tương ứng |
| Không có thông báo | Hiện trạng thái trống, chuông không có badge |
| Nhận InApp hoặc Both khi app đang mở | Badge và danh sách cập nhật, không tạo bản sao |
| Gửi kênh Email | Không xuất hiện trong danh sách thông báo mobile |
| Mở thông báo chưa đọc | Xem đầy đủ nội dung, lưu trạng thái đã đọc trên backend |
| Mở lại thông báo đã đọc | Số chưa đọc không giảm thêm |
| Chọn Chưa đọc | Chỉ hiện những thông báo chưa đọc |
| Đọc trong tab Chưa đọc rồi quay lại | Thông báo biến mất khỏi tab, không bỏ sót thông báo khi tải trang tiếp |
| Đọc tất cả khi có hơn 20 thông báo | Tất cả trên server được đánh dấu, không chỉ trang đầu |
| Nhận thông báo mới trong lúc Đọc tất cả | Đồng bộ lại trạng thái mới từ backend |
| Hơn 20 thông báo | Xem thêm tải trang sau, không trùng dòng, không mất lịch sử |
| Kéo xuống hoặc bấm làm mới | Lấy dữ liệu mới, có trạng thái đang tải |
| Backend mất kết nối lúc mở danh sách | Hiện lỗi và Thử lại; không báo nhầm là không có dữ liệu |
| Backend mất kết nối lúc đánh dấu đọc | Không đánh dấu thành công giả; có thông báo lỗi và thử lại |
| Tắt backend rồi bật lại | App thử kết nối lại khi foreground; có thể kéo xuống làm mới ngay |
| Đưa app xuống nền rồi quay lại | Đồng bộ lại số chưa đọc và danh sách đang mở |
| Đọc thông báo trên web khi mobile đang mở | Mobile cập nhật số và tải lại danh sách từ server |
| Đăng xuất A, đăng nhập B | Không hiển thị thông báo hoặc badge của A |
| Chuyển Customer ↔ Owner cùng tài khoản | Giữ thông báo của tài khoản đó |
| Nút Back của Android | Chi tiết → danh sách → đóng màn hình thông báo |
| Giao diện sáng / tối, font lớn | Chữ rõ, nút không chồng nhau; nội dung dài có thể cuộn |

## Kiểm tra tự động

```powershell
npm.cmd run typecheck
npm.cmd test
```

Test mới bao gồm hành vi UI, phân trang và retry, HTTP/SignalR chạy đồng thời,
đổi tài khoản, phản hồi cũ sau đăng xuất, thất bại đánh dấu đọc, reconnect, metadata lỗi.
Các test này dùng mock và không gửi thông báo hay thay đổi database chung.
Checklist Android ở trên là kiểm tra thủ công, không được xem là đã thực hiện chỉ vì unit test đạt.


## Banner thông báo trong app (20/10/2026)

- ToastHost được gắn một lần ở RootNavigator cho cả chủ xe và khách thuê. Thông báo mới trượt từ trên xuống; chạm nội dung mở trung tâm thông báo.
- SignalR và đồng bộ API mỗi 30 giây dùng chung bộ nhận để tránh banner trùng khi reconnect. Lần đồng bộ đầu tạo mốc, không bật lại thông báo cũ khi đăng nhập.
- Màn chi tiết đơn đang mở tải lại khi nhận thông báo liên quan đến booking; phiên đăng xuất hoặc đổi tài khoản xóa banner.
- Đây là banner khi dùng app. Push notification khi ứng dụng bị đóng cần hạ tầng push riêng.

## Check-in và trả xe

- Check-in: khách nhập lý do yêu cầu lập lại; chủ xe sửa nội dung, thêm ảnh mới và gửi lại. Giữ lịch sử và ảnh cũ trong snapshot; không cho xác nhận biên bản đang chờ sửa hoặc sai phiên bản.
- Check-out: khách có thể chọn Không đồng ý / Mở tranh chấp ngay từ biên bản, trước khi đồng ý thu phí.
- Khách kiểm tra biên bản → xác nhận đã bàn giao xe → chọn ví hoặc trả trực tiếp nếu có phụ thu → gửi xác nhận. Backend ghi nhận xác nhận và phương thức trong cùng một giao dịch; nút tiếp tục ở bước đầu chưa thu tiền.
- Sau xác nhận, trạng thái Returned chờ chủ xe bấm Xác nhận đã nhận xe để chuyển Completed. Xác nhận đã nhận tiền phụ thu chỉ cập nhật thanh toán, không xác nhận tình trạng xe.
- Completed thể hiện hoàn tất bàn giao; khoản phụ thu còn thiếu vẫn được hiển thị riêng. Khách không phải xác nhận trả xe lần thứ hai.
- Backend cần migration AddCheckInRevisionReview trước khi chạy bản mobile này.
