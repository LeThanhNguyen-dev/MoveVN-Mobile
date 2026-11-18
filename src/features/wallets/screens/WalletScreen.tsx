import WalletNavigator from "@/features/wallets/navigation/WalletNavigator";
import type { WalletTabKey } from "@/features/wallets/navigation/WalletNavigator";

// Giữ API cũ cho CustomerNavigator / OwnerNavigator.
// Toàn bộ UI mới nằm ở WalletNavigator (mini bottom-tab: Tổng quan / Lịch sử / Nạp-Rút / Ngân hàng).
export default function WalletScreen({ onBack, initialTab }: { onBack: () => void; initialTab?: WalletTabKey }) {
  return <WalletNavigator initialTab={initialTab} onBack={onBack} />;
}
