# Checklist kiểm thử booking Web / Mobile

Phạm vi: giá thuê, bộ lọc, nhận xe sớm, check-in/out, vượt km, PDF,
gia hạn/ký hợp đồng và các nhánh hủy, tranh chấp, quyết toán liên quan.
Các ô bên dưới dành cho kiểm thử thủ công; chưa được đánh dấu là đã chạy.

## Chuẩn bị

- Hai tài khoản riêng: khách và chủ xe; thêm staff/admin cho nhánh tranh chấp.
- Một xe trống và một xe có lịch bận/lịch khóa để kiểm tra chặn lịch.
- Xe có phụ phí vượt km: 200 km/ngày, 5.000đ/km. Tạo thêm cấu hình theo chuyến
  và cấu hình trần 100.000đ để thử riêng; mỗi lần đổi chính sách cần tạo đơn mới.
- Ví khách đủ tiền và một ca ví không đủ. Thanh toán dùng môi trường/tài khoản test.
- Dùng bản Mobile mới có expo-sharing; kiểm tra Android/iOS thật cho camera và chia sẻ.
- Mỗi ca hợp lệ nên chạy: web → web, Mobile → Mobile, chủ xe web → khách Mobile,
  chủ xe Mobile → khách web. So sánh cùng bookingId, giờ Việt Nam, giá và phiên bản.
- Dùng đơn mới cho từng nhánh hủy, tranh chấp hoặc checkout đã xác nhận.

## 1. Đặt xe, lịch và giá

| ID | Thao tác | Kết quả mong đợi | KQ |
|---|---|---|---|
| B01 | Đặt một chuyến hợp lệ từ chi tiết xe | Tạo đúng xe, lịch, địa điểm, ghi chú; trạng thái Pending | [ ] |
| B02 | Chọn lịch trùng đơn khác/lịch chủ xe khóa | Không cho đặt; nêu lý do | [ ] |
| B03 | Chọn giờ sát chuyến trước/sau theo thời gian chuẩn bị cấu hình | Chặn trong khoảng chuẩn bị, cho phép đúng ranh giới | [ ] |
| B04 | Chọn giờ qua nửa đêm và thuê nhiều ngày | Web/Mobile cùng số ngày, cùng giờ nhận/trả UTC+7 | [ ] |
| B05 | So sánh giá cố định và giá động theo từng ngày | Giá xem trước và giá backend chốt khớp; hiển thị các thành phần | [ ] |
| B06 | Thử các mốc giảm theo số ngày thuê | Giảm giá theo cấu hình; hai nền tảng cùng tổng tiền và cọc | [ ] |
| B07 | Áp mã khuyến mãi hợp lệ, hết hạn, sai, không đủ điều kiện | Đúng mức giảm hoặc báo lỗi; không giảm hai lần | [ ] |
| B08 | Nhận xe tại chủ xe; giao trong bán kính miễn phí; giao ngoài bán kính miễn phí | Phí giao đúng khoảng cách/chính sách, cộng đúng vào tổng | [ ] |
| B09 | Điểm nhận/trả vượt phạm vi giao xe | Backend từ chối; không tạo đơn sai | [ ] |
| B10 | Lọc đơn theo trạng thái + từ khóa + khoảng ngày; chuyển trang rồi đổi bộ lọc | Kết quả đúng, đổi bộ lọc trở về trang 1, không lẫn đơn người khác | [ ] |

## 2. Duyệt, đặt cọc và hợp đồng

| ID | Thao tác | Kết quả mong đợi | KQ |
|---|---|---|---|
| P01 | Chủ xe duyệt; chủ xe từ chối có/không lý do | Duyệt → Approved; từ chối cần lý do và ghi lịch sử | [ ] |
| P02 | Khách trả cọc bằng ví đủ tiền | Trừ đúng một lần; DepositPaid; web/Mobile cùng số escrow thực thu | [ ] |
| P03 | Khách trả cọc bằng ví thiếu tiền | Báo thiếu tiền; không đổi sang đã trả, không trừ dở | [ ] |
| P04 | Thanh toán PayOS thành công rồi quay lại app | Đơn được cập nhật khi kiểm tra/poll; không cần tạo giao dịch mới | [ ] |
| P05 | Hủy/đóng PayOS hoặc giao dịch hết hạn | Không ghi nhận đã trả cọc; cho kiểm tra/tải lại trạng thái | [ ] |
| P06 | Đơn Approved quá hạn cọc hoặc đã đến giờ nhận xe | Không cho trả cọc cho đơn hết hiệu lực; backend kiểm tra lại | [ ] |
| P07 | Bấm thanh toán/xác nhận liên tục, tải lại sau thành công | Không tạo lần thu trùng hoặc báo thành công sai | [ ] |
| C01 | Chủ xe tạo hợp đồng khi chưa có hợp đồng còn hiệu lực | Tạo đúng booking; không tạo bản sống trùng | [ ] |
| C02 | Xem hợp đồng bằng PIN đúng/sai; chưa có PIN; quên PIN | Đúng luồng PIN/OTP; sai không mở dữ liệu | [ ] |
| C03 | Hai bên ký bằng OTP đúng/sai/hết hạn | Ký đúng vai; đủ hai chữ ký mới Active; lỗi không tự ký | [ ] |
| C04 | Khách xác nhận nhận xe khi hợp đồng chưa Active | Backend chặn; app thông báo rõ | [ ] |
| C05 | Tải PDF hợp đồng trước/sau xác minh PIN | Yêu cầu xác minh khi cần; đúng nội dung, phiên bản và chữ ký | [ ] |
| C06 | Chủ xe gia hạn hợp đồng Active/Overdue mới nhất 1–90 ngày | Tạo phiên bản mới, ngày trả và tiền/cọc mới đúng; hai bên cần ký lại | [ ] |
| C07 | Nhập gia hạn 0, số âm, số lẻ, 91 ngày; khách thử tự gia hạn | Chặn dữ liệu/quyền sai; không tạo bản mới | [ ] |
| C08 | Gia hạn trùng lịch xe hoặc hợp đồng đã cũ | Backend từ chối; không thay đổi lịch trái phép | [ ] |
| C09 | Cọc bổ sung sau gia hạn: trả đủ, chưa trả, hết hạn | Đúng hạn và số tiền; quá hạn quay về hợp đồng cũ theo backend | [ ] |

## 3. Nhận xe / check-in

| ID | Thao tác | Kết quả mong đợi | KQ |
|---|---|---|---|
| I01 | Nhận xe đúng giờ với xe trống | Chủ lập biên bản, khách kiểm tra rồi xác nhận → InProgress | [ ] |
| I02 | Nhận sớm 1 giờ và đúng 2 giờ trước lịch, xe trống | Backend cho phép; giờ trả và giá thuê giữ theo đơn | [ ] |
| I03 | Nhận sớm quá 2 giờ; nhận sớm khi xe bận hoặc bị khóa | Chặn cả tạo/xác nhận; hiển thị lý do từ backend | [ ] |
| I04 | Chụp 1–12 ảnh; xem ảnh phóng to | Ảnh đọc được; watermark có booking, loại biên bản, giờ Việt Nam | [ ] |
| I05 | Không ảnh; quá 12 ảnh; ảnh quá 5MB; từ chối quyền camera | Không gửi dữ liệu sai; có thông báo và cách thử lại | [ ] |
| I06 | Có hư hại nhưng chưa mô tả; km âm/số lẻ; thiếu km cho xe có hạn mức | Chặn và yêu cầu dữ liệu hợp lệ | [ ] |
| I07 | Mất mạng khi gửi ảnh; bấm gửi liên tục | Giữ ảnh để thử lại, không lập hai biên bản | [ ] |
| I08 | Tải PDF check-in từ khách/chủ xe | Đúng mã đơn, km, nhiên liệu, ảnh liên kết, trạng thái xác nhận; tiếng Việt rõ | [ ] |

## 4. Trả xe / checkout và phụ phí

| ID | Thao tác | Kết quả mong đợi | KQ |
|---|---|---|---|
| O01 | Khách báo trả xe, chủ lập biên bản, khách xác nhận, chủ nhận lại | InProgress → Returning → Returned → Completed; không bỏ qua bước | [ ] |
| O02 | Giờ trả trước lúc bắt đầu thuê, ở tương lai hoặc sai định dạng | Chặn; Mobile nhập giờ Việt Nam rồi gửi UTC đúng | [ ] |
| O03 | Km trả thấp hơn km nhận, km âm/số lẻ/không hợp lệ | Chặn; không tạo phí từ số km sai | [ ] |
| O04 | Thuê 3 ngày, hạn mức 200 km/ngày; odo nhận 1.000, trả 1.600 | Đi 600 km, không vượt, phí 0đ | [ ] |
| O05 | Cùng cấu hình, odo trả 1.650 | Đi 650 km, vượt 50 km; phụ phí 250.000đ | [ ] |
| O06 | Chính sách 200 km/chuyến, thuê 3 ngày; đi 250 km | Hạn mức vẫn 200, vượt 50; không nhân hạn mức theo ngày | [ ] |
| O07 | Có trần phí 100.000đ; tiền vượt km tính ra cao hơn | Chỉ tính tối đa 100.000đ | [ ] |
| O08 | Chủ đổi cấu hình xe sau khi khách đã đặt | Đơn cũ dùng chính sách đã lưu, không dùng mức mới | [ ] |
| O09 | Đơn không có điều khoản vượt km | Không tự tạo/thu phí vượt km | [ ] |
| O10 | Trả đúng giờ, trong giờ miễn trễ và quá giờ miễn trễ | Phí trả trễ theo điều khoản lưu trong đơn; không tính khi được miễn | [ ] |
| O11 | Tick hư hại và nhập mô tả | Chỉ ghi nhận tình trạng; không tự sinh tiền bồi thường | [ ] |
| O12 | Sửa giờ/km checkout trước khi khách xác nhận | Bắt buộc lý do; tăng phiên bản, giữ ảnh gốc, thay phí cũ bằng phí mới | [ ] |
| O13 | Khách mở bản cũ, chủ sửa rồi khách bấm xác nhận bản cũ | Backend từ chối; tải bản mới và khách đồng ý lại, không tự thu | [ ] |
| O14 | Sửa checkout sau xác nhận hoặc đang có tranh chấp | Không cho sửa trực tiếp; theo luồng xử lý tranh chấp | [ ] |
| O15 | Khách xem hộp xác nhận trên web/Mobile | Có cả phí trễ + vượt km + km/hạn mức + số tiền còn lại trước đồng ý | [ ] |
| O16 | Khách chưa xác nhận | Phí ở trạng thái chờ, chưa trừ ví | [ ] |
| O17 | Khách xác nhận khi ví đủ tiền | Thu đúng các khoản được đồng ý một lần, ghi đã thu | [ ] |
| O18 | Khách xác nhận khi ví thiếu tiền; nạp rồi thử thu lại | Khoản chưa thu vẫn còn nợ; không ghi đã trả và không thu lại phần đã thu | [ ] |
| O19 | Chuyến Completed nhưng còn phụ phí chưa thu | Cả hai nền tảng vẫn hiển thị nợ | [ ] |
| O20 | Tải PDF checkout trước/sau sửa/xác nhận | Đúng phiên bản mới nhất và bảng tiền; tiếng Việt/giờ đúng; không tràn chữ | [ ] |
| O21 | Android/iOS lưu/chia sẻ PDF; hủy chia sẻ rồi tải lại | Mở được bảng chia sẻ, file đọc được, không lộ token trong tên/link | [ ] |

## 5. Hủy, tranh chấp, quyết toán và đối chiếu chéo

| ID | Thao tác | Kết quả mong đợi | KQ |
|---|---|---|---|
| X01 | Khách xem chính sách hủy trước khi xác nhận ở các mốc thời gian | Hiện đúng số hoàn/không hoàn và chính sách backend; hủy → Cancelled | [ ] |
| X02 | Chủ hủy trước nhận xe; khách báo chủ không giao xe đúng/sai điều kiện | Đúng quyền/thời điểm, đúng hoàn tiền; không cho thao tác trái trạng thái | [ ] |
| X03 | Khách không đồng ý checkout, mở tranh chấp và gửi bằng chứng | Tạo đúng đơn; xác nhận/thu phí bị chặn khi tranh chấp đang mở | [ ] |
| X04 | Nhân viên quyết định điều chỉnh phí trễ/hoàn chênh lệch | Cập nhật lịch sử và tiền thực thu/hoàn; không hoàn/thu hai lần | [ ] |
| X05 | Chủ giải ngân trước/sau thời gian giữ 48 giờ và khi có tranh chấp | Backend chặn ca chưa đủ điều kiện; đủ điều kiện giải ngân đúng một lần | [ ] |
| X06 | Hai bên đánh giá sau Completed; gửi lại | Đúng quyền, trạng thái và chống đánh giá trùng | [ ] |
| X07 | Chủ thao tác web, khách mở Mobile; đổi chiều và tải lại | Cùng trạng thái, hợp đồng, giờ, số km, phí, số dư và phiên bản | [ ] |
| X08 | Thoát app/mở lại, nền → foreground, mất mạng/tải lại | Tải được dữ liệu mới; không tự lặp thanh toán/xác nhận | [ ] |
| X09 | Dùng tài khoản không thuộc đơn thử xem biên bản/PDF/hợp đồng | Backend từ chối; không thấy dữ liệu của người khác | [ ] |

## Ví dụ đối chiếu tiền

Tổng tiền thuê 2.000.000đ; hệ thống đã thu cọc 500.000đ; phí trễ 20.000đ;
vượt km 250.000đ chưa thu → số còn theo dữ liệu hệ thống = **1.770.000đ**.
Nếu phí 270.000đ đã thu hết thì số còn theo dữ liệu hệ thống = **1.500.000đ**.
Không cộng phần phụ phí đã thu lần nữa.

Tiền khách trả trực tiếp chưa có ghi nhận riêng trong hệ thống: cần trừ theo
chứng từ khi hai bên chốt thực tế, không lấy số trên màn hình làm chứng nhận
rằng khoản trả trực tiếp chưa được trả.

## Bản cập nhật development vừa kéo về (kiểm thử hồi quy riêng)

- Báo cáo vi phạm: tạo báo cáo từ hồ sơ/xe/booking, gửi bằng chứng, staff xử lý,
  kiểm tra xe bị giữ không còn cho đặt/duyệt và hoạt động lại đúng quyết định.
- Rút tiền thủ công: yêu cầu rút, admin xem QR/thông tin ngân hàng, hoàn tất/từ chối,
  đúng số dư và lịch sử; không dùng giao dịch tiền thật để chạy hàng loạt.
- Đây là chức năng từ các commit development mới, tách với checklist phần booking
  vừa bổ sung để dễ xác định nguồn lỗi.
