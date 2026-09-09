import { CarFront } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

export default function OwnerVehiclesScreen() {
  return (
    <View style={styles.content}>
      <View style={styles.iconWrap}>
        <CarFront color="#6B19FF" size={30} strokeWidth={2.4} />
      </View>
      <Text style={styles.title}>Xe của tôi</Text>
      <Text style={styles.description}>Danh sách xe, thêm xe, phân loại ô tô/xe máy và trạng thái cho thuê sẽ nằm ở đây.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#F1E7FF",
  },
  title: {
    color: "#101936",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "#746F7E",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 23,
    maxWidth: 305,
    textAlign: "center",
  },
});
