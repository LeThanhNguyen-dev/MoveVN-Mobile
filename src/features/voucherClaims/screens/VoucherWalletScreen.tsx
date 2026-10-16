import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { Check, Clock, Copy, CircleCheck, Wallet } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";
import { showToast } from "@/features/notifications/toastStore";
import DealsSegmentedNav from "@/features/vouchers/components/DealsSegmentedNav";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import { formatEndDate, formatVehicleLabel, formatVnd, getDaysLeft } from "@/features/vouchers/voucherFormat";
import { getVoucherWallet } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherClaimResponse } from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type WalletTab = "available" | "used";

function WalletVoucherCard({ voucher }: { voucher: VoucherClaimResponse }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [copied, setCopied] = useState(false);

  const daysLeft = getDaysLeft(voucher.endAt);
  const isUsed = !!voucher.usedAt;

  function handleCopy() {
    void Clipboard.setStringAsync(voucher.code).then(() => {
      setCopied(true);
      showToast({ type: "success", title: "Đã copy mã!", message: voucher.code });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <View style={[styles.ticket, isUsed && styles.ticketUsed]}>
      <VoucherTicketStub
        discountType={voucher.discountType}
        discountValue={voucher.discountValue}
        dimmed={isUsed}
      />
      <View style={styles.ticketDivider} />

      <View style={styles.ticketBody}>
        <View style={styles.nameRow}>
          <View style={styles.nameWrap}>
            <AppText style={styles.ticketName} numberOfLines={1}>
              {voucher.name}
            </AppText>
            {!!voucher.description && (
              <AppText style={styles.ticketDesc} numberOfLines={2}>
                {voucher.description}
              </AppText>
            )}
          </View>
          {isUsed ? (
            <View style={styles.usedBadge}>
              <CircleCheck color={theme.muted} size={11} />
              <AppText style={styles.usedBadgeText}>Đã sử dụng</AppText>
            </View>
          ) : daysLeft !== null ? (
            <View
              style={[
                styles.daysBadge,
                daysLeft <= 3 ? styles.daysBadgeUrgent : styles.daysBadgeFresh,
              ]}
            >
              <Clock
                color={
                  daysLeft <= 3
                    ? theme.mode === "dark"
                      ? "#FB7185"
                      : "#B91C1C"
                    : theme.mode === "dark"
                      ? "#34D399"
                      : "#059669"
                }
                size={11}
              />
              <AppText
                style={[
                  styles.daysBadgeText,
                  daysLeft <= 3
                    ? { color: theme.mode === "dark" ? "#FB7185" : "#B91C1C" }
                    : { color: theme.mode === "dark" ? "#34D399" : "#059669" },
                ]}
              >
                🟢 {daysLeft > 0 ? `Còn ${daysLeft} ngày` : "Hết hôm nay!"}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <AppText style={styles.metaText}>{formatVehicleLabel(voucher.vehicleType)}</AppText>
          {!!voucher.minOrderAmount && (
            <AppText style={[styles.metaText, styles.metaAmber]}>
              Đơn từ {formatVnd(voucher.minOrderAmount)}
            </AppText>
          )}
          {!!formatEndDate(voucher.endAt) && (
            <AppText style={styles.metaText}>📅 HSD: {formatEndDate(voucher.endAt)}</AppText>
          )}
        </View>

        <View style={styles.copyRow}>
          <View style={styles.codeBox}>
            <AppText style={styles.codeText} numberOfLines={1}>
              {voucher.code}
            </AppText>
          </View>
          {!isUsed ? (
            <Pressable
              onPress={handleCopy}
              style={styles.copyButton}
              accessibilityRole="button"
              accessibilityLabel="Copy mã voucher"
            >
              {copied ? (
                <Check color="#FFFFFF" size={13} />
              ) : (
                <Copy color="#FFFFFF" size={13} />
              )}
              <AppText style={styles.copyButtonText}>{copied ? "Đã copy!" : "Copy"}</AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const MemoWalletCard = memo(WalletVoucherCard);

export default function VoucherWalletScreen() {
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vouchers, setVouchers] = useState<VoucherClaimResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<WalletTab>("available");

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVoucherWallet();
      setVouchers(Array.isArray(data) ? data : []);
    } catch {
      showToast({ type: "error", title: "Lỗi", message: "Không thể tải ví voucher." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const available = useMemo(() => vouchers.filter((v) => !v.usedAt), [vouchers]);
  const used = useMemo(() => vouchers.filter((v) => !!v.usedAt), [vouchers]);
  const displayed = tab === "available" ? available : used;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>Ví voucher</AppText>
        <AppText style={styles.pageDesc}>Quản lý voucher đã nhận và sử dụng khi đặt xe.</AppText>

        <DealsSegmentedNav />

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setTab("available")}
            style={[styles.tab, tab === "available" && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "available" }}
          >
            <AppText style={[styles.tabText, tab === "available" && styles.tabTextActive]}>
              Chưa dùng ({available.length})
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setTab("used")}
            style={[styles.tab, tab === "used" && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "used" }}
          >
            <AppText style={[styles.tabText, tab === "used" && styles.tabTextActive]}>
              Đã dùng ({used.length})
            </AppText>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyBox}>
            <Wallet color={theme.faint} size={44} />
            <AppText display style={styles.emptyTitle}>
              {tab === "available" ? "Chưa có voucher nào." : "Chưa sử dụng voucher nào."}
            </AppText>
            {tab === "available" ? (
              <Pressable onPress={() => navigation.navigate("VoucherHunt")} style={styles.emptyLinkTouch}>
                <AppText style={styles.emptyLink}>Đi săn mã ngay! →</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.cardList}>
            {displayed.map((v) => (
              <MemoWalletCard key={v.id} voucher={v} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 96, gap: 12 },
    pageTitle: { color: theme.text, fontSize: 22, fontWeight: "800" },
    pageDesc: { color: theme.muted, fontSize: 13, marginTop: -8 },

    tabRow: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 12,
      backgroundColor: theme.mode === "dark" ? "#16161D" : "#F1F5F9",
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 9,
      borderRadius: 9,
    },
    tabActive: {
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#FFFFFF",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    tabText: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    tabTextActive: { color: theme.mode === "dark" ? theme.text : theme.brand, fontWeight: "800" },

    centerBox: { paddingVertical: 64, alignItems: "center" },
    emptyBox: { alignItems: "center", paddingVertical: 40, gap: 6 },
    emptyTitle: { color: theme.muted, fontSize: 14, fontWeight: "600", marginTop: 8, textAlign: "center" },
    emptyLinkTouch: { marginTop: 4, padding: 6 },
    emptyLink: { color: theme.brand, fontSize: 13, fontWeight: "800" },

    cardList: { gap: 12 },
    ticket: {
      flexDirection: "row",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    ticketUsed: { opacity: 0.75 },
    ticketDivider: {
      width: 0,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "#3F3F46" : "#DDD6FE",
      marginVertical: 10,
    },
    ticketBody: { flex: 1, minWidth: 0, padding: 14, gap: 8 },
    nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    nameWrap: { flex: 1, minWidth: 0, gap: 2 },
    ticketName: { color: theme.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
    ticketDesc: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    usedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 0,
    },
    usedBadgeText: { color: theme.muted, fontSize: 11, fontWeight: "700" },
    daysBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 0,
    },
    daysBadgeFresh: {
      backgroundColor: theme.mode === "dark" ? "rgba(52,211,153,0.15)" : "#ECFDF5",
    },
    daysBadgeUrgent: {
      backgroundColor: theme.mode === "dark" ? "rgba(244,63,94,0.15)" : "#FEE2E2",
    },
    daysBadgeText: { fontSize: 11, fontWeight: "700" },

    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metaText: { color: theme.muted, fontSize: 12 },
    metaAmber: { color: theme.mode === "dark" ? "#FBBF24" : "#B45309" },

    copyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    codeBox: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "rgba(139,92,255,0.4)" : "#C4B5FD",
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.1)" : "rgba(245,243,255,0.7)",
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    codeText: { color: theme.brand, fontSize: 12, fontWeight: "800", fontFamily: "monospace" },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 10,
      backgroundColor: "#7C3AED",
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexShrink: 0,
    },
    copyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  });
