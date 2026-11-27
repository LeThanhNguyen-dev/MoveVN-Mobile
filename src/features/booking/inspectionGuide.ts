export const MAX_INSPECTION_PHOTOS = 20;
export const INSPECTION_ANGLES = ["Front", "Rear", "Left", "Right", "FrontLeft", "FrontRight", "RearLeft", "RearRight", "Dashboard", "Interior"] as const;
export type PhotoCategory = typeof INSPECTION_ANGLES[number] | "Damage" | "Other";

export function inspectionAngles(vehicleType?: string | null) {
  return INSPECTION_ANGLES.filter(angle => angle !== "Interior" || vehicleType === "Car");
}

export function missingInspectionAngles(vehicleType: string | null | undefined, photos: { photoCategory?: string | null }[]) {
  const selected = new Set(photos.map(photo => photo.photoCategory));
  return inspectionAngles(vehicleType).filter(angle => !selected.has(angle));
}
