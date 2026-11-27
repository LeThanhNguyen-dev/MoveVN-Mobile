import i18n from "@/i18n";

type VariantSpecifications = {
  vehicleType: string;
  fuelType?: string | null;
  seatCount?: number | null;
  bodyType?: string | null;
  bikeType?: string | null;
  engineCapacity?: string | null;
};

function catalogLabel(value: string | null | undefined, labels: Record<string, string>): string {
  const normalized = value?.trim();
  if (!normalized) return i18n.t("common:vehicleSpecs.unknown");
  const key = labels[normalized.toLowerCase()];
  return key ? i18n.t(key) : normalized;
}

export function getVehicleVariantFacts(vehicle: VariantSpecifications) {
  if (vehicle.vehicleType === "Car") {
    return [
      {
        key: "seatCount",
        label: i18n.t("common:vehicleSpecs.seatCount"),
        value: vehicle.seatCount != null && vehicle.seatCount > 0
          ? i18n.t("common:vehicleSpecs.seats", { count: vehicle.seatCount })
          : i18n.t("common:vehicleSpecs.unknown"),
      },
      {
        key: "bodyType",
        label: i18n.t("common:vehicleSpecs.bodyType"),
        value: catalogLabel(vehicle.bodyType, {
          sedan: "common:vehicleSpecs.bodyTypes.Sedan",
          suv: "common:vehicleSpecs.bodyTypes.SUV",
          hatchback: "common:vehicleSpecs.bodyTypes.Hatchback",
          coupe: "common:vehicleSpecs.bodyTypes.Coupe",
          convertible: "common:vehicleSpecs.bodyTypes.Convertible",
          pickup: "common:vehicleSpecs.bodyTypes.Pickup",
          "mpv/minivan": "common:vehicleSpecs.bodyTypes.MPV",
          wagon: "common:vehicleSpecs.bodyTypes.Wagon",
        }),
      },
    ];
  }
  if (vehicle.vehicleType !== "Motorbike") return [];

  const facts = [{
    key: "bikeType",
    label: i18n.t("common:vehicleSpecs.bikeType"),
    value: catalogLabel(vehicle.bikeType, {
      scooter: "common:bikeType.Scooter",
      manual: "common:bikeType.Manual",
      clutch: "common:bikeType.Clutch",
      sport: "common:bikeType.Sport",
      cruiser: "common:bikeType.Cruiser",
      adventure: "common:bikeType.Adventure",
    }),
  }];
  // Electric bikes have no combustion-engine displacement.
  if (vehicle.fuelType?.trim().toLowerCase() !== "electric") {
    const capacity = vehicle.engineCapacity?.trim();
    facts.push({
      key: "engineCapacity",
      label: i18n.t("common:vehicleSpecs.engineCapacity"),
      // Catalog values may already contain units or a capacity range.
      value: capacity
        ? /^\d+(?:[.,]\d+)?$/.test(capacity) ? capacity + " cc" : capacity
        : i18n.t("common:vehicleSpecs.unknown"),
    });
  }
  return facts;
}
