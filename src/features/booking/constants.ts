import i18n from "@/i18n";

/** Filter trạng thái dùng chung cho TripList (customer) và OwnerBookingList (owner). */
export interface BookingStatusFilter {
  key: string;
  label: string;
}

const FILTER_LABEL_KEYS: { key: string; labelKey: string }[] = [
  { key: "", labelKey: "booking:status.all" },
  { key: "Pending", labelKey: "booking:status.pending" },
  { key: "Approved", labelKey: "booking:status.approved" },
  { key: "DepositPaid", labelKey: "mobile:checkout.filters.depositPaid" },
  { key: "Confirmed", labelKey: "booking:status.confirmed" },
  { key: "InProgress", labelKey: "mobile:checkout.filters.inProgress" },
  { key: "Returning", labelKey: "mobile:checkout.filters.returning" },
  { key: "Returned", labelKey: "mobile:checkout.filters.returned" },
  { key: "Completed", labelKey: "booking:status.completed" },
  { key: "Cancelled", labelKey: "booking:status.cancelled" },
  { key: "Rejected", labelKey: "booking:status.rejected" },
];

// Getters resolve the translation on every read so filters follow the active language.
export const BOOKING_STATUS_FILTERS: BookingStatusFilter[] = FILTER_LABEL_KEYS.map(({ key, labelKey }) => ({
  key,
  get label() {
    return i18n.t(labelKey);
  },
}));

export const BOOKING_PAGE_SIZE = 10;
