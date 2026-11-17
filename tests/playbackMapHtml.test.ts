import { describe, expect, it } from "vitest";
import { buildPlaybackMapHtml } from "@/features/gps/components/playbackMapHtml";

describe("playback map html", () => {
  const html = buildPlaybackMapHtml({
    brand: "#7c3aed",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#0f172a",
    pending: "#e2e8f0",
    outline: "#ffffff",
  });

  it("exposes the helpers the playback screen injects", () => {
    expect(html).toContain("window.setPath=");
    expect(html).toContain("window.setProgress=");
    expect(html).toContain("window.moveVehicle=");
    expect(html).toContain("window.setRouteVisible=");
  });

  it("draws the vehicle as an arrow plus a speed chip", () => {
    expect(html).toContain("veh-arrow");
    expect(html).toContain("veh-chip");
    expect(html).toContain("km/h");
  });

  it("splits the route into travelled and pending legs", () => {
    expect(html).toContain("doneLine=");
    expect(html).toContain("todoLine=");
  });

  it("signals readiness to the screen", () => {
    expect(html).toContain("send({type:'ready'})");
  });

  it("turns off follow when the user drags or zooms the map", () => {
    expect(html).toContain("dragstart");
    expect(html).toContain("send({type:'followOff'})");
  });
});
