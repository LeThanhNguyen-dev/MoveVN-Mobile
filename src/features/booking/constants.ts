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
  { key: "Confirmed", label: "Đã xác nhận" },
  { key: "InProgress", label: "Đang thuê" },
  { key: "Returning", label: "Đang trả" },
  { key: "Returned", label: "Đã trả, chờ nhận" },
  { key: "Completed", label: "Hoàn thành" },
  { key: "Cancelled", label: "Đã hủy" },
  { key: "Rejected", label: "Đã từ chối" },
];

export const BOOKING_PAGE_SIZE = 10;
