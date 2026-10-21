# Kết quả kiểm thử tích hợp Booking / Dispute — 20/10/2026

## Môi trường thực sự đã chạy

- PostgreSQL 17 chạy local ở 127.0.0.1, cluster riêng trong thư mục tmp; không dùng Supabase của dự án.
- Mỗi test booking có schema UUID riêng, giữ model hiện tại và các khóa/ràng buộc liên quan; chỉ loại bảng VehicleEmbedding thuộc AI search vì PostgreSQL local chưa có pgvector.
- Redis: dùng RedisLockService thật qua Upstash, chỉ thao tác khóa ngẫu nhiên movevn:test:booking:vehicle:<UUID>, có TTL 30 giây và giải phóng sau test. Không chạm khóa booking đang hoạt động.
- Không gọi chuyển tiền ngân hàng/PayOS thật.

## Kết quả đã xác nhận

| Kiểm tra | Kết quả |
|---|---|
| Xác nhận trả xe lặp trên PostgreSQL | Qua; một lịch sử Returned, giữ nguyên thời gian trả xe đã lưu, không tạo giao dịch ví |
| Refund phí rồi lỗi trước commit | Qua; rollback số dư hai ví, ledger, phí và phiên bản biên bản cùng nhau |
| Hai context tranh chấp và trả xe cập nhật cùng booking | Qua; revision chặn context cũ và rollback hồ sơ tranh chấp chưa commit |
| Unique index yêu cầu hỗ trợ đang mở | Qua; chặn hồ sơ trùng, cho phép hồ sơ mới khi hồ sơ trước đã đóng |
| SQL AddCheckInRevisionReview và AddBookingSupportLink | Qua trên PostgreSQL; giữ dữ liệu booking/check-in cũ, thêm đúng cột và index |
| Cập nhật ví cạnh tranh, ledger rollback, audit outbox rollback, unique withdrawal | Qua trên PostgreSQL |
| 12 yêu cầu Redis tranh khóa cùng lúc | Qua; một bên lấy được khóa, token sai không mở được khóa, token đúng mở được |
| Script dựng và dọn môi trường kiểm thử | Qua; 380 test qua, 4 test AssistantBookingStorage phụ thuộc PostgreSQL + MongoDB bị skipped |

Script: MoveVN-Backend/tests/Run-BookingIntegration.ps1. Chạy từ thư mục backend:

~~~powershell
.\tests\Run-BookingIntegration.ps1
~~~

Script dùng PostgreSQL binaries mặc định ở C:\Program Files\PostgreSQL\17\bin, port 55440; có thể đổi bằng -PostgresBin và -Port. Nó tạo cluster/database riêng, không áp dụng migration vào database trong .env, khôi phục biến môi trường rồi dừng server khi kết thúc. Test Redis chỉ chạy nếu đã cấp BOOKING_TEST_REDIS_URL và BOOKING_TEST_REDIS_TOKEN; không ghi token vào log hoặc script.

## Vấn đề tìm thấy khi chạy rộng

- Lịch xe từng bỏ sót ngày bàn giao sớm so với lịch đã đặt. Đã sửa VehicleAvailabilityQuery và GetVehicleBusyPeriodsAsync để tính thời gian chiếm xe từ lịch sử nhận xe thực tế, vẫn giữ StartDate hợp đồng. Test 1 giờ/3 giờ sớm qua, có thêm test truy vấn PostgreSQL.
- Bộ WithdrawalFeature11VerificationTests còn 9 ca lỗi: tổng chi trước đó chưa được tính trong kỳ vọng, quy tắc hủy/duyệt/hoàn đã khác kỳ vọng, audit không được mock theo cách bộ test chờ và mock GetPayoutInfoAsync chưa triển khai. Chưa sửa chính sách rút tiền để làm các test này qua. Cần đối chiếu riêng nghiệp vụ rút tiền.
- Dựng toàn bộ lịch sử migration từ database trắng bị chặn bởi migration ReconcileDisputePlatformFeeAndEarlyEarning yêu cầu tài khoản Admin. Seed Admin test xong thì tiếp tục bị chặn vì extension vector chưa cài. Hai migration booking mới đã được kiểm thử SQL riêng như trên; không coi toàn bộ chuỗi migration là đã qua.

## Giới hạn còn lại

- Chưa có test xuyên suốt hai lệnh ApproveAsync cùng xe qua Redis + PostgreSQL; đã xác minh riêng khóa Redis và các ràng buộc/revision PostgreSQL.
- Chưa đối soát PayOS sandbox/callback ngoài mạng và chưa thử chuyển tiền ngân hàng. Các test tiền hiện dùng ví/ledger thật trong database test, gateway được thay bằng fake khi cần.
- Đã khởi động được emulator Pixel_6, nhưng máy chưa có bản cài MoveVN/dev client cho emulator. Chưa thao tác UI booking thực tế trên Android. Emulator đã được dừng sau kiểm tra.
- Chưa xác minh hoàn chỉnh luồng người dùng từ mobile → API → gateway. Không đánh dấu 10/10 checklist nghiệp vụ thực tế.

## Toàn bộ backend sau sửa lỗi lịch xe

Chạy đủ 1.355 test: **1.322 qua, 9 lỗi, 24 skipped**. Chín lỗi đều thuộc WithdrawalFeature11VerificationTests. Test PostgreSQL mới cho bàn giao sớm và test Redis đều qua. Báo cáo máy đọc được: MoveVN-Backend/tmp/verification/booking-full-verification-final.trx. Đây là kết quả toàn bộ backend, khác với bộ test tập trung booking đã qua ở trên.
