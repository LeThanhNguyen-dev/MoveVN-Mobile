import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import OwnerVehicleMap from "@/features/vehicles/components/OwnerVehicleMap";
import { useDetailTheme } from "./detailTheme";

export default function VehicleMapCard({
  latitude,
  longitude,
  address,
  title,
}: {
  latitude: number | null;
  longitude: number | null;
  address: string;
  title: string;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  return (
    <View style={styles.card}>
      <OwnerVehicleMap
        address={address}
        height={158}
        latitude={latitude}
        longitude={longitude}
        title={title}
      />
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      marginHorizontal: 14,
      padding: 14,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
    },
  });
