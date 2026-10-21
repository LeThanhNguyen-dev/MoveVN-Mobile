# Đối chiếu ngoại lệ Booking và Dispute — 20/10/2026

**Cập nhật:** Đã chạy thêm PostgreSQL và Redis thực tế; xem [kết quả tích hợp](./BOOKING_INTEGRATION_RESULTS.md), gồm lỗi phát hiện và giới hạn còn lại.

Tài liệu này đối chiếu danh sách ngoại lệ người dùng gửi với mã nguồn hiện tại. “Có” là có nhánh xử lý trong mã nguồn; không đồng nghĩa đã kiểm thử với PayOS, Redis, PostgreSQL và thiết bị thật. Các quy tắc còn thiếu được ghi riêng, không tính là hoàn thành.

## Luồng chính

1. Khách đặt xe → Pending; chủ xe duyệt → Approved; thanh toán cọc hợp lệ → DepositPaid.
2. Hợp đồng phải hợp lệ và đã ký theo điều kiện backend trước khi xác nhận nhận xe.
3. Chủ xe gửi check-in; khách đồng ý → InProgress. Khách không đồng ý → gửi lý do, chủ xe sửa và gửi phiên bản mới; giữ lịch sử/ảnh cũ.
4. Khách báo trả xe → Returning. Báo trả xe chỉ ghi nhận yêu cầu, chưa thay cho đồng ý biên bản.
5. Chủ xe lập check-out. Khách kiểm tra và xác nhận một lần; nếu có phụ thu mới chọn ví/trực tiếp → Returned. Bấm lại trả về trạng thái hiện tại, không thu lại.
6. Chủ xe xác nhận nhận lại xe → Completed khi đủ điều kiện bàn giao và không có tranh chấp tiền đang mở. Xác nhận nhận xe và xác nhận nhận tiền là hai thao tác riêng.
7. Phụ thu chưa thanh toán tiếp tục được theo dõi cả khi Completed. Giải ngân có kiểm tra điều kiện, thời gian chờ và tranh chấp.

Không thêm trạng thái Expired cho booking: hệ thống hiện tự chuyển Pending quá hạn sang Rejected, Approved quá hạn thanh toán sang Cancelled, có lý do và lịch sử. Trạng thái Expired của payment là một khái niệm khác.

## Booking

| Nhóm ngoại lệ trong yêu cầu | Xử lý hiện tại / thay đổi | Giới hạn |
|---|---|---|
| Chủ xe từ chối, không phản hồi; khách hủy khi Pending | Có từ chối/hủy, job quá hạn và thông báo | Giữ trạng thái backend hiện tại nêu trên |
| Trùng lịch, hai yêu cầu cạnh tranh một xe | Có khóa theo xe, kiểm tra overlap và revision khi cập nhật | Cần kiểm thử cạnh tranh thật với Redis/PostgreSQL |
| Xe không còn khả dụng khi chủ xe duyệt | Đã bổ sung kiểm tra Approved và moderation hold trong khóa theo xe | Không cho duyệt xe đã bị ngưng/giữ kiểm duyệt |
| Thanh toán cọc lỗi, thiếu tiền, gửi lặp | Có kiểm tra ví, trạng thái, khóa và idempotency | Không tự ghi đã thanh toán khi thất bại |
| Callback chậm hoặc không tới | Có API kiểm tra với cổng và xử lý xác nhận; khoản tới sau hạn được hoàn vào ví theo chính sách hiện tại | Chưa tự suy luận thời điểm thanh toán thật từ callback đến muộn; cần dữ liệu thời gian đã xác minh từ cổng nếu muốn giữ booking trong trường hợp này |
| Thanh toán thừa hoặc đã hoàn | Có nhánh xử lý tiền tới muộn/giao dịch đã xử lý, hoàn vào ví chống lặp | Chưa xác minh giao dịch ngân hàng thật; không đồng nghĩa hoàn về ngân hàng gốc |
| Chưa đủ chữ ký, từ chối ký, thay đổi hợp đồng | Có chặn nhận xe khi chưa có hợp đồng hợp lệ và luồng hủy/gia hạn | Không bổ sung chính sách hoàn cọc mới hoặc tự sửa hợp đồng đã ký |
| Check-in thiếu biên bản/dữ liệu; khách không đồng ý | Có validation, lý do từ chối, phiên bản và ảnh lịch sử | Không cho xác nhận phiên bản đang chờ sửa |
| Check-in bị từ chối nhiều lần | Nhắc cả hai bên và Staff/Admin từ lần từ chối thứ ba; có nút hỗ trợ, ảnh và hội thoại gắn booking | Nhân viên xử lý; không tự xác nhận thay khách |
| Không phản hồi check-in | Nhắc xử lý sau 24 giờ; không tự kết luận đồng ý | Thời hạn này là nhắc xử lý, không phải thời hạn tự nhận xe |
| Chủ xe không giao, khách no-show, xác nhận nhầm | Có yêu cầu hỗ trợ và bằng chứng. No-show đang có tranh chấp, check-in chờ sửa hoặc hỗ trợ mở sẽ được hoãn hủy tự động | Hủy/hoàn vẫn theo quyền và chính sách hiện hành; không tự đảo trạng thái đã xác nhận |
| Trả muộn/sớm | Có mốc bàn giao thực tế, biểu phí và điều kiện hợp đồng | Không tự đổi giá thuê khi trả sớm |
| Thiếu check-out, chủ xe không phản hồi | Có hỗ trợ kèm bằng chứng và nhắc trường hợp bàn giao bị treo | Gửi hỗ trợ không tự chứng minh đã trả xe |
| Sai km, nhiên liệu, phụ thu; khách không đồng ý | Mở dispute ngay từ Returning nếu đã có check-out; chặn xác nhận/thu tiền trong lúc tranh chấp | Không tự ghi trách nhiệm khi thiếu chứng cứ |
| Khách đồng ý biên bản nhưng chưa trả phụ thu | Giữ Unpaid hoặc ExternalPending; không sửa biên bản tùy ý sau đồng ý | Không tự coi chọn trực tiếp là đã trả |
| Khách gửi xác nhận trả xe lặp | Đã bổ sung trả lại Returned/Completed hiện có, không thu lại, không đặt lại giờ trả xe | Xử lý cạnh tranh giữa các request vẫn dựa trên transaction/revision |
| Chủ xe nhận xe nhưng chưa nhận tiền | Có thể Completed và còn Unpaid; đã có test riêng | Tranh chấp tiền đang mở vẫn chặn hoàn tất bàn giao theo quy tắc hiện tại |
| Ví đủ/thiếu, thu tiền lỗi, gửi thanh toán nhiều lần | Có thu các khoản được chấp nhận, chống lặp; thiếu thì giữ khoản chưa thu | Không có cơ chế mặc định trừ một phần mỗi dòng phụ thu; không thêm PartiallyPaid mới |
| Trực tiếp chưa xác nhận hoặc hai bên khai khác nhau | ExternalPending cho tới khi chủ xe xác nhận; có gửi hỗ trợ và bằng chứng | Nền tảng không tự xác minh tiền mặt/chuyển khoản ngoài |
| Chủ xe xác nhận nhận tiền nhầm | Hỗ trợ có lịch sử, không có nút tự đảo khoản PaidExternal | Chưa có sổ bút toán đảo/điều chỉnh tiền mặt chuyên biệt |
| Giải ngân gặp tranh chấp, lặp hoặc lỗi | Có kiểm tra ở luồng gọi và đã bổ sung kiểm tra tranh chấp ngay trong khóa giải ngân; gặp tranh chấp thì dừng bằng lỗi, không báo giải ngân thành công | Cần kiểm thử rollback và race trên PostgreSQL thật |
| Dispute sau Completed | Có hồ sơ liên kết booking; không tự đảo trạng thái bàn giao | Damage có mốc 48 giờ riêng |
| Chưa đánh giá sau hoàn tất | Giữ điều kiện đánh giá hiện có | Không bổ sung thời hạn đánh giá mới khi chưa có chính sách |

## Dispute

| Nhóm ngoại lệ | Xử lý hiện tại / thay đổi | Giới hạn |
|---|---|---|
| Người không liên quan, thiếu mô tả, loại không hợp lệ | Có phân quyền và validation | Không có ảnh chưa chắc bị chặn; phụ thuộc loại và yêu cầu bằng chứng |
| Trùng hồ sơ hoặc nhiều vấn đề một booking | Chỉ một tranh chấp tiền đang mở; các dòng phụ thu nằm trong cùng quyết định; phạt nguội dùng nhánh riêng | Chưa mở nhiều tranh chấp tiền song song theo từng khoản |
| Ngoài thời hạn / thiếu biên bản | Có kiểm tra mốc và điều kiện theo loại; hỗ trợ để xem xét thiếu chứng cứ | Hỗ trợ không tự bỏ qua hạn Damage hoặc tạo nghĩa vụ bồi thường |
| Thiếu bằng chứng từ một/cả hai bên | Có NeedMoreEvidence, xác định bên phải gửi, token ảnh, kiểm tra đủ phản hồi khi yêu cầu Both | Nhân viên đối chiếu chất lượng chứng cứ |
| Một bên im lặng | Đã bổ sung hạn theo giai đoạn, mặc định 72 giờ và cấu hình Admin | Không tự chấp nhận thay người dùng |
| Quá hạn điều tra/bằng chứng/quyết định/quyết toán | Job mỗi 5 phút chuyển quyền theo dõi cho Admin, lưu audit, nhắc người liên quan hằng ngày có chống trùng | NeedMoreEvidence và AwaitingExternalSettlement giữ nguyên để còn nộp bằng chứng/xác nhận tiền; hồ sơ không tự đóng |
| Nhân viên có xung đột, một/cả hai bên không đồng ý | Có chuyển Admin và phân quyền xử lý | Đánh giá xung đột lợi ích là thao tác nghiệp vụ của người có thẩm quyền |
| Hai bên đồng ý quyết định Staff | Quyết định mới được áp dụng; có snapshot và kiểm tra phiên bản | Không thu trước khi đủ đồng ý |
| Admin giữ/sửa quyết định trước quyết toán | Có quyền Admin, lịch sử, cập nhật nghĩa vụ được hỗ trợ | Không cho sửa tự do hồ sơ đã Resolved |
| Không bồi thường | Đóng khi đủ điều kiện, đồng bộ Report Closed | Quyết định chỉnh phụ thu vẫn phải áp dụng hợp lệ |
| Bồi thường hai chiều | Ví bên phải trả → bên nhận; hỗ trợ ngoài hệ thống theo lựa chọn quyết toán | Không dùng cọc escrow để bồi thường |
| Ví thiếu hoặc chuyển thất bại | Không ghi đã trả; giữ luồng chờ và cho xử lý lại | Chưa có sổ công nợ độc lập ngoài dữ liệu quyết định/tranh chấp |
| Đã xác nhận trả ngoài nhưng ví thiếu phần còn lại | Chặn tăng công nợ ngoài lần hai; yêu cầu bổ sung phần ví | Không coi xác nhận ngoài là đã trả toàn bộ nghĩa vụ |
| Một bên không xác nhận tiền ngoài | Hạn theo dõi, nhắc Admin, gửi hỗ trợ và bằng chứng | Không tự kết luận chuyển tiền thành công |
| Đã thu phụ thu cao hơn quyết định | Hoàn chênh lệch ví; tiền trực tiếp cần lựa chọn hoàn qua ví rõ ràng | Không hoàn trùng phần chênh lệch như một khoản bồi thường nữa |
| Ví chủ xe thiếu tiền hoàn | Chặn áp dụng hoàn/giảm số đã thu, không đổi phí hay ghi đã hoàn; có thể nạp ví rồi thử lại | Chưa có công nợ hoàn độc lập tự thu khi chủ xe nạp tiền |
| Quyết định đổi sau khi đã chuyển tiền/đóng hồ sơ | Giữ hồ sơ và lịch sử cũ; chuyển hỗ trợ xem xét | Chưa triển khai sổ giao dịch điều chỉnh mới; không thể tính trường hợp này là tự động hoàn chỉnh |
| Hư hại không có check-out hoặc sau hạn | Không tự suy trách nhiệm; Damage cần check-out và mốc 48 giờ backend; có hỗ trợ thiếu chứng cứ | Chi phí sửa, trách nhiệm, nhiều hư hại do Staff/Admin đánh giá |
| Phạt nguội | Giữ luồng chứng từ/thời gian thuê/chống trùng/phản hồi riêng, kể cả booking Completed | Job nhắc dispute mới không ghi đè thời hạn và workflow phạt nguội |
| Tranh chấp cọc/phí nền tảng | Chỉ nhận khi có giao dịch nền tảng phù hợp | Ghi chú điều chỉnh Payment không phải lệnh tự động hoàn ngân hàng; không tự tạo khoản tiền khi chưa có giao dịch |

## 10 trường hợp ưu tiên kiểm thử

| # | Trường hợp | Bằng chứng / trạng thái |
|---|---|---|
| 1 | Thanh toán thành công nhưng callback chậm | Có test late deposit hoàn vào ví chống lặp; đối soát gateway có mã nguồn. Còn kiểm thử PayOS sandbox và thời điểm trả tiền thật |
| 2 | Hai booking được duyệt đồng thời cùng xe | Có khóa, overlap/revision và test điều kiện lịch; còn test đồng thời với Redis/PostgreSQL thật |
| 3 | Từ chối check-in nhiều lần | CheckInRevisionReviewTests + CheckoutReminderTests: lịch sử và nhắc cả hai bên/Admin |
| 4 | Xác nhận trả xe hai lần | BookingCheckoutTests + BookingReturnRetryTests: giữ trạng thái, không thu lại |
| 5 | Nhận lại xe khi phụ thu chưa trả | DisputeReturnCompletionTests: Completed, khoản vẫn Unpaid |
| 6 | Chọn trả trực tiếp, chủ xe chưa nhận | Checkout payment tests: ExternalPending không phải PaidExternal; BookingAssistance lưu bằng chứng |
| 7 | Mở dispute lúc chờ checkout | DisputeCreateTests: Returning có biên bản được mở, thiếu biên bản bị chặn |
| 8 | Một bên không phản hồi quyết định | DisputeFollowUpTests: quá hạn chuyển Admin, không tự đồng ý/thu tiền |
| 9 | Ví chủ xe thiếu tiền hoàn | DisputeSurchargeCoverageTests: không sửa phí/ghi hoàn, nạp đủ rồi thử lại |
| 10 | Có dispute trước giải ngân | BookingEscrowDisputeGuardTests: chặn ngay bước giải ngân; còn race thật với PostgreSQL |

Không đánh dấu 10/10 kiểm thử thực tế: trường hợp 1, 2 và phần cạnh tranh của 10 vẫn cần môi trường tích hợp.

## Triển khai và kiểm chứng

- Cần áp dụng cả AddCheckInRevisionReview và AddBookingSupportLink trước khi chạy backend mới. Chưa áp dụng vào database đang kết nối.
- Từ thư mục MoveVN-Backend: dotnet ef database update --project src/MoveVN.Infrastructure --startup-project src/MoveVN.Api
- Cấu hình mới: dispute_followup_enabled=true, dispute_response_hours=72, dispute_settlement_hours=72; số giờ từ 1 đến 720. Các định nghĩa xuất hiện trong quản trị cấu hình; mặc định có hiệu lực khi chưa lưu giá trị.
- Backend: bộ test Booking/PaymentService/Dispute/TrafficFine/Checkout/SupportTicket được chạy; kết quả cuối ghi trong DISPUTE_WORKFLOW_REVIEW.md.
- Mobile: 256 test qua; TypeScript và Expo export Android qua. Web: TypeScript và production build qua.
- Test workflow dùng database thử nghiệm, đã xác minh thêm rollback phí/ledger/biên bản trên PostgreSQL thật. Chưa thao tác UI trên thiết bị thật. Bốn test AssistantBookingStorage phụ thuộc MongoDB bị skipped; đây không phải bốn test tiền của booking.
