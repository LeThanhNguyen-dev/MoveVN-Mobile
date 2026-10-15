/** Filter trạng thái dùng chung cho TripList (customer) và OwnerBookingList (owner). */
export interface BookingStatusFilter {
  key: string;
  label: string;
}

export const BOOKING_STATUS_FILTERS: BookingStatusFilter[] = [
  { key: "", label: "Tất cả" },
  { key: "Pending", label: "Chờ duyệt" },
  { key: "Approved", label: "Đã duyệt" },
  { key: "DepositPaid", label: "Đã cọc" },
  { key: "InProgress", label: "Đang thuê" },
  { key: "Returning", label: "Đang trả" },
  { key: "Completed", label: "Hoàn thành" },
  { key: "Cancelled", label: "Đã hủy" },
];

export const BOOKING_PAGE_SIZE = 10;
