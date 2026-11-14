import { describe, expect, it } from "vitest";
import { buildTrackingMapHtml } from "@/features/gps/components/trackingMapHtml";

describe("tracking map html", () => {
  const html = buildTrackingMapHtml({ latitude: 16.03249, longitude: 108.21091 }, "#7c3aed", "#ffffff");

  it("exposes the rewind helpers used by the coordinate log", () => {
    expect(html).toContain("window.showPoint=");
    expect(html).toContain("window.clearPoint=");
    expect(html).toContain("inspect-pin");
    expect(html).toContain("window.setRoute=function(points,fit)");
  });

  it("only fits the route bounds when explicitly requested", () => {
    expect(html).toContain("var doFit=fit!==false;");
  });
});