import { create } from "zustand";
import { getItemAsync, setItemAsync } from "@/services/deviceStorage";

/** Tour hướng dẫn đặt xe 11 bước: tìm xe → chọn ngày → danh sách xe → chi tiết xe
 *  → ngày thuê → điểm nhận xe → voucher → bấm đặt cọc → quét QR PayOS
 *  → tab Chuyến đi → chi tiết chuyến/bàn giao xe.
 *  Bước 1-2 chạy trên thẻ tìm kiếm ở Trang chủ; các bước sau mỗi màn chỉ hiện
 *  khi khách tới đúng màn hình, nên tour chờ sẵn cho tới lúc đó. */
export type BookingTourStep =
  | "search"
  | "dates"
  | "vehicleList"
  | "vehicleDetail"
  | "bookingDates"
  | "bookingAddress"
  | "bookingVoucher"
  | "createBooking"
  | "payment"
  | "trip"
  | "tripDetail";

export const BOOKING_TOUR_STEPS: readonly BookingTourStep[] = [
  "search",
  "dates",
  "vehicleList",
  "vehicleDetail",
  "bookingDates",
  "bookingAddress",
  "bookingVoucher",
  "createBooking",
  "payment",
  "trip",
  "tripDetail",
];

export function bookingTourSeenKey(userId: number): string {
  return `movevn.bookingTour.seen.${userId}`;
}

type BookingTourState = {
  userId: number | null;
  step: BookingTourStep | null;
  /** Bắt đầu lại từ bước 1 (nút "Hướng dẫn đặt xe" ở Trang chủ). */
  start: (userId: number) => void;
  /** Chỉ tự chạy một lần cho mỗi tài khoản trên thiết bị này. */
  autoStart: (userId: number) => Promise<void>;
  next: () => void;
  skip: () => void;
};

async function markSeen(userId: number | null) {
  if (userId === null) return;
  try {
    await setItemAsync(bookingTourSeenKey(userId), "1");
  } catch {
    // Storage bị chặn: tour có thể tự chạy lại lần mở app sau, không nghiêm trọng.
  }
}

export const useBookingTour = create<BookingTourState>((set, get) => ({
  userId: null,
  step: null,
  start: (userId) => {
    set({ userId, step: BOOKING_TOUR_STEPS[0] });
  },
  autoStart: async (userId) => {
    const current = get();
    // Đổi tài khoản trên cùng phiên app: bỏ tiến trình tour của người trước.
    if (current.userId !== null && current.userId !== userId && current.step !== null) {
      set({ step: null });
    }
    if (get().step !== null) return;
    set({ userId });
    try {
      const seen = await getItemAsync(bookingTourSeenKey(userId));
      if (seen === "1" || get().step !== null) return;
      set({ step: BOOKING_TOUR_STEPS[0] });
    } catch {
      // Không đọc được storage: bỏ qua tour để không chặn màn hình.
    }
  },
  next: () => {
    const current = get().step;
    const index = current ? BOOKING_TOUR_STEPS.indexOf(current) : -1;
    const following = BOOKING_TOUR_STEPS[index + 1] ?? null;
    set({ step: following });
    if (following === null) void markSeen(get().userId);
  },
  skip: () => {
    set({ step: null });
    void markSeen(get().userId);
  },
}));
