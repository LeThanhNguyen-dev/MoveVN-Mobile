import { describe, expect, it } from "vitest";
import { inspectionAngles, missingInspectionAngles } from "@/features/booking/inspectionGuide";
import { createInspectionForm } from "@/features/booking/inspectionForm";
import type { CapturedInspectionPhoto } from "@/features/booking/inspectionPhoto";

describe("inspection guidance", () => {
  it("suggests ten angles for cars and nine for motorcycles", () => {
    expect(inspectionAngles("Car")).toHaveLength(10);
    expect(inspectionAngles("Motorbike")).toHaveLength(9);
    expect(inspectionAngles("Motorbike")).not.toContain("Interior");
  });
  it("counts covered categories rather than number of photos", () => {
    expect(missingInspectionAngles("Car", [{ photoCategory: "Front" }, { photoCategory: "Front" }, { photoCategory: "Damage" }])).toHaveLength(9);
    expect(missingInspectionAngles("Car", [{}])).toHaveLength(10);
  });
  it("keeps photos and categories aligned and allows missing suggested angles", () => {
    const photo = (id: string, photoCategory?: "Front" | "Damage") => ({ id, uri: `file:///${id}.jpg`, capturedAt: "2026-11-23T01:00:00Z", uploadBlob: new Blob([id], { type: "image/jpeg" }), photoCategory }) as CapturedInspectionPhoto;
    const form = createInspectionForm({ odometer: "", fuelLevel: "", damageNoted: false, damageDescription: "", photos: [photo("1", "Front"), photo("2", "Damage"), photo("3")] });
    expect(form.getAll("images")).toHaveLength(3);
    expect(form.getAll("photoCategories")).toEqual(["Front", "Damage", "Other"]);
    expect(form.getAll("capturedAts")).toHaveLength(3);
  });
});
