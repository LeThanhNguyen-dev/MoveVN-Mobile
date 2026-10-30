# Danh sách chuyến đi & đơn thuê — UI plan

Tham chiếu concept: `docs/design/trip-booking-list-mockup.html`.

## Mục tiêu

- Danh sách tự nhóm theo giai đoạn để việc gấp nằm trên cùng, không cần đổi API.
- Mỗi thẻ chỉ một hành động chính; hành động chỉ điều hướng tới màn chi tiết.
- Địa điểm nhận xe dài: đưa xuống **dưới dòng thời gian**, chữ **9.5px**, tối đa 2 dòng.

## Thay đổi theo file

| File | Nội dung |
| --- | --- |
| `src/features/booking/components/BookingCard.tsx` | Card radius 24, ảnh 86×86, pill trạng thái, dòng thời gian, địa điểm dưới thời gian, tiến độ, footer giá + 1 CTA. |
| `src/features/booking/components/BookingStatusBadge.tsx` | Pill nhỏ hơn, có viền theo tông trạng thái, bổ sung `Confirmed`. |
| `src/features/booking/components/BookingCardSkeleton.tsx` | Skeleton khớp layout card mới. |
| `src/features/booking/components/BookingListShell.tsx` | Header, dải nhắc việc, 4 chip + sheet 11 trạng thái, tìm kiếm, SectionList nhóm giai đoạn, empty/error/load-more. |
| `src/features/booking/screens/TripListScreen.tsx` | Chỉ còn state + fetch + shell (khách). |
| `src/features/booking/screens/OwnerBookingListScreen.tsx` | Chỉ còn state + fetch + shell (chủ xe). |

## Nhóm giai đoạn

- Khách: Đang diễn ra → Sắp tới → Đã kết thúc.
- Chủ xe: Cần xử lý (Pending) → Sắp tới → Đang diễn ra → Đã kết thúc.

Nhóm tính client-side từ `status` + ngày của item đã tải. Server vẫn lọc **một** trạng thái như cũ.

## CTA trên thẻ (chỉ navigate)

- Khách: Xem đơn · Thanh toán cọc · Trả xe · Bàn giao trả · Xem biên bản · Xem lại.
- Chủ xe: Xử lý đơn · Theo dõi · Nhận xe · Xem biên bản · Xem lại.

Không thêm logic duyệt/từ chối/thanh toán vào list; các thao tác đó vẫn nằm ở màn chi tiết.

## Giữ nguyên

- API/DTO, phân trang, refresh, tìm kiếm theo từ khóa/ngày.
- Câu chữ empty/error hiện có.
- `accessibilityLabel`, `accessibilityRole`, `testID` sẵn có.
