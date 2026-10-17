import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), share: vi.fn(), available: vi.fn(), write: vi.fn(), remove: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/services/apiClient", () => ({ apiClient: { request: mocks.request } }));
vi.mock("expo-file-system", () => ({ Paths: { cache: "file:///cache" }, File: class {
  uri = "file:///cache/report.pdf"; exists = true; write = mocks.write; delete = mocks.remove;
} }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
import { downloadPdf } from "@/utils/pdfDownload";
beforeEach(() => { vi.clearAllMocks(); mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined); });
it("downloads through the authenticated API and shares an actual PDF then removes the temporary file", async () => {
  const data = new TextEncoder().encode("%PDF-1.7\n%%EOF").buffer;
  mocks.request.mockResolvedValue({ data });
  await downloadPdf("/api/bookings/51/inspection-reports/60/pdf", "MoveVN-51-CheckOut-v2.pdf");
  expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/api/bookings/51/inspection-reports/60/pdf", responseType: "arraybuffer", method: "get" }));
  expect(mocks.write).toHaveBeenCalledWith(new Uint8Array(data));
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/report.pdf", expect.objectContaining({ mimeType: "application/pdf" }));
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
it("does not share an API error disguised as a downloaded file", async () => {
  mocks.request.mockResolvedValue({ data: new TextEncoder().encode('{"error":"unauthorized"}').buffer });
  await expect(downloadPdf("/api/contracts/70/pdf/grant", "contract.pdf", "post")).rejects.toThrow("PDF hợp lệ");
  expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
});
it("cleans up the file when the native share fails", async () => {
  mocks.request.mockResolvedValue({ data: new TextEncoder().encode("%PDF-1.7").buffer }); mocks.share.mockRejectedValue(new Error("share failed"));
  await expect(downloadPdf("/api/contracts/70/pdf/grant", "contract.pdf", "post")).rejects.toThrow("share failed");
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
