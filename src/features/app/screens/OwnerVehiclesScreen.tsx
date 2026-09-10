import { CarFront } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export default function OwnerVehiclesScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.content}>
      <View style={styles.iconWrap}>
        <CarFront color={theme.brand} size={30} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>Xe của tôi</Text>
      <Text style={styles.description}>Danh sách xe, thêm xe, phân loại ô tô/xe máy và trạng thái cho thuê sẽ nằm ở đây.</Text>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.brandSoft,
  },
  title: {
    color: theme.text,
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 23,
    maxWidth: 305,
    textAlign: "center",
  },
});
