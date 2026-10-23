# Báo cáo vi phạm trên mobile

## Phạm vi

Khách thuê/chủ xe gửi phản ánh tài khoản, tin xe hoặc booking và theo dõi xác minh. Staff/Admin xử lý trên web. Mobile không tự khóa tài khoản, ẩn xe, hủy booking hay hoàn tiền.

Điểm vào:
- **Tài khoản → Báo cáo vi phạm của tôi**: danh sách chỉ gồm phản ánh do tài khoản đang đăng nhập gửi.
- **Hồ sơ công khai → Báo cáo vi phạm**: gắn đúng tài khoản đang xem. Không hiện với hồ sơ của chính mình.
- **Chi tiết xe → Báo cáo vi phạm**: gắn đúng xe đang xem. Không hiện cho xe của mình. Xe không còn công khai phải phản ánh từ booking liên quan theo quy tắc backend.
- **Chi tiết chuyến đi/đơn thuê → Báo cáo vi phạm**: khách/chủ xe chỉ được báo cáo booking mình tham gia.
- **Thông báo kết quả → Xem kết quả báo cáo**: chỉ nhận đường dẫn `/my-violations/{guid}`; không chuyển link quản trị thành hồ sơ của người gửi.

## Quy tắc

- Đối tượng lấy từ màn hình nguồn, không yêu cầu nhập hoặc đoán mã ID. Backend luôn xác minh quyền và gắn nhãn đối tượng chính xác.
- Lý do lấy từ API và lọc theo loại đối tượng; không tự gán lý do không phù hợp.
- Mô tả bắt buộc 20–4.000 ký tự sau trim. Tối đa 5 ảnh, 5 MB/ảnh; JPG/PNG/WebP. Ảnh HEIC được đổi JPEG. Có xem trước, xóa ảnh, mở ảnh và chụp camera.
- Ảnh gửi đến endpoint bằng chứng vi phạm, không lẫn thư mục ảnh ticket. Lỗi gửi giữ nội dung/ảnh và dùng lại ảnh tải thành công khi thử lại; ngăn bấm gửi trùng, không tiếp tục gửi dưới tài khoản mới sau đăng xuất.
- API chặn nhiều báo cáo Open/InReview của cùng người cho cùng đối tượng, giới hạn 10 báo cáo trong 24 giờ, không cho tự báo cáo/chủ xe báo cáo xe của mình hoặc báo cáo tài khoản được bảo vệ. UI hiển thị lỗi backend và cho xem danh sách đã gửi. Timeout cần kiểm tra danh sách trước khi gửi lại vì endpoint tạo chưa có idempotency key.
- Không bổ sung/chỉnh sửa sau khi gửi vì API hiện không có chức năng đó. UI nhắc gửi đầy đủ bằng chứng trước khi xác nhận.
- Danh sách tìm theo nhãn đối tượng (tên tài khoản/biển số/mã booking), lọc loại và trạng thái, phân trang 10. Đổi bộ lọc về trang 1, hủy kết quả tải cũ, có đang tải/lỗi/thử lại/rỗng riêng biệt.
- Open = Chờ tiếp nhận; InReview = Đang xác minh; Resolved = Xác nhận vi phạm; Rejected = Không đủ căn cứ. Chưa kết luận không được trình bày thành đối tượng đã vi phạm.
- Chi tiết chỉ hiện mô tả, ảnh, kết luận gửi người báo cáo và lịch sử công khai. Không hiển thị snapshot, ghi chú nội bộ, danh tính phân công hoặc các thao tác kiểm duyệt. Tự cập nhật mỗi 20 giây khi app hoạt động; hỗ trợ kéo làm mới. Thời gian theo Việt Nam.
- Báo cáo vi phạm khác ticket hướng dẫn/hỗ trợ và tranh chấp bồi hoàn. Tính năng không tự giải quyết tranh chấp hay chuyển tiền.

## API và kiểm tra

Dùng các API hiện có: `/api/violation-reports/reasons`, `/my`, `/{guid}`, `POST /api/violation-reports`, `POST /api/violation-reports/evidence`. Không sửa backend, database hoặc thêm dependency.

`npm run typecheck`; `npm test -- violations.test.ts violationScreen.test.ts supportTicketScreen.test.ts`; `npx expo export --platform web --output-dir .expo/violations-preview`.

Kiểm thử dùng dữ liệu giả, không ghi vào database chung hoặc gửi báo cáo thật. Kiểm tra giao diện Expo ở kích thước điện thoại không thay thế kiểm tra camera/quyền ảnh và chuyển modal trên thiết bị iOS/Android thật.

## Rà soát mobile ngày 23/10/2026

Đây là đối chiếu mã nguồn hiện tại, API và danh sách nhánh remote; không khẳng định đã kiểm thử toàn bộ luồng trên thiết bị.

| Phần | Quan sát | Hướng tiếp theo |
| --- | --- | --- |
| Báo cáo vi phạm tài khoản/xe/booking | API và web đã có; mobile chưa có endpoint, màn hình hay điểm vào | Đã bổ sung trong nhánh này |
| Mục Ưu đãi trong Tài khoản | Chưa có onPress; khách đã có tab Ưu đãi riêng | Nối đường dẫn đúng vai trò |
| Mục Thống kê trong Tài khoản | Chưa có onPress; chủ xe đã có tab Tổng quan với số liệu | Nối về Tổng quan, xác định nội dung dành cho khách |
| Khuyến mãi chủ xe | Có service approve/reject nhưng mới thấy màn khuyến mãi khách | Trao đổi người phụ trách nhánh voucher trước khi bổ sung giao diện chủ xe |
| Điều hướng từ thông báo | Có luồng ticket; nhánh này thêm kết quả vi phạm; booking/ví vẫn chưa có CTA vào màn nghiệp vụ tương ứng trong NotificationCenter | Hoàn thiện điều hướng và quay lại đúng nguồn |
| Booking/thanh toán/bàn giao | Có nhiều màn hình thực và các nhánh remote đang cập nhật | Không sửa chồng vào nhánh các thành viên |
| Admin/Staff mobile | RootNavigator chủ động đưa về RoleNotSupportedScreen | Hiện quản trị trên web; không tự tính đây là lỗi hoặc mở rộng vai trò |

Một kiểm thử cũ `bookingFilters.test.ts` (customer) tìm component chưa có trong TripListScreen và đang lỗi từ trước nhánh này. Không sửa luồng đó trong chức năng vi phạm.
