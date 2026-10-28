import {
  Armchair,
  Bluetooth,
  Camera,
  Check,
  Gauge,
  Navigation,
  Snowflake,
  Sparkles,
  Sun,
  Usb,
  Wifi,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { VehicleFeatureResponse } from "@/features/vehicles/types";
import DetailSectionHeader from "./DetailSectionHeader";
import { detailFont, useDetailTheme } from "./detailTheme";

function featureIcon(name: string): LucideIcon {
  const value = name.toLocaleLowerCase("vi-VN");
  if (/(camera|360)/.test(value)) return Camera;
  if (/(bluetooth|carplay|android auto|kết nối|giải trí)/.test(value)) return Bluetooth;
  if (/(bản đồ|định vị|gps|navigation)/.test(value)) return Navigation;
  if (/(cruise|ga tự động|hành trình)/.test(value)) return Gauge;
  if (/(sưởi|ghế|seat)/.test(value)) return Armchair;
  if (/(cửa sổ trời|sunroof|trời)/.test(value)) return Sun;
  if (/(điều hòa|mát|lạnh|climate)/.test(value)) return Snowflake;
  if (/(sạc|usb)/.test(value)) return Usb;
  if (/(wifi)/.test(value)) return Wifi;
  return Check;
}

export default function VehicleFeaturesSection({ features }: { features: VehicleFeatureResponse[] }) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  return (
    <View style={styles.section}>
      <DetailSectionHeader icon={Sparkles} title="Tiện ích" />
      {features.length > 0 ? (
        <View style={styles.grid}>
          {features.map((feature) => {
            const Icon = featureIcon(feature.name);
            return (
              <View key={feature.id} style={styles.item}>
                <Icon color={p.brand} size={14} strokeWidth={2.1} />
                <AppText style={styles.label} numberOfLines={2}>
                  {feature.name}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : (
        <AppText style={styles.empty}>Chưa cập nhật tiện ích.</AppText>
      )}
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    section: { marginTop: 22, marginHorizontal: 20 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
    item: {
      width: "48.5%",
      minHeight: 42,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    label: { flex: 1, color: p.ink, fontFamily: detailFont.semibold, fontSize: 11.5, lineHeight: 15 },
    empty: { color: p.muted, fontFamily: detailFont.regular, fontSize: 12.5, marginTop: 9 },
  });
