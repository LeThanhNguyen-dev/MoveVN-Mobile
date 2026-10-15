import { useCallback, useState } from "react";
import { CalendarCheck, Gift, LayoutGrid, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import WalletScreen from "@/features/wallets/screens/WalletScreen";
import TabPlaceholderScreen from "@/features/app/screens/TabPlaceholderScreen";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import type { AuthUser } from "@/features/auth/types";
import ExploreNavigator from "./ExploreNavigator";
import TripsNavigator from "./TripsNavigator";
import ChatNavigator from "./ChatNavigator";
import FavoritesNavigator from "./FavoritesNavigator";
import { useFavoriteStore } from "@/features/favorites/useFavorites";
import { useChatStore } from "@/features/chat/useChat";
import MobileBottomBar, { type MobileTabItem } from "./MobileBottomBar";
import { useTheme } from "@/theme/useTheme";

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
  const [showWallet, setShowWallet] = useState(false);
  const showFavorites = useFavoriteStore((state) => state.open && state.userId === user.userId);
  const [exploreRoute, setExploreRoute] = useState("ExploreMain");
  const [pendingTripId, setPendingTripId] = useState<number | null>(null);
  const [chatRoute, setChatRoute] = useState("ChatList");
  const [tripRoute, setTripRoute] = useState("TripList");
  const unread = useChatStore((state) => state.rooms.reduce((sum, room) => sum + room.unreadCount, 0));
  const { theme } = useTheme();

  const handleExploreRouteChange = useCallback((routeName: string) => {
    setExploreRoute(routeName);
  }, []);

  const goToTrip = useCallback((bookingId: number) => {
    setPendingTripId(bookingId);
    setActiveTab("trips");
  }, []);

  const consumePendingTrip = useCallback(() => {
    setPendingTripId(null);
  }, []);

  // Ẩn bottom bar khi vào List / Detail, chỉ hiện ở màn Khám phá chính.
  const showBottomBar = (activeTab !== "explore" || exploreRoute === "ExploreMain")
    && (activeTab !== "messages" || chatRoute === "ChatList")
    && (activeTab !== "trips" || tripRoute !== "BookingChat");

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {showFavorites ? (
        <FavoritesNavigator
          onClose={() => useFavoriteStore.setState({ open: false })}
          onExplore={() => { useFavoriteStore.setState({ open: false }); setActiveTab("explore"); }}
          onBookingCreated={(bookingId) => { useFavoriteStore.setState({ open: false }); goToTrip(bookingId); }}
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
            {activeTab === "explore" ? (
              <ExploreNavigator
                user={user}
                onAvatarPress={() => setShowProfile(true)}
                onRouteChange={handleExploreRouteChange}
                onBookingCreated={goToTrip}
              />
            ) : activeTab === "trips" ? (
              <TripsNavigator pendingBookingId={pendingTripId} onConsumedPending={consumePendingTrip} onRouteChange={setTripRoute} />
            ) : activeTab === "deals" ? (
              <TabPlaceholderScreen
                description="Khuyến mãi, săn mã và ví voucher của bạn sẽ được đặt ở màn này."
                icon={Gift}
                title="Ưu đãi"
              />
            ) : activeTab === "messages" ? (
              <ChatNavigator onRouteChange={setChatRoute} />
            ) : (
              <AccountTabScreen onProfilePress={() => setShowProfile(true)} onWalletPress={() => setShowWallet(true)} user={user} />
            )}
          </View>
          {showBottomBar ? (
            <MobileBottomBar activeKey={activeTab} items={customerTabs.map((item) => item.key === "messages" ? { ...item, badge: unread } : item)} onChange={setActiveTab} />
          ) : null}
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
