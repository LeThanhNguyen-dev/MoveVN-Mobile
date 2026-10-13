import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

import { txTypeLabel, withdrawalStatusLabel } from "@/features/wallets/utils/format";

describe("wallet labels", () => {
  it("labels known types and falls back to raw", () => {
    expect(txTypeLabel("TopUp")).toBe("Nạp tiền");
    expect(txTypeLabel("Withdrawal")).toBe("Rút tiền");
    expect(txTypeLabel("SomethingNew")).toBe("SomethingNew");
  });

  it("labels withdrawal statuses", () => {
    expect(withdrawalStatusLabel("Pending")).toBe("Chờ duyệt");
    expect(withdrawalStatusLabel("Completed")).toBe("Hoàn tất");
    expect(withdrawalStatusLabel("Weird")).toBe("Weird");
  });
});
