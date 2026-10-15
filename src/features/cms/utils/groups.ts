import type { CmsPageNavigationItem } from "@/features/cms/types";

export type PolicyGroupKey = "POLICY" | "GUIDE";

export type PolicyGroup = {
  key: PolicyGroupKey;
  /** Group titles reuse the web hero titles verbatim (PolicyPage / GuidePage). */
  title: string;
  items: CmsPageNavigationItem[];
};

const GROUP_TITLES: Record<PolicyGroupKey, string> = {
  POLICY: "Chính sách & Quy định",
  GUIDE: "Hướng dẫn & Quy chế",
};

const GROUP_ORDER: PolicyGroupKey[] = ["POLICY", "GUIDE"];

function groupKeyOf(item: CmsPageNavigationItem): PolicyGroupKey | null {
  // FAQ topics are served by the Help Center flow, never by the policy flow.
  if (item.contentType === "FAQ") return null;
  // Legacy pages without contentType behave like POLICY (mirrors web splitCmsNav).
  if (!item.contentType || item.contentType === "POLICY") return "POLICY";
  if (item.contentType === "GUIDE") return "GUIDE";
  return null;
}

/**
 * Splits CMS navigation items into policy groups derived from real data.
 * Only groups that actually contain documents are returned.
 */
export function groupPolicyItems(items: CmsPageNavigationItem[]): PolicyGroup[] {
  const buckets = new Map<PolicyGroupKey, CmsPageNavigationItem[]>();
  for (const item of items) {
    const key = groupKeyOf(item);
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }
  return GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    title: GROUP_TITLES[key],
    items: buckets.get(key) ?? [],
  }));
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Client-side filter: the backend exposes no CMS search endpoint. */
export function filterPolicyItems(items: CmsPageNavigationItem[], query: string): CmsPageNavigationItem[] {
  const keyword = normalizeSearchText(query.trim());
  if (!keyword) return items;
  return items.filter((item) =>
    normalizeSearchText(`${item.title} ${item.description ?? ""}`).includes(keyword),
  );
}

export function findGroupForSlug(groups: PolicyGroup[], slug: string): PolicyGroup | null {
  const target = slug.trim().toLowerCase();
  return groups.find((group) => group.items.some((item) => item.slug.toLowerCase() === target)) ?? null;
}
