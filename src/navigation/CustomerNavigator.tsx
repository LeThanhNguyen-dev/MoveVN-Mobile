import { useCallback, useEffect, useState } from "react";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import { CalendarCheck, Gift, LayoutGrid, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import WalletScreen from "@/features/wallets/screens/WalletScreen";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import AssistantFab from "@/features/assistant/components/AssistantFab";
import type { QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import PublicUserProfileScreen from "@/features/users/screens/PublicUserProfileScreen";
import type { AuthUser } from "@/features/auth/types";
import DealsNavigator from "./DealsNavigator";
import ExploreNavigator from "./ExploreNavigator";
import TripsNavigator from "./TripsNavigator";
import ChatNavigator from "./ChatNavigator";
import FavoritesNavigator from "./FavoritesNavigator";
import { useFavoriteStore } from "@/features/favorites/useFavorites";
import { useChatStore } from "@/features/chat/useChat";
import { useGpsPublisher } from "@/features/gps/useGpsPublisher";
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
  // Publish GPS khi khách có chuyến InProgress/Returning (đăng ký từ TripDetail).
  useGpsPublisher();
  const [activeTab, setActiveTab] = useState<CustomerTabKey>("explore");
  const [showProfile, setShowProfile] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const showFavorites = useFavoriteStore((state) => state.open && state.userId === user.userId);
  const [exploreRoute, setExploreRoute] = useState("ExploreMain");
  const [tripsRoute, setTripsRoute] = useState("TripList");
  const [pendingTripId, setPendingTripId] = useState<number | null>(null);
  const [tripRequest, setTripRequest] = useState(0);
  const pendingPush = usePushNavigation(state => state.pending);
  const [chatRoute, setChatRoute] = useState("ChatList");
  const [pendingVehicleId, setPendingVehicleId] = useState<number | null>(null);
  const [quickBook, setQuickBook] = useState<QuickBookParams | null>(null);
  const [pendingDispute, setPendingDispute] = useState<DisputeCreatePrefill | null>(null);
  const [disputeOrigin, setDisputeOrigin] = useState<{ tab: "trips" } | null>(null);
  const [disputesVisible, setDisputesVisible] = useState(false);
  const unread = useChatStore((state) => state.rooms.reduce((sum, room) => sum + room.unreadCount, 0));
  const { theme } = useTheme();

  const handleExploreRouteChange = useCallback((routeName: string) => {
    setExploreRoute(routeName);
  }, []);

  const goToTrip = useCallback((bookingId: number) => {
    setTripRequest(value => value + 1);
    setPendingTripId(bookingId);
    setTripsRoute("TripDetail");
    setActiveTab("trips");
  }, []);

  useEffect(() => {
    if (!pendingPush || pendingPush.userId !== user.userId || pendingPush.roleTarget !== "Customer") return;
    setShowProfile(false); setShowWallet(false); setProfileUserId(null);
    useFavoriteStore.setState({ open: false });
    goToTrip(pendingPush.bookingId);
    usePushNavigation.getState().clear();
  }, [pendingPush, user.userId, goToTrip]);

  const consumePendingTrip = useCallback(() => {
    setPendingTripId(null);
  }, []);

  // Mở hồ sơ công khai của người dùng (chủ xe / khách / người đánh giá).
  const openUserProfile = useCallback((userId: number) => {
    setProfileUserId(userId);
  }, []);

  const handleQuickBook = useCallback((params: QuickBookParams) => {
    setQuickBook(params);
    setActiveTab("explore");
  }, []);

  const consumeQuickBook = useCallback(() => {
    setQuickBook(null);
  }, []);

  const openDisputes = useCallback((prefill?: DisputeCreatePrefill) => {
    setPendingDispute(prefill ?? null);
    // Luồng này chỉ được gọi từ chi tiết chuyến đi → back phải về lại đó.
    setDisputeOrigin(prefill?.bookingId != null ? { tab: "trips" as const } : null);
    setActiveTab("account");
  }, []);

  const consumeDisputes = useCallback(() => {
    setPendingDispute(null);
    setDisputeOrigin(null);
  }, []);

  // Thoát khỏi luồng deep-link (tạo từ chi tiết booking): dọn prefill
  // rồi quay về đúng tab chuyến đi thay vì kẹt ở "Tranh chấp của tôi".
  const exitDisputesToOrigin = useCallback(() => {
    setPendingDispute(null);
    setDisputeOrigin(null);
    setActiveTab("trips");
  }, []);

  // Ẩn bottom bar khi vào màn con (List / Detail / Chat), chỉ hiện ở màn
  // Khám phá chính, danh sách chuyến đi và danh sách tin nhắn.
  // Ẩn cả cụm Tranh chấp (list/detail/create) để full-screen.
  const showBottomBar =
    !disputesVisible &&
    (activeTab !== "explore" || exploreRoute === "ExploreMain") &&
    (activeTab !== "messages" || chatRoute === "ChatList") &&
    (activeTab !== "trips" || tripsRoute === "TripList");

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {showFavorites ? (
        <FavoritesNavigator
          onClose={() => useFavoriteStore.setState({ open: false })}
          onExplore={() => { useFavoriteStore.setState({ open: false }); setActiveTab("explore"); }}
          onBookingCreated={(bookingId) => { useFavoriteStore.setState({ open: false }); goToTrip(bookingId); }}
        />
      ) : profileUserId != null ? (
        <PublicUserProfileScreen
          userId={profileUserId}
          onBack={() => setProfileUserId(null)}
          onOpenProfile={openUserProfile}
          onViewVehicle={(vehicleId) => {
            setProfileUserId(null);
            setPendingVehicleId(vehicleId);
            setActiveTab("explore");
          }}
          onOpenBooking={(bookingId) => {
            setProfileUserId(null);
            goToTrip(bookingId);
          }}
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
                pendingVehicleId={pendingVehicleId}
                onConsumedVehicle={() => setPendingVehicleId(null)}
                quickBook={quickBook}
                onConsumedQuickBook={consumeQuickBook}
                onGoDeals={() => setActiveTab("deals")}
                onOpenUserProfile={openUserProfile}
              />
            ) : activeTab === "trips" ? (
              <TripsNavigator
                key={tripRequest}
                pendingBookingId={pendingTripId}
                onConsumedPending={consumePendingTrip}
                onRouteChange={setTripsRoute}
                onOpenDisputes={openDisputes}
                onOpenUserProfile={openUserProfile}
              />
            ) : activeTab === "deals" ? (
              <DealsNavigator onGoExplore={() => setActiveTab("explore")} />
            ) : activeTab === "messages" ? (
              <ChatNavigator onRouteChange={setChatRoute} onOpenUserProfile={openUserProfile} />
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
          {showBottomBar ? (
            <MobileBottomBar activeKey={activeTab} items={customerTabs.map((item) => item.key === "messages" ? { ...item, badge: unread } : item)} onChange={setActiveTab} />
          ) : null}
          {/* Giữ xác nhận và thanh toán trong chat; mở chi tiết khi khách chọn. */}
          {!(activeTab === "trips" && tripsRoute === "TripHandover") && <AssistantFab key={user.userId} onViewVehicle={id => { setPendingVehicleId(id); setActiveTab("explore"); }} onViewBooking={goToTrip} onQuickBook={handleQuickBook} />}
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
