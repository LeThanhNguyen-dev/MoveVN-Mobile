import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import VoucherHuntScreen from "@/features/voucherClaims/screens/VoucherHuntScreen";
import VoucherWalletScreen from "@/features/voucherClaims/screens/VoucherWalletScreen";
import VoucherHistoryScreen from "@/features/voucherClaims/screens/VoucherHistoryScreen";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "./types";

const Stack = createNativeStackNavigator<DealsStackParamList>();

/**
 * Cụm Ưu đãi chỉ còn 2 trang: Săn mã và Ví voucher (mirror web
 * /customer/voucher-hunt và /customer/voucher-wallet). Mở tab là vào thẳng
 * Săn mã, không còn màn Khuyến mãi riêng.
 */
export default function DealsNavigator({ onGoExplore }: { onGoExplore?: () => void }) {
  const { theme } = useTheme();

  return (
    <View style={styles.root}>
      <Stack.Navigator
        initialRouteName="VoucherHunt"
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      >
        <Stack.Screen name="VoucherHunt" component={VoucherHuntScreen} />
        <Stack.Screen name="VoucherWallet">
          {() => <VoucherWalletScreen onUseNow={onGoExplore} />}
        </Stack.Screen>
        <Stack.Screen name="VoucherHistory" component={VoucherHistoryScreen} />
      </Stack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
