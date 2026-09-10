import { useState } from "react";
import { CalendarCheck, Gift, LayoutGrid, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import CustomerExploreScreen from "@/features/app/screens/CustomerExploreScreen";
import TabPlaceholderScreen from "@/features/app/screens/TabPlaceholderScreen";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import type { AuthUser } from "@/features/auth/types";
import MobileBottomBar, { type MobileTabItem } from "./MobileBottomBar";

type CustomerTabKey = "trips" | "deals" | "explore" | "messages" | "account";

const customerTabs: MobileTabItem<CustomerTabKey>[] = [
  { key: "trips", label: "Chuyến đi", icon: CalendarCheck },
  { key: "deals", label: "Ưu đãi", icon: Gift },
  { key: "explore", label: "Khám phá", icon: LayoutGrid, prominent: true },
  { key: "messages", label: "Tin nhắn", icon: MessageSquare },
  { key: "account", label: "Tài khoản", icon: UserRound },
];

export default function CustomerNavigator({ user }: { user: AuthUser }) {
  const [activeTab, setActiveTab] = useState<CustomerTabKey>("explore");
  const [showProfile, setShowProfile] = useState(false);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {showProfile ? (
        <UserProfileScreen onBack={() => setShowProfile(false)} user={user} />
      ) : (
        <>
          <View style={styles.screen}>
            {activeTab === "explore" ? (
              <CustomerExploreScreen onAvatarPress={() => setShowProfile(true)} user={user} />
            ) : activeTab === "trips" ? (
              <TabPlaceholderScreen
                description="Các đơn thuê, lịch sử chuyến đi và trạng thái nhận/trả xe sẽ hiển thị ở đây."
                icon={CalendarCheck}
                title="Chuyến đi"
              />
            ) : activeTab === "deals" ? (
              <TabPlaceholderScreen
                description="Khuyến mãi, săn mã và ví voucher của bạn sẽ được đặt ở màn này."
                icon={Gift}
                title="Ưu đãi"
              />
            ) : activeTab === "messages" ? (
              <TabPlaceholderScreen
                description="Tin nhắn giữa bạn, chủ xe và đội hỗ trợ sẽ hiển thị ở đây."
                icon={MessageSquare}
                title="Tin nhắn"
              />
            ) : (
              <AccountTabScreen onProfilePress={() => setShowProfile(true)} user={user} />
            )}
          </View>
          <MobileBottomBar activeKey={activeTab} items={customerTabs} onChange={setActiveTab} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF6FF" },
  screen: { flex: 1 },
});
