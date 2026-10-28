import { describe, expect, it } from "vitest";
import {
  formatCheckoutDate,
  formatCheckoutMeta,
  fromRentalSheetValue,
  toRentalSheetValue,
} from "@/features/booking/utils/checkoutFormat";

describe("checkout formatting", () => {
  it("shows a placeholder for empty or invalid dates", () => {
    expect(formatCheckoutDate("")).toBe("Chưa chọn");
    expect(formatCheckoutDate("not-a-date")).toBe("Chưa chọn");
    expect(formatCheckoutMeta("")).toBe("Chưa chọn giờ");
  });

  it("omits the year for dates in the current year", () => {
    const year = new Date().getFullYear();
    expect(formatCheckoutDate(`${year}-03-05T12:00`)).toBe("05/03");
  });

  it("adds the year for dates outside the current year", () => {
    const year = new Date().getFullYear() + 1;
    expect(formatCheckoutDate(`${year}-03-05T12:00`)).toBe(`05/03/${year}`);
  });

  it("formats weekday and hour metadata", () => {
    // 05/03/2026 là thứ Năm.
    expect(formatCheckoutMeta("2026-03-05T09:30")).toBe("T5 · 09:30");
  });
});

describe("rental sheet value conversion", () => {
  it("returns an empty string for empty or invalid input", () => {
    expect(toRentalSheetValue("")).toBe("");
    expect(toRentalSheetValue("not-a-date")).toBe("");
    expect(fromRentalSheetValue("")).toBe("");
    expect(fromRentalSheetValue("not-a-date")).toBe("");
  });

  it("keeps the local date and hour when converting ISO to a sheet value", () => {
    const iso = new Date(2026, 2, 5, 9, 30).toISOString();
    expect(toRentalSheetValue(iso)).toBe("2026-03-05T09:30");
  });

  it("does not shift date-only values across the UTC boundary", () => {
    expect(toRentalSheetValue("2026-03-05")).toBe("2026-03-05T00:00");
  });

  it("converts sheet values to ISO and back without losing the minute", () => {
    const sheet = "2026-03-05T09:30";
    const iso = fromRentalSheetValue(sheet);
    expect(iso).toBe(new Date(2026, 2, 5, 9, 30).toISOString());
    expect(toRentalSheetValue(iso)).toBe(sheet);
  });
});
