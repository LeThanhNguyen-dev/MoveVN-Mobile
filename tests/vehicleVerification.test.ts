import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

vi.mock("@/config/apiConfig", () => ({ getConfiguredApiBaseUrl: () => "http://vehicle.test" }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data, status: 200, statusText: "OK", headers: new AxiosHeaders() };
}

async function setup() {
  const { apiClient } = await import("@/services/apiClient");
  const service = await import("@/features/vehicles/services/vehicleService");
  return { apiClient, service };
}

beforeEach(() => vi.resetModules());

describe("Vehicle registration verification", () => {
  it("sends the selected registration image and expected vehicle fields for preview", async () => {
    const app = await setup();
    const file = new Blob(["registration"], { type: "image/jpeg" });
    app.apiClient.defaults.adapter = async (config) => {
      const body = config.data as FormData;
      const uploaded = body.get("file") as Blob;
      expect(config.url).toBe("/api/vehicles/documents/preview");
      expect(uploaded.type).toBe("image/jpeg");
      expect(await uploaded.text()).toBe("registration");
      expect(body.get("vehicleType")).toBe("Motorbike");
      expect(body.get("brandId")).toBe("1");
      expect(body.get("modelId")).toBe("2");
      expect(body.get("licensePlate")).toBe("59X1-12345");
      return response(config, {
        status: true,
        data: {
          recommendation: "Pass",
          flags: [],
          verificationId: "receipt-id",
          expiresAt: "2099-01-01T00:00:00Z",
        },
      });
    };

    const result = await app.service.previewVehicleDocument(file, "Motorbike", 1, 2, "59X1-12345");

    expect(result?.verificationId).toBe("receipt-id");
  });

  it("submits vehicle data, the same image and one-time verification ID together", async () => {
    const app = await setup();
    const file = new Blob(["registration"], { type: "image/jpeg" });
    app.apiClient.defaults.adapter = async (config) => {
      const body = config.data as FormData;
      const uploaded = body.get("file") as Blob;
      expect(config.url).toBe("/api/vehicles/complete");
      expect(uploaded.type).toBe("image/jpeg");
      expect(await uploaded.text()).toBe("registration");
      expect(body.get("verificationId")).toBe("receipt-id");
      expect(JSON.parse(String(body.get("vehicle")))).toMatchObject({
        vehicleType: "Motorbike",
        brandId: 1,
        modelId: 2,
        licensePlate: "59X1-12345",
      });
      return response(config, { status: true, data: { id: 99 } });
    };

    const result = await app.service.completeVehicle({
      brandId: 1,
      modelId: 2,
      vehicleType: "Motorbike",
      year: 2025,
      licensePlate: "59X1-12345",
      address: "Test address",
      pricePerDay: 100000,
      depositPercent: 20,
      securityRequiresDeposit: false,
      securityDepositAmount: 0,
      featureIds: [],
      imageUrls: ["https://example.test/vehicle.jpg"],
      featuredImageIndex: 0,
    }, file, "receipt-id");

    expect(result?.id).toBe(99);
  });
});
