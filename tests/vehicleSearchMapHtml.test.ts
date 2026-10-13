import { describe, expect, it } from "vitest";
import { buildVehicleSearchMapHtml } from "@/features/vehicles/components/vehicleSearchMapHtml";

describe("vehicle search map HTML", () => {
  it("produces valid WebView JavaScript with vehicle and pickup markers", () => {
    const html = buildVehicleSearchMapHtml(
      [{ id: 7, latitude: 16.05, longitude: 108.2, vehicleType: "Car", price: 650_000,
        name: "Xe thử </script>", featuredImage: null, totalPrice: 1_300_000, distanceKm: 2.5 }],
      { latitude: 16.06, longitude: 108.21 },
      10,
      "#6B19FF",
      "#F1F5F9",
    );
    const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(inlineScript).toBeDefined();
    expect(() => new Function(inlineScript ?? "")).not.toThrow();
    expect(inlineScript).toContain("window.focusVehicle");
    expect(inlineScript).toContain("window.ReactNativeWebView.postMessage");
    expect(inlineScript).toContain("type:'open'");
    expect(inlineScript).toContain("popupFor(vehicle)");
    expect(html).not.toContain("Xe thử </script>");
    expect(inlineScript).toContain("L.circle([pickup.latitude,pickup.longitude]");
  });
});
