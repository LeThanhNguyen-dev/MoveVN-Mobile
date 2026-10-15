import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "@/features/cms/utils/sanitize";
import { sectionLinesToHtml } from "@/features/cms/utils/content";

describe("cms sanitize", () => {
  it("keeps https images and links like the web DOMPurify policy", () => {
    const html = sanitizeCmsHtml(
      '<p>Hi</p><img src="https://res.cloudinary.com/x/a.jpg" alt="a" />'
      + '<a href="https://move.vn/p">x</a><a href="mailto:support@movevn.com">m</a>',
    );
    expect(html).toContain('<img src="https://res.cloudinary.com/x/a.jpg"');
    expect(html).toContain('<a href="https://move.vn/p">');
    expect(html).toContain('<a href="mailto:support@movevn.com">');
  });

  it("strips scripts, iframes, event handlers and javascript: targets", () => {
    const html = sanitizeCmsHtml(
      '<p onclick="evil()">t</p><script>alert(1)</script>'
      + '<iframe src="https://evil.test"></iframe>'
      + '<img src="https://x.test/a.png" onerror="evil()" />'
      + '<a href="javascript:alert(1)">x</a><p style="color:red">y</p>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("style=");
    expect(html).toContain("https://x.test/a.png");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeCmsHtml("")).toBe("");
  });
});

describe("section lines to html", () => {
  it("keeps raw html lines and escapes plain text", () => {
    const html = sectionLinesToHtml([
      "<p>Raw <b>html</b></p>",
      "<img src=\"https://x.test/a.png\" />",
      "Plain <text>",
      "- bullet",
    ]);
    expect(html).toContain("<p>Raw <b>html</b></p>");
    expect(html).toContain("<img");
    expect(html).toContain("<p>Plain &lt;text&gt;</p>");
    expect(html).toContain("<li>bullet</li>");
  });
});
