import { StyleSheet, Text, View } from "react-native";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";

export default function CustomerExploreScreen({ user }: { user: AuthUser }) {
  return (
    <View style={styles.content}>
      <AppDashboardHeader user={user} />

      <View style={styles.placeholder}>
        <Text style={styles.title}>Khám phá</Text>
        <Text style={styles.description}>Nội dung tìm kiếm, gợi ý xe và xe nổi bật sẽ được phát triển ở màn này.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 44,
  },
  title: {
    color: "#101936",
    fontSize: 28,
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
