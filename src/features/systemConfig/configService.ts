import { useEffect, useState } from "react";
import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import { DEFAULT_DELIVERY_CONFIG, type DeliveryConfig } from "@/features/locations/utils/delivery";

interface PublicConfigResponse {
  deliveryFreeRadiusKm: number;
  deliveryFeePerKm: number;
  deliveryMaxRadiusKm: number;
  withdrawalMinAmount: number;
  withdrawalMaxAmount: number;
  pendingAutoCancelHours?: number;
  gpsTrackingEnabled?: boolean;
}

let cached: PublicConfigResponse | null = null;

export async function getPublicConfig(): Promise<PublicConfigResponse> {
  if (cached) return cached;
  try {
    const res = await bareApiClient.get<ApiResponse<Partial<PublicConfigResponse>>>(endpoints.configPublic);
    cached = {
      deliveryFreeRadiusKm: DEFAULT_DELIVERY_CONFIG.freeKm,
      deliveryFeePerKm: DEFAULT_DELIVERY_CONFIG.perKm,
      deliveryMaxRadiusKm: DEFAULT_DELIVERY_CONFIG.maxKm,
      withdrawalMinAmount: 5000,
      withdrawalMaxAmount: 100_000_000,
      gpsTrackingEnabled: false,
      ...(res.data.data ?? {}),
    };
  } catch {
    cached = {
      deliveryFreeRadiusKm: DEFAULT_DELIVERY_CONFIG.freeKm,
      deliveryFeePerKm: DEFAULT_DELIVERY_CONFIG.perKm,
      deliveryMaxRadiusKm: DEFAULT_DELIVERY_CONFIG.maxKm,
      withdrawalMinAmount: 5000,
      withdrawalMaxAmount: 100_000_000,
      gpsTrackingEnabled: false,
    };
  }
  return cached;
}

/** null = đang tải cấu hình; false = admin đang tắt chia sẻ vị trí. */
export function useGpsTrackingEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    getPublicConfig()
      .then((config) => {
        if (active) setEnabled(config.gpsTrackingEnabled === true);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}

export async function getPendingAutoCancelHours(): Promise<number> {
  const config = await getPublicConfig();
  const hours = Number(config.pendingAutoCancelHours ?? 24);
  return Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 24;
}

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  const config = await getPublicConfig();
  return {
    freeKm: Math.max(0, config.deliveryFreeRadiusKm ?? DEFAULT_DELIVERY_CONFIG.freeKm),
    perKm: Math.max(0, config.deliveryFeePerKm ?? DEFAULT_DELIVERY_CONFIG.perKm),
    maxKm: Math.max(1, config.deliveryMaxRadiusKm ?? DEFAULT_DELIVERY_CONFIG.maxKm),
  };
}
