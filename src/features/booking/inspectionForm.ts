import { appendUploadFile } from "@/types/upload";
import type { CapturedInspectionPhoto } from "./inspectionPhoto";
import { validateInspectionFields } from "./bookingDisplay";

export function createInspectionForm(fields: {
  actualReturnAt?: string;
  odometer: string; fuelLevel: string; damageNoted: boolean; damageDescription: string;
  photos: CapturedInspectionPhoto[];
}): FormData {
  const error = validateInspectionFields(fields.odometer, fields.damageNoted, fields.damageDescription, fields.photos.length);
  if (error) throw new Error(error);
  const data = new FormData();
  if (fields.actualReturnAt) data.append("actualReturnAt", fields.actualReturnAt);
  if (fields.odometer.trim()) data.append("odometerKm", fields.odometer.trim());
  if (fields.fuelLevel) data.append("fuelLevel", fields.fuelLevel);
  data.append("damageNoted", String(fields.damageNoted));
  if (fields.damageNoted) data.append("damageDescription", fields.damageDescription.trim());
  fields.photos.forEach((photo) => appendUploadFile(data, "images", photo.uploadBlob ?? photo.file));
  fields.photos.forEach((photo) => data.append("capturedAts", photo.capturedAt));
  return data;
}
