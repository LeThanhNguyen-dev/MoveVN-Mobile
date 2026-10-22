import { useCallback, useState } from "react";
import { CalendarCheck, CarFront, LayoutDashboard, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import WalletScreen from "@/features/wallets/screens/WalletScreen";
import OwnerOverviewScreen from "@/features/app/screens/OwnerOverviewScreen";
import OwnerVehiclesScreen from "@/features/app/screens/OwnerVehiclesScreen";
import AssistantFab from "@/features/assistant/components/AssistantFab";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import PublicUserProfileScreen from "@/features/users/screens/PublicUserProfileScreen";
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
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [chatRoute, setChatRoute] = useState("ChatList");
  const [bookingRoute, setBookingRoute] = useState("OwnerBookingList");
  const [pendingDispute, setPendingDispute] = useState<DisputeCreatePrefill | null>(null);
  const [disputeOrigin, setDisputeOrigin] = useState<{ tab: "bookings" } | null>(null);
  const [disputesVisible, setDisputesVisible] = useState(false);
  const unread = useChatStore((state) => state.rooms.reduce((sum, room) => sum + room.unreadCount, 0));
  const { theme } = useTheme();

  // Mở hồ sơ công khai của người dùng (khách thuê / người đánh giá).
  const openUserProfile = useCallback((userId: number) => {
    setProfileUserId(userId);
  }, []);

  const openDisputes = useCallback((prefill?: DisputeCreatePrefill) => {
    setPendingDispute(prefill ?? null);
    // Luồng này chỉ được gọi từ chi tiết đơn thuê → back phải về lại đó.
    setDisputeOrigin(prefill?.bookingId != null ? { tab: "bookings" as const } : null);
    setActiveTab("account");
  }, []);

  const consumeDisputes = useCallback(() => {
    setPendingDispute(null);
    setDisputeOrigin(null);
  }, []);

  // Thoát khỏi luồng deep-link: dọn prefill rồi quay về đúng tab đơn thuê.
  const exitDisputesToOrigin = useCallback(() => {
    setPendingDispute(null);
    setDisputeOrigin(null);
    setActiveTab("bookings");
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {profileUserId != null ? (
        <PublicUserProfileScreen
          userId={profileUserId}
          onBack={() => setProfileUserId(null)}
          onOpenProfile={openUserProfile}
        />
      ) : showProfile ? (
        <UserProfileScreen onBack={() => setShowProfile(false)} user={user} />
      ) : showWallet ? (
        <View style={[styles.screen, styles.overlayPad]}>
          <WalletScreen onBack={() => setShowWallet(false)} />
        </View>
      ) : (
        <>
          <View style={styles.screen}>
            {activeTab === "overview" ? (
              <OwnerOverviewScreen onAvatarPress={() => setShowProfile(true)} user={user} />
            ) : activeTab === "bookings" ? (
              <OwnerBookingsNavigator
                onRouteChange={setBookingRoute}
                onOpenDisputes={openDisputes}
                onOpenUserProfile={openUserProfile}
              />
            ) : activeTab === "vehicles" ? (
              <OwnerVehiclesScreen />
            ) : activeTab === "messages" ? (
              <ChatNavigator owner onRouteChange={setChatRoute} onOpenUserProfile={openUserProfile} />
            ) : (
              <AccountTabScreen
                onProfilePress={() => setShowProfile(true)}
                onWalletPress={() => setShowWallet(true)}
                user={user}
                initialDisputes={pendingDispute}
                onConsumedDisputes={consumeDisputes}
                onDisputesVisibilityChange={setDisputesVisible}
                onExitDisputes={disputeOrigin ? exitDisputesToOrigin : undefined}
              />
            )}
          </View>
          {(activeTab !== "messages" || chatRoute === "ChatList") && (activeTab !== "bookings" || bookingRoute !== "BookingChat") && !disputesVisible ? <MobileBottomBar activeKey={activeTab} items={ownerTabs.map((item) => item.key === "messages" ? { ...item, badge: unread } : item)} onChange={setActiveTab} /> : null}
          {/* ChatbotAI (không booking) cho chủ xe */}
          <AssistantFab />
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
