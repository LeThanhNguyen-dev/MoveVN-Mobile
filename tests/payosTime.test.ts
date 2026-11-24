import { describe, expect, it } from "vitest";
import { formatCountdown, payosExpirySeconds } from "@/features/payments/payosTime";

describe("payosExpirySeconds", () => {
  const now = 1_800_000_000_000; // ms

  it("tính số giây còn lại tới expiredAt", () => {
    expect(payosExpirySeconds(1_800_000_300, now)).toBe(300);
  });

  it("về 0 khi đã quá hạn", () => {
    expect(payosExpirySeconds(1_799_999_000, now)).toBe(0);
  });

  it("fallback 30 phút khi không có expiredAt", () => {
    expect(payosExpirySeconds(null, now)).toBe(1800);
    expect(payosExpirySeconds(undefined, now)).toBe(1800);
    expect(payosExpirySeconds(0, now)).toBe(1800);
  });
});

describe("formatCountdown", () => {
  it("định dạng mm:ss", () => {
    expect(formatCountdown(1800)).toBe("30:00");
    expect(formatCountdown(125)).toBe("02:05");
    expect(formatCountdown(59)).toBe("00:59");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});
