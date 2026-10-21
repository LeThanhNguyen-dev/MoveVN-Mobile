import type { CmsAccordionItem, CmsSection } from "@/features/cms/types";

let sectionIdCounter = 0;

export function generateContentSectionId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `section-${++sectionIdCounter}`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Legacy Schema A: JSON array [{ id, title, content[] }]. Returns null when not applicable. */
function parseLegacyJsonArray(content: string): CmsSection[] | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const ids = new Set<string>();
    const sections: CmsSection[] = [];
    for (const raw of parsed) {
      if (typeof raw !== "object" || raw === null) return null;
      const item = raw as Record<string, unknown>;
      const title = asNonEmptyString(item.title) ?? asNonEmptyString(item.Title) ?? "";
      let id = asNonEmptyString(item.id) ?? asNonEmptyString(item.Id) ?? "";
      if (!id || ids.has(id)) id = generateContentSectionId(title);
      ids.add(id);
      const rawContent = Array.isArray(item.content)
        ? item.content
        : Array.isArray(item.Content)
          ? item.Content
          : null;
      if (rawContent === null) return null;
      const html = rawContent
        .map((part) => {
          if (typeof part !== "string") return "";
          if (part.startsWith("<")) return part;
          if (part.startsWith("–") || part.startsWith("•"))
            return `<ul><li>${escapeHtml(part.substring(2).trim())}</li></ul>`;
          if (part === "") return "<div><br></div>";
          return `<p>${escapeHtml(part)}</p>`;
        })
        .join("\n");
      sections.push({ kind: "richtext", id, title, html });
    }
    return sections;
  } catch {
    return null;
  }
}

/** V2 envelope: { version, sections: [{ id, type, title, content?, items? }] }. Returns null when not applicable. */
function parseV2Envelope(content: string): CmsSection[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const envelope = parsed as Record<string, unknown>;
  if (!Array.isArray(envelope.sections)) return null;
  const ids = new Set<string>();
  const sections: CmsSection[] = [];
  for (const raw of envelope.sections) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    const title = asNonEmptyString(item.title) ?? "";
    let id = asNonEmptyString(item.id) ?? "";
    if (!id || ids.has(id)) id = generateContentSectionId(title || "section");
    ids.add(id);
    const type = asNonEmptyString(item.type) ?? "richtext";
    if (type === "accordion") {
      const items: CmsAccordionItem[] = [];
      const itemIds = new Set<string>();
      if (Array.isArray(item.items)) {
        for (const rawChild of item.items) {
          if (typeof rawChild !== "object" || rawChild === null) continue;
          const child = rawChild as Record<string, unknown>;
          const childTitle = asNonEmptyString(child.title) ?? "";
          let childId = asNonEmptyString(child.id) ?? "";
          if (!childId || itemIds.has(childId)) childId = generateContentSectionId(childTitle || "item");
          itemIds.add(childId);
          items.push({ id: childId, title: childTitle, content: asNonEmptyString(child.content) ?? "" });
        }
      }
      sections.push({ kind: "accordion", id, title, items });
    } else if (type === "richtext") {
      sections.push({ kind: "richtext", id, title, html: asNonEmptyString(item.content) ?? "" });
    } else {
      sections.push({
        kind: "richtext",
        id,
        title,
        html: `<p>${escapeHtml(`Nội dung tạm thời chưa được hỗ trợ hiển thị (loại: ${type}).`)}</p>`,
      });
    }
  }
  return sections;
}

/**
 * Converts legacy policy lines (plain text, bullets, raw HTML fragments)
 * into a single HTML string for `CmsHtmlView`. Mirrors the web legacy
 * conversion in `parseLegacyJsonArray` plus the "-" bullet used on mobile.
 */
export function sectionLinesToHtml(lines: string[]): string {
  return lines
    .map((line) => {
      if (!line.trim()) return "";
      if (line.startsWith("<")) return line;
      if (line.startsWith("–") || line.startsWith("•")) {
        return `<ul><li>${escapeHtml(line.substring(2).trim())}</li></ul>`;
      }
      if (line.startsWith("-")) return `<ul><li>${escapeHtml(line.substring(1).trim())}</li></ul>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Normalize every supported CMS content format into a common representation.
 * Never throws: invalid content falls back to raw HTML.
 * Mirrors MoveVN-FrontEnd `parseCmsContent` (V2 envelope, legacy array, HTML).
 */
export function parseCmsSections(content: string): CmsSection[] {
  if (!content) return [];
  const v2 = parseV2Envelope(content);
  if (v2) return v2;
  const legacy = parseLegacyJsonArray(content);
  if (legacy) return legacy;
  return content.trim() ? [{ kind: "richtext", id: "page", title: "", html: content }] : [];
}
