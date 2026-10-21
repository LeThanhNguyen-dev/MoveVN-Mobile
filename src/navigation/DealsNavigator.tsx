import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import CustomerPromotionsScreen from "@/features/promotions/screens/CustomerPromotionsScreen";
import VoucherHuntScreen from "@/features/voucherClaims/screens/VoucherHuntScreen";
import VoucherWalletScreen from "@/features/voucherClaims/screens/VoucherWalletScreen";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "./types";

const Stack = createNativeStackNavigator<DealsStackParamList>();

/**
 * Cụm Ưu đãi / Săn mã / Ví voucher (tab 🎁).
 * Tab Bottom Bar giữ active vì CustomerNavigator không đổi activeTab khi
 * đi sâu trong stack này (mirror web active cả 3 route promotions/hunt/wallet).
 */
export default function DealsNavigator() {
  const { theme } = useTheme();

  return (
    <View style={styles.root}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      >
        <Stack.Screen name="Promotions" component={CustomerPromotionsScreen} />
        <Stack.Screen name="VoucherHunt" component={VoucherHuntScreen} />
        <Stack.Screen name="VoucherWallet" component={VoucherWalletScreen} />
      </Stack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
