import { useState } from "react";
import { CalendarCheck, CarFront, LayoutDashboard, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import WalletScreen from "@/features/wallets/screens/WalletScreen";
import DisputeListScreen from "@/features/disputes/screens/DisputeListScreen";
import OwnerOverviewScreen from "@/features/app/screens/OwnerOverviewScreen";
import OwnerVehiclesScreen from "@/features/app/screens/OwnerVehiclesScreen";
import ChatNavigator from "./ChatNavigator";
import { useChatStore } from "@/features/chat/useChat";
import OwnerBookingsNavigator from "./OwnerBookingsNavigator";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import type { AuthUser } from "@/features/auth/types";
import MobileBottomBar, { type MobileTabItem } from "./MobileBottomBar";
import { useTheme } from "@/theme/useTheme";

type OwnerTabKey = "vehicles" | "bookings" | "overview" | "messages" | "account";

const ownerTabs: MobileTabItem<OwnerTabKey>[] = [
  { key: "vehicles", label: "Xe của tôi", icon: CarFront },
  { key: "bookings", label: "Đơn thuê", icon: CalendarCheck },
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard, prominent: true },
  { key: "messages", label: "Tin nhắn", icon: MessageSquare },
  { key: "account", label: "Tài khoản", icon: UserRound },
];

export default function OwnerNavigator({ user }: { user: AuthUser }) {
  const [activeTab, setActiveTab] = useState<OwnerTabKey>("overview");
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showDisputes, setShowDisputes] = useState(false);
  const [chatRoute, setChatRoute] = useState("ChatList");
  const [bookingRoute, setBookingRoute] = useState("OwnerBookingList");
  const unread = useChatStore((state) => state.rooms.reduce((sum, room) => sum + room.unreadCount, 0));
  const { theme } = useTheme();

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {showProfile ? (
        <UserProfileScreen onBack={() => setShowProfile(false)} user={user} />
      ) : showWallet ? (
        <View style={[styles.screen, styles.overlayPad]}>
          <WalletScreen onBack={() => setShowWallet(false)} />
        </View>
      ) : showDisputes ? (
        <View style={[styles.screen, styles.overlayPad]}>
          <DisputeListScreen onBack={() => setShowDisputes(false)} />
        </View>
      ) : (
        <>
          <View style={styles.screen}>
            {activeTab === "overview" ? (
              <OwnerOverviewScreen onAvatarPress={() => setShowProfile(true)} user={user} />
            ) : activeTab === "bookings" ? (
              <OwnerBookingsNavigator onRouteChange={setBookingRoute} />
            ) : activeTab === "vehicles" ? (
              <OwnerVehiclesScreen />
            ) : activeTab === "messages" ? (
              <ChatNavigator owner onRouteChange={setChatRoute} />
            ) : (
              <AccountTabScreen onProfilePress={() => setShowProfile(true)} onWalletPress={() => setShowWallet(true)} onDisputesPress={() => setShowDisputes(true)} user={user} />
            )}
          </View>
          {(activeTab !== "messages" || chatRoute === "ChatList") && (activeTab !== "bookings" || bookingRoute !== "BookingChat") ? <MobileBottomBar activeKey={activeTab} items={ownerTabs.map((item) => item.key === "messages" ? { ...item, badge: unread } : item)} onChange={setActiveTab} /> : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { flex: 1 },
  overlayPad: { paddingTop: 8 },
});
