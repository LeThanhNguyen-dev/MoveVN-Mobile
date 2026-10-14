import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("@/config/apiConfig", () => ({ getConfiguredApiBaseUrl: () => "http://pin.test" }));

import { isValidPinCode } from "@/features/userSecurity/pinService";

describe("isValidPinCode", () => {
  it("accepts exactly 6 digits", () => {
    expect(isValidPinCode("123456")).toBe(true);
    expect(isValidPinCode(" 123456 ")).toBe(true);
  });

  it("rejects wrong shapes", () => {
    expect(isValidPinCode("12345")).toBe(false);
    expect(isValidPinCode("1234567")).toBe(false);
    expect(isValidPinCode("12345a")).toBe(false);
    expect(isValidPinCode("")).toBe(false);
  });
});
