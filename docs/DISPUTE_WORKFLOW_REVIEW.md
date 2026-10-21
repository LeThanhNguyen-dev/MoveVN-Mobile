# Rà soát tranh chấp — 20/10/2026

## Phạm vi và hành vi

| Trường hợp | Hành vi đã đối chiếu |
| --- | --- |
| Người ngoài booking | Không được mở, xem hoặc xác nhận hồ sơ của hai bên |
| Tranh chấp thường đang mở | Chặn mở trùng; chặn xác nhận checkout, thu phụ thu, hoàn tất bàn giao và giải ngân cọc |
| Trả xe chưa đồng ý biên bản | Khách mở form đầy đủ, chọn đúng loại vấn đề và gửi tối đa 6 ảnh |
| Hư hại | Cần biên bản checkout; áp dụng hạn 48 giờ sau hoàn tất trả xe theo mốc backend; biên bản còn chờ xác nhận được phép phản đối |
| Phụ phí trả trễ | Quyết định sửa số tiền và có thể sửa giờ bàn giao; lưu phiên bản |
| Vượt km | Quyết định có số tiền cuối cùng riêng, độc lập phí trả trễ |
| Vệ sinh/khử mùi/phụ thu khác | Điều chỉnh từng điều khoản có trong booking; chặn khoản lạ, trùng và vượt trần |
| Phí chưa thu | Hủy phí cũ, tạo mức phí mới; vẫn chờ khách đồng ý nếu booking còn Returning |
| Đã chọn trả trực tiếp | Giữ phần còn thiếu ở ExternalPending sau điều chỉnh; không tự coi là đã nhận tiền |
| Đã thu qua ví | Hoàn phần thu vượt từ ví chủ xe sang ví khách trong cùng giao dịch |
| Đã được chủ xe xác nhận nhận trực tiếp | Cần đánh dấu cho phép hoàn chênh lệch qua ví; không ghi đã hoàn khi ví chủ xe thiếu tiền |
| Quyết định Staff | Chờ cả hai bên chấp nhận trước khi áp dụng khoản tiền |
| Chuyển Admin | Khóa luồng xử lý Staff cho hồ sơ do Admin quản lý |
| Quyết định Admin | Thực hiện theo quyền Admin; khoản trực tiếp vẫn cần xác nhận quyết toán |
| Bồi thường khách → chủ xe hoặc chủ xe → khách | Có thể chọn ví hoặc trả trực tiếp; chuyển tiền đúng chiều và chống thực hiện lại |
| Ví thay đổi trước quyết toán | Chưa có xác nhận trực tiếp: chuyển phần thiếu sang ngoài, xóa dấu đóng hồ sơ; đã có xác nhận trực tiếp: yêu cầu nạp đủ phần ví, không cộng lại khoản đã trả ngoài |
| Bổ sung bằng chứng | Chỉ bên được yêu cầu gửi; yêu cầu Both phải đợi đủ hai bên |
| Token ảnh | Chặn token giả, hết hạn, URL khác và token của tài khoản khác |
| Phạt nguội | Đối chiếu thông báo/biển số/thời gian thuê, phản hồi trách nhiệm, kiểm tra chứng từ; trường hợp hoàn chủ xe phải có chủ xe xác nhận đã nhận và nhân viên duyệt |
| Đóng hồ sơ | Đồng bộ trạng thái Report sang Closed khi Dispute thực sự Resolved |
| Mobile đang mở hồ sơ | Cập nhật theo thông báo, khi trở lại app và mỗi 15 giây; có nút Làm mới; tự lấy phiên bản mới sau thao tác lỗi |
| Bấm trùng/response cũ | Khóa gửi đồng thời; response tải nền không ghi đè kết quả thao tác mới |

## Quy tắc nghiệp vụ giữ nguyên

- Cọc booking là tiền thuê trả trước, không lấy escrow để trả bồi thường tranh chấp. Ví bồi thường lấy từ bên phải trả.
- Tranh chấp Payment về cọc/phí nền tảng yêu cầu giao dịch nền tảng tương ứng. Ghi chú điều chỉnh thanh toán là đề xuất xử lý, không phải lệnh tự động hoàn tiền.
- Accident không nhập bồi thường qua module này. TrafficFine dùng hồ sơ chứng từ riêng.
- Quyết định sửa số tiền vượt km không tự sửa công-tơ-mét; số tiền quyết định và chỉ số trong biên bản được hiển thị riêng.
- Các khoản không có trong yêu cầu điều chỉnh được giữ nguyên; không gộp phần hoàn phụ phí thành một khoản bồi thường nữa.
- Quyết toán trực tiếp vẫn dựa trên xác nhận của cả hai bên; nền tảng không xác minh được chuyển khoản ngoài cho tranh chấp thường.

## Kiểm chứng và triển khai

- Backend: bộ test Dispute, Checkout, CheckIn, TrafficFine; thêm các test DisputeSurchargeCoverageTests, DisputeEvidenceReceiptTests và DisputeReturnCompletionTests.
- Mobile: toàn bộ Vitest; thêm test cập nhật hồ sơ theo thông báo, lỗi phiên bản, bấm trùng và response nền trả chậm.
- Web: TypeScript và production build.
- Các test nghiệp vụ mới dùng database trong bộ test, không ghi vào Supabase thật. Chưa kiểm chứng rollback trên PostgreSQL thật hoặc trên thiết bị mobile thật.
- Browser của phiên làm việc không có kết nối khả dụng, nên chưa kiểm chứng trực quan bằng trình duyệt.
- Migration AddCheckInRevisionReview và AddBookingSupportLink cần được áp dụng khi triển khai backend. Chưa cập nhật database đang kết nối.

- Kết quả kiểm tra đã hoàn thành: 194 test backend liên quan và 253 test mobile qua; TypeScript mobile và web qua; production build web và Expo export Android qua.
- Áp dụng migration check-in khi triển khai, từ thư mục MoveVN-Backend:
  `dotnet ef database update --project src/MoveVN.Infrastructure --startup-project src/MoveVN.Api`

## Đối chiếu ngoại lệ mới

Xem [BOOKING_EXCEPTION_REVIEW.md](./BOOKING_EXCEPTION_REVIEW.md) để xem từng nhóm ngoại lệ, 10 ca ưu tiên và các chức năng còn thiếu. Đợt kiểm tra mới: 354 test backend qua, 4 test tích hợp skipped; 256 test mobile qua; TypeScript, build web và Expo export Android qua.

## Kiểm thử tích hợp tiếp theo

Đã chạy PostgreSQL và Redis thực tế, kiểm tra hai migration mới và phát hiện/sửa lỗi lịch bàn giao sớm. Xem [BOOKING_INTEGRATION_RESULTS.md](./BOOKING_INTEGRATION_RESULTS.md). Các câu “chưa kiểm chứng rollback PostgreSQL” ở phần kết quả trước đây được thay thế bởi báo cáo mới này cho các trường hợp đã kiểm thử. Bộ test toàn backend vẫn còn lỗi trong WithdrawalFeature11VerificationTests.
