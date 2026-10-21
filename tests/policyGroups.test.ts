import { describe, expect, it } from "vitest";
import {
  filterPolicyItems,
  findGroupForSlug,
  groupPolicyItems,
} from "@/features/cms/utils/groups";
import type { CmsPageNavigationItem } from "@/features/cms/types";

function item(slug: string, title: string, contentType: string | null, description: string | null = null): CmsPageNavigationItem {
  return { slug, title, contentType, category: null, description };
}

describe("policy groups", () => {
  it("groups POLICY and GUIDE, excludes FAQ, maps legacy null to POLICY", () => {
    const groups = groupPolicyItems([
      item("privacy-policy", "Chính sách bảo mật", "POLICY"),
      item("terms-of-service", "Điều khoản sử dụng", "POLICY"),
      item("legacy-page", "Trang cũ", null),
      item("dat-xe", "Đặt xe", "GUIDE"),
      item("bat-dau", "Bắt đầu", "FAQ"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["POLICY", "GUIDE"]);
    const policyGroup = groups[0];
    const guideGroup = groups[1];
    expect(policyGroup?.title).toBe("Chính sách & Quy định");
    expect(policyGroup?.items.map((i) => i.slug)).toEqual(["privacy-policy", "terms-of-service", "legacy-page"]);
    expect(guideGroup?.title).toBe("Hướng dẫn & Quy chế");
  });

  it("omits empty groups", () => {
    const groups = groupPolicyItems([item("bat-dau", "Bắt đầu", "FAQ")]);
    expect(groups).toEqual([]);
  });

  it("finds the group owning a slug", () => {
    const groups = groupPolicyItems([
      item("privacy-policy", "Chính sách bảo mật", "POLICY"),
      item("dat-xe", "Đặt xe", "GUIDE"),
    ]);
    expect(findGroupForSlug(groups, "DAT-XE")?.key).toBe("GUIDE");
    expect(findGroupForSlug(groups, "missing")).toBeNull();
  });
});

describe("policy search filter", () => {
  const items = [
    item("privacy-policy", "Chính sách bảo mật", "POLICY", "Bảo vệ dữ liệu cá nhân"),
    item("terms-of-service", "Điều khoản sử dụng", "POLICY"),
  ];

  it("matches accent-insensitively across title and description", () => {
    expect(filterPolicyItems(items, "bao mat").map((i) => i.slug)).toEqual(["privacy-policy"]);
    expect(filterPolicyItems(items, "ĐIỀU KHOẢN").map((i) => i.slug)).toEqual(["terms-of-service"]);
  });

  it("returns everything for blank queries", () => {
    expect(filterPolicyItems(items, "   ")).toHaveLength(2);
  });
});
