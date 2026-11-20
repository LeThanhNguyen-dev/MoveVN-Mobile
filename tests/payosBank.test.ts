import { describe, expect, it } from "vitest";

import { payosBankLabel } from "@/features/payments/payosBank";

describe("payosBankLabel", () => {
  it("maps known BINs to full bank names", () => {
    expect(payosBankLabel("970418")).toContain("BIDV");
    expect(payosBankLabel("970422")).toContain("MB");
    expect(payosBankLabel("970436")).toContain("Vietcombank");
  });

  it("falls back to PayOS for unknown or missing BIN", () => {
    expect(payosBankLabel("999999")).toBe("PayOS");
    expect(payosBankLabel(null)).toBe("PayOS");
    expect(payosBankLabel(undefined)).toBe("PayOS");
  });
});
