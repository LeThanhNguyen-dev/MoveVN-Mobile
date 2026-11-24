import React from "react";
import type { RefObject } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewInstance } from "react-native";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/services/deviceStorage", () => ({
  getItemAsync: vi.fn(async (key: string) => storage.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    storage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
}));

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: "AbsoluteFill", absoluteFillObject: {} },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@/theme/useTheme", async () => {
  const { themes } = await import("@/theme/tokens");
  return { useTheme: () => ({ theme: themes.light }) };
});

import { BOOKING_TOUR_STEPS, bookingTourSeenKey, useBookingTour } from "@/features/onboarding/bookingTour";
import TourOverlay from "@/features/onboarding/components/TourOverlay";

function reset() {
  storage.clear();
  useBookingTour.setState({ userId: null, step: null });
}

describe("booking tour store", () => {
  beforeEach(reset);

  it("autoStart mở bước 1 khi tài khoản chưa xem tour", async () => {
    await act(async () => {
      await useBookingTour.getState().autoStart(7);
    });
    expect(useBookingTour.getState().step).toBe("search");
    expect(useBookingTour.getState().userId).toBe(7);
  });

  it("autoStart bỏ qua khi tài khoản đã xem tour trên máy này", async () => {
    storage.set(bookingTourSeenKey(7), "1");
    await act(async () => {
      await useBookingTour.getState().autoStart(7);
    });
    expect(useBookingTour.getState().step).toBeNull();
  });

  it("next đi qua đủ 11 bước rồi lưu cờ đã xem", async () => {
    act(() => {
      useBookingTour.getState().start(7);
    });
    expect(BOOKING_TOUR_STEPS).toEqual([
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
    ]);
    for (const step of BOOKING_TOUR_STEPS.slice(1)) {
      act(() => {
        useBookingTour.getState().next();
      });
      expect(useBookingTour.getState().step).toBe(step);
    }
    act(() => {
      useBookingTour.getState().next();
    });
    expect(useBookingTour.getState().step).toBeNull();
    expect(storage.get(bookingTourSeenKey(7))).toBe("1");
  });

  it("skip đóng tour và lưu cờ đã xem", () => {
    act(() => {
      useBookingTour.getState().start(7);
      useBookingTour.getState().skip();
    });
    expect(useBookingTour.getState().step).toBeNull();
    expect(storage.get(bookingTourSeenKey(7))).toBe("1");
  });

  it("start chạy lại được từ bước 1 dù đã xem tour", () => {
    storage.set(bookingTourSeenKey(7), "1");
    act(() => {
      useBookingTour.getState().start(7);
    });
    expect(useBookingTour.getState().step).toBe("search");
  });
});

describe("TourOverlay", () => {
  let tree: ReactTestRenderer | undefined;

  beforeEach(reset);

  const anchorRef = {
    current: {
      measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) =>
        cb(20, 120, 350, 220),
    },
  } as unknown as RefObject<ViewInstance | null>;

  const text = () => JSON.stringify(tree!.toJSON());
  const pressByText = (label: string) =>
    tree!.root.findAll(
      (n) =>
        (n.type as unknown) === "Pressable" &&
        n.findAll(
          (c) =>
            (c.type as unknown) === "Text" &&
            c.children.filter((x) => typeof x === "string").join("") === label,
        ).length > 0,
    )[0];

  async function render(step: (typeof BOOKING_TOUR_STEPS)[number], onNext?: () => void) {
    await act(async () => {
      tree = create(React.createElement(TourOverlay, { step, anchorRef, onNext }));
    });
  }

  it("không render khi store ở bước khác", async () => {
    useBookingTour.setState({ userId: 7, step: "dates" });
    await render("search");
    expect(tree!.toJSON()).toBeNull();
  });

  it("hiện badge + nội dung bước và nút Tiếp tục chuyển sang bước sau", async () => {
    useBookingTour.setState({ userId: 7, step: "search" });
    await render("search");
    expect(text()).toContain("Bước 1/11");
    expect(text()).toContain("Tìm xe phù hợp");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("dates");
  });

  it("bước thanh toán vẫn là Tiếp tục và mở được bước tab Chuyến đi", async () => {
    useBookingTour.setState({ userId: 7, step: "payment" });
    await render("payment");
    expect(text()).toContain("Bước 9/11");
    expect(text()).not.toContain("Xong");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("trip");
  });

  it("bước danh sách xe gọi onNext thay cho next mặc định", async () => {
    useBookingTour.setState({ userId: 7, step: "vehicleList" });
    const onNext = vi.fn();
    await render("vehicleList", onNext);
    expect(text()).toContain("Bước 3/11");
    expect(text()).toContain("Chọn xe phù hợp");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(useBookingTour.getState().step).toBe("vehicleList");
  });

  it("bước chi tiết xe hiện nội dung nút Đặt xe", async () => {
    useBookingTour.setState({ userId: 7, step: "vehicleDetail" });
    await render("vehicleDetail");
    expect(text()).toContain("Bước 4/11");
    expect(text()).toContain("Đặt xe");
  });

  it("3 bước trang đặt xe lần lượt chỉ ngày, địa chỉ, voucher rồi sang đặt cọc", async () => {
    useBookingTour.setState({ userId: 7, step: "bookingDates" });
    await render("bookingDates");
    expect(text()).toContain("Bước 5/11");
    expect(text()).toContain("Chọn ngày nhận – trả xe");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("bookingAddress");

    await render("bookingAddress");
    expect(text()).toContain("Bước 6/11");
    expect(text()).toContain("Điền điểm nhận xe");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("bookingVoucher");

    await render("bookingVoucher");
    expect(text()).toContain("Bước 7/11");
    expect(text()).toContain("Áp voucher / mã giảm giá");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("createBooking");
  });

  it("bước đặt cọc hiện 8/11 và Tiếp tục sang bước thanh toán", async () => {
    useBookingTour.setState({ userId: 7, step: "createBooking" });
    await render("createBooking");
    expect(text()).toContain("Bước 8/11");
    expect(text()).toContain("Đặt cọc để tạo đơn");
    await act(async () => {
      pressByText("Tiếp tục")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBe("payment");
  });

  it("bước tab Chuyến đi hiện đúng thứ tự 10/11", async () => {
    useBookingTour.setState({ userId: 7, step: "trip" });
    await render("trip");
    expect(text()).toContain("Bước 10/11");
    expect(text()).toContain("Tab Chuyến đi");
  });

  it("bước cuối hiện nút Xong và kết thúc tour", async () => {
    useBookingTour.setState({ userId: 7, step: "tripDetail" });
    await render("tripDetail");
    expect(text()).toContain("Bước 11/11");
    expect(text()).toContain("Xong");
    await act(async () => {
      pressByText("Xong")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBeNull();
    expect(storage.get(bookingTourSeenKey(7))).toBe("1");
  });

  it("Bỏ qua đóng tour", async () => {
    useBookingTour.setState({ userId: 7, step: "search" });
    await render("search");
    await act(async () => {
      pressByText("Bỏ qua")!.props.onPress();
    });
    expect(useBookingTour.getState().step).toBeNull();
  });

  afterEach(async () => {
    if (tree) await act(async () => tree!.unmount());
    tree = undefined;
  });
});
