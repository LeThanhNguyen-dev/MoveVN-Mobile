const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "hr",
  "figure",
  "figcaption",
]);

const DANGEROUS_BLOCKS = [
  "script",
  "iframe",
  "object",
  "embed",
  "style",
  "form",
  "video",
  "audio",
  "input",
  "button",
  "select",
  "textarea",
  "canvas",
  "noscript",
];

/**
 * Lightweight port of MoveVN-FrontEnd `sanitizeCmsHtml` (DOMPurify-based).
 * Allows normal rich text including CMS-uploaded images; strips scripts,
 * iframes, style blocks, event-handler/style/data attributes and
 * non-http(s)/mailto/tel link targets. Disallowed tags are unwrapped
 * (inner content kept), dangerous blocks are removed entirely.
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html) return "";
  let out = html.replace(/<!--[\s\S]*?-->/g, "");

  for (const tag of DANGEROUS_BLOCKS) {
    out = out.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`<\\/?${tag}[^>]*\\/?>`, "gi"), "");
  }

  // Event handlers, inline styles, data-* attributes.
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+data-[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Only safe link/image targets survive (same policy as web).
  out = out.replace(
    /\s+(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_match, attr: string, _quoted: string, doubleQuoted: string, singleQuoted: string, bare: string) => {
      const url = String(doubleQuoted ?? singleQuoted ?? bare ?? "").trim();
      if (/^(https?:|mailto:|tel:)/i.test(url)) return ` ${attr}="${url}"`;
      if (/^\/\//.test(url)) return ` ${attr}="https:${url}"`;
      return "";
    },
  );

  // Unwrap any tag outside the allowlist, keeping its inner content.
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\/?>/g, (match, tag: string) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? match : "",
  );

  return out;
}
