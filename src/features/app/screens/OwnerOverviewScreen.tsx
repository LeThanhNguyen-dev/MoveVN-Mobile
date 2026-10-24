import type { AuthUser } from "@/features/auth/types";
import OwnerAnalyticsScreen from "@/features/ownerAnalytics/OwnerAnalyticsScreen";

export default function OwnerOverviewScreen({ user, onAvatarPress }: { user: AuthUser; onAvatarPress?: () => void; onBellPress?: () => void }) {
  return <OwnerAnalyticsScreen key={user.userId} user={user} onAvatarPress={onAvatarPress} />;
}
