import { describe, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
}));
vi.mock("lucide-react-native", () => ({ ArrowLeft: "ArrowLeft", ChevronDown: "ChevronDown" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/features/cms/services/cmsService", () => ({
  getCmsPageBySlug: vi.fn(),
}));

import { htmlToText, parsePolicySections } from "@/features/cms/screens/PolicyDetailScreen";

// Đúng shape dữ liệu đang lưu trong DB (làm trang /policies/* in nguyên JSON).
const OBJECT_FORMAT = JSON.stringify({
  version: 1,
  sections: [
    {
      id: "gioi-thieu",
      type: "richtext",
      title: "Giới thiệu",
      content: "\nChủ xe là người đưa xe của mình lên MoveVN để cho thuê.\n\n",
    },
    {
      id: "bat-dau",
      type: "accordion",
      title: "Bắt đầu làm chủ xe",
      items: [
        { id: "can-gi", title: "Tôi cần chuẩn bị gì?", content: "\nBạn cần tài khoản MoveVN.\n" },
        { id: "duyet-ho-so", title: "Hồ sơ duyệt thế nào?", content: "\nHệ thống tự động phê duyệt.\n" },
      ],
    },
  ],
});

const LEGACY_ARRAY = JSON.stringify([
  { id: "a", title: "Mục A", content: ["Dòng 1", "– gạch đầu dòng"] },
]);

describe("parsePolicySections", () => {
  it("renders the new {version,sections} format instead of raw JSON", () => {
    const sections = parsePolicySections(OBJECT_FORMAT);
    expect(sections).not.toBeNull();
    expect(sections).toHaveLength(2);
    expect(sections![0]!.title).toBe("Giới thiệu");
    expect(sections![0]!.content).toEqual(["Chủ xe là người đưa xe của mình lên MoveVN để cho thuê."]);
    expect(sections![1]!.items).toHaveLength(2);
    expect(sections![1]!.items![0]!.title).toBe("Tôi cần chuẩn bị gì?");
  });

  it("keeps supporting the legacy array format", () => {
    const sections = parsePolicySections(LEGACY_ARRAY);
    expect(sections).not.toBeNull();
    expect(sections).toHaveLength(1);
    expect(sections![0]!.content).toEqual(["Dòng 1", "– gạch đầu dòng"]);
  });

  it("returns null for plain HTML so it renders as HTML", () => {
    expect(parsePolicySections("<p>Xin chào</p>")).toBeNull();
    expect(htmlToText("<p>Xin chào</p>")).toBe("Xin chào");
  });
});
