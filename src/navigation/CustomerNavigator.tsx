import { useCallback, useState } from "react";
import { CalendarCheck, Gift, LayoutGrid, MessageSquare, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AccountTabScreen from "@/features/app/screens/AccountTabScreen";
import BookingsTabScreen from "@/features/booking/screens/BookingsTabScreen";
import TabPlaceholderScreen from "@/features/app/screens/TabPlaceholderScreen";
import UserProfileScreen from "@/features/app/screens/UserProfileScreen";
import AssistantFab from "@/features/assistant/components/AssistantFab";
import type { QuickBookParams } from "@/features/assistant/screens/AssistantScreen";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import type { AuthUser } from "@/features/auth/types";
import ExploreNavigator from "./ExploreNavigator";
import TripsNavigator from "./TripsNavigator";
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
  const [exploreRoute, setExploreRoute] = useState("ExploreMain");
  const [tripsRoute, setTripsRoute] = useState("TripList");
  const [pendingTripId, setPendingTripId] = useState<number | null>(null);
  const [quickBook, setQuickBook] = useState<QuickBookParams | null>(null);
  const [pendingDispute, setPendingDispute] = useState<DisputeCreatePrefill | null>(null);
  const { theme } = useTheme();

  const handleExploreRouteChange = useCallback((routeName: string) => {
    setExploreRoute(routeName);
  }, []);

  const goToTrip = useCallback((bookingId: number) => {
    setPendingTripId(bookingId);
    setTripsRoute("TripDetail");
    setActiveTab("trips");
  }, []);

  const consumePendingTrip = useCallback(() => {
    setPendingTripId(null);
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
    setActiveTab("account");
  }, []);

  const consumeDisputes = useCallback(() => {
    setPendingDispute(null);
  }, []);

  // Ẩn bottom bar khi vào List / Detail, chỉ hiện ở màn Khám phá chính và danh sách chuyến đi.
  const showBottomBar =
    (activeTab !== "explore" || exploreRoute === "ExploreMain") &&
    (activeTab !== "trips" || tripsRoute === "TripList");

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {showProfile ? (
        <UserProfileScreen onBack={() => setShowProfile(false)} user={user} />
      ) : (
        <>
          <View style={styles.screen}>
            {activeTab === "explore" ? (
              <ExploreNavigator
                user={user}
                onAvatarPress={() => setShowProfile(true)}
                onRouteChange={handleExploreRouteChange}
                onBookingCreated={goToTrip}
                quickBook={quickBook}
                onConsumedQuickBook={consumeQuickBook}
              />
            ) : activeTab === "trips" ? (
              <TripsNavigator
                pendingBookingId={pendingTripId}
                onConsumedPending={consumePendingTrip}
                onRouteChange={setTripsRoute}
                onOpenDisputes={openDisputes}
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
              <AccountTabScreen
                onProfilePress={() => setShowProfile(true)}
                user={user}
                initialDisputes={pendingDispute}
                onConsumedDisputes={consumeDisputes}
              />
            )}
          </View>
          {showBottomBar ? (
            <MobileBottomBar activeKey={activeTab} items={customerTabs} onChange={setActiveTab} />
          ) : null}
          {/* ChatbotAI đặt xe nhanh: mở form đặt xe điền sẵn, xác nhận xong qua chuyến đi */}
          <AssistantFab onQuickBook={handleQuickBook} onBookingConfirmed={goToTrip} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { flex: 1 },
});
