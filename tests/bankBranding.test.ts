import { describe, expect, it } from "vitest";
import { findVietnamBank, VIETNAM_BANKS } from "@/features/wallets/data/banks";

describe("wallet bank branding", () => {
  it("maps saved bank BINs to their display names and logos", () => {
    expect(findVietnamBank("970436")).toMatchObject({
      shortName: "Vietcombank",
      logo: "https://cdn.vietqr.io/img/VCB.png",
    });
    expect(findVietnamBank("970422")?.logo).toBe("https://cdn.vietqr.io/img/MB.png");
  });

  it("uses legacy bank names only when no BIN is available", () => {
    expect(findVietnamBank(undefined, "MBBank")?.bin).toBe("970422");
    expect(findVietnamBank("999999", "Vietcombank")).toBeUndefined();
  });

  it("provides a logo URL for every supported bank", () => {
    expect(VIETNAM_BANKS.length).toBeGreaterThan(0);
    expect(VIETNAM_BANKS.every((bank) =>
      typeof bank.logo === "string" && bank.logo.startsWith("https://cdn.vietqr.io/img/"),
    )).toBe(true);
  });
});
