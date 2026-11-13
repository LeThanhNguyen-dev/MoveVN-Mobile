import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import TxRow from "@/features/wallets/components/TxRow";
import TxDetailSheet from "@/features/wallets/components/TxDetailSheet";
import WithdrawalRow from "@/features/wallets/components/WithdrawalRow";
import type { WalletTransactionDto } from "@/features/wallets/types";
import type { WalletState } from "@/features/wallets/hooks/useWallet";

type HistorySubTab = "tx" | "withdraw";

// Lọc server-side qua ?type= (exact-match với WalletTransactionType của BE).
const TYPE_CHIPS: { key: string | null; labelKey: string }[] = [
  { key: null, labelKey: "mobile:wallet.history.chipAll" },
  { key: "TopUp", labelKey: "accountWallet:types.TopUp" },
  { key: "BookingPayment", labelKey: "mobile:wallet.history.chipDeposit" },
  { key: "Refund", labelKey: "accountWallet:types.Refund" },
  { key: "Withdrawal", labelKey: "accountWallet:types.Withdrawal" },
  { key: "BookingEarning", labelKey: "mobile:wallet.history.chipEarning" },
];

// Khoá nhóm tháng không phụ thuộc ngôn ngữ: "YYYY-M" (hoặc "unknown"),
// phần hiển thị dịch ra ở component để sort vẫn đúng khi đổi ngôn ngữ.
const UNKNOWN_MONTH_KEY = "unknown";

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return UNKNOWN_MONTH_KEY;
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function monthSortValue(key: string) {
  const m = key.match(/^(\d+)-(\d+)$/);
  if (!m) return 0;
  return Number(m[1]) * 12 + Number(m[2]);
}

export default function WalletHistoryScreen({ state }: { state: WalletState }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const [sub, setSub] = useState<HistorySubTab>("tx");
  const [keyword, setKeyword] = useState("");
  const [selectedTx, setSelectedTx] = useState<WalletTransactionDto | null>(null);
  const {
    transactions,
    txTotal,
    txType,
    setTxTypeFilter,
    withdrawals,
    wdTotal,
    loading,
    loadingMore,
    loadingMoreWd,
    loadMoreTx,
    loadMoreWd,
    reload,
    handleCancelWithdrawal,
  } = state;

  // Tìm kiếm theo ghi chú trên kết quả đã tải.
  const searched = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return transactions;
    return transactions.filter((t) => (t.note ?? "").toLowerCase().includes(kw));
  }, [transactions, keyword]);

  const sections = useMemo(() => {
    const groups = new Map<string, WalletTransactionDto[]>();
    for (const item of searched) {
      const k = monthKey(item.createdAt);
      const arr = groups.get(k);
      if (arr) arr.push(item);
      else groups.set(k, [item]);
    }
    return [...groups.entries()]
      .map(([key, data]) => ({ key, data }))
      .sort((a, b) => monthSortValue(b.key) - monthSortValue(a.key));
  }, [searched]);

  function monthLabel(key: string) {
    if (key === UNKNOWN_MONTH_KEY) return t("mobile:wallet.history.unknownTime");
    const [year, month] = key.split("-");
    return t("mobile:wallet.history.monthTitle", { month, year });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Tab nhỏ trong Lịch sử: Giao dịch | Rút tiền */}
      <View style={styles.subTabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: sub === "tx" }}
          onPress={() => setSub("tx")}
          style={[styles.subButton, sub === "tx" && styles.subActive]}
        >
          <AppText style={[styles.subText, sub === "tx" && styles.subTextActive]}>
            {t("mobile:wallet.history.txTab")}
            {transactions.length > 0 ? ` (${txTotal})` : ""}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: sub === "withdraw" }}
          onPress={() => setSub("withdraw")}
          style={[styles.subButton, sub === "withdraw" && styles.subActive]}
        >
          <AppText style={[styles.subText, sub === "withdraw" && styles.subTextActive]}>
            {t("accountWallet:withdraw")}
            {withdrawals.length > 0 ? ` (${wdTotal})` : ""}
          </AppText>
        </Pressable>
      </View>

      {sub === "tx" ? (
        <SectionList
          sections={sections}
          keyExtractor={(tx) => String(tx.id)}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          onRefresh={reload}
          refreshing={false}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.listHead}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {TYPE_CHIPS.map((c) => (
                  <Pressable
                    key={c.labelKey}
                    onPress={() => void setTxTypeFilter(c.key)}
                    style={[styles.chip, txType === c.key && styles.chipActive]}
                  >
                    <AppText style={[styles.chipText, txType === c.key && styles.chipTextActive]}>
                      {t(c.labelKey)}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                value={keyword}
                onChangeText={setKeyword}
                placeholder={t("mobile:wallet.history.searchPlaceholder")}
                placeholderTextColor={theme.placeholder}
                style={styles.search}
              />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <AppText display style={styles.monthTitle}>{monthLabel(section.key)}</AppText>
          )}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedTx(item)} style={styles.card}>
              <TxRow tx={item} />
            </Pressable>
          )}
          ListEmptyComponent={
            <AppText style={styles.muted}>
              {keyword.trim()
                ? t("mobile:wallet.history.noMatch")
                : t("accountWallet:tx.empty")}
            </AppText>
          }
          ListFooterComponent={
            !keyword.trim() && searched.length < txTotal ? (
              <Pressable onPress={loadMoreTx} disabled={loadingMore} style={styles.moreButton}>
                <AppText style={styles.moreText}>
                  {loadingMore
                    ? t("common:loading")
                    : t("mobile:wallet.history.loadMoreCount", { count: txTotal - searched.length })}
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={withdrawals}
          keyExtractor={(w) => String(w.id)}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          onRefresh={reload}
          refreshing={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <WithdrawalRow w={item} onCancel={handleCancelWithdrawal} />
            </View>
          )}
          ListEmptyComponent={
            <AppText style={styles.muted}>
              {t("accountWallet:withdrawals.empty")}
            </AppText>
          }
          ListFooterComponent={
            withdrawals.length < wdTotal ? (
              <Pressable onPress={loadMoreWd} disabled={loadingMoreWd} style={styles.moreButton}>
                <AppText style={styles.moreText}>
                  {loadingMoreWd
                    ? t("common:loading")
                    : t("mobile:wallet.history.loadMoreCount", { count: wdTotal - withdrawals.length })}
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      )}

      <TxDetailSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    muted: { color: theme.muted, fontSize: 13, textAlign: "center", marginTop: 24 },
    subTabs: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    subButton: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    subActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    subText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    subTextActive: { color: theme.onBrand, fontWeight: "800" },
    listHead: { gap: 10, paddingBottom: 4 },
    chips: { gap: 8, paddingRight: 16 },
    chip: {
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.brandSoft, borderColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 12.5, fontWeight: "700" },
    chipTextActive: { color: theme.brand, fontWeight: "800" },
    search: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: theme.text,
      fontSize: 13,
    },
    monthTitle: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      marginTop: 10,
      marginBottom: 2,
    },
    body: { padding: 16, paddingTop: 8, gap: 8, paddingBottom: 24 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    moreButton: {
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      marginTop: 8,
    },
    moreText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
