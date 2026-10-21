import WalletNavigator from "@/features/wallets/navigation/WalletNavigator";

// Giữ API cũ cho CustomerNavigator / OwnerNavigator.
// Toàn bộ UI mới nằm ở WalletNavigator (mini bottom-tab: Tổng quan / Lịch sử / Nạp-Rút / Ngân hàng).
export default function WalletScreen({ onBack }: { onBack: () => void }) {
  return <WalletNavigator onBack={onBack} />;
}
