import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import PhotoPreview from "@/components/PhotoPreview";
import { inspectionAngles, missingInspectionAngles, MAX_INSPECTION_PHOTOS, type PhotoCategory } from "../inspectionGuide";
import type { CapturedInspectionPhoto } from "../inspectionPhoto";
import type { CheckInOutImageResponse } from "../types";

export default function InspectionGuide({ vehicleType, photos, references = [], disabled, onCapture, onRemove }: {
  vehicleType?: string | null; photos: CapturedInspectionPhoto[]; references?: CheckInOutImageResponse[];
  disabled: boolean; onCapture: (category: PhotoCategory, replaceId?: string) => void;
  onRemove: (photo: CapturedInspectionPhoto) => void;
}) {
  const { t } = useTranslation("bookingGuide");
  const { theme } = useTheme();
  const [skipped, setSkipped] = useState<string[]>([]);
  const angles = inspectionAngles(vehicleType);
  return <View style={{ gap: 12 }}>
    <Text style={{ color: theme.text, fontWeight: "700" }}>{t("title")}</Text>
    <Text style={{ color: theme.muted }}>{t("intro")}</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.brand }}>{t("progress", { done: angles.length - missingInspectionAngles(vehicleType, photos).length, total: angles.length, count: photos.length })}</Text>
    {angles.map(category => {
      const photo = photos.find(p => p.photoCategory === category);
      const reference = references.find(p => p.photoCategory === category);
      return <View key={category} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: photo ? theme.brand : theme.border, borderRadius: 12 }}>
        <Text style={{ color: theme.text, fontWeight: "700" }}>{t(`labels.${category}`)}{photo ? " ✓" : skipped.includes(category) ? ` · ${t("skipped")}` : ""}</Text>
        <Text style={{ color: theme.muted }}>{t(`hints.${category}`)}</Text>
        {photo ? <PhotoPreview photos={[{ uri: photo.uri, name: t(`labels.${category}`) }]} disabled={disabled} onRemove={() => onRemove(photo)} /> : null}
        {reference ? <View style={{ gap: 4 }}><Text style={{ color: theme.muted }}>{t("reference")}</Text><PhotoPreview photos={[{ uri: reference.imageUrl }]} /></View> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Pressable accessibilityRole="button" disabled={disabled || (!photo && photos.length >= MAX_INSPECTION_PHOTOS)} onPress={() => onCapture(category, photo?.id)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.brand }}>{photo ? t("replace") : t("capture")}</Text>
          </Pressable>
          {!photo ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setSkipped(values => values.includes(category) ? values.filter(v => v !== category) : [...values, category])} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.muted }}>{t("skip")}</Text></Pressable> : null}
        </View>
      </View>;
    })}
  </View>;
}
