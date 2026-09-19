import { useMemo, type ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileBadge,
  IdCard,
  Landmark,
  Mail,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type HubIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

type VerificationHubScreenProps = {
  onBack: () => void;
  onVerifyCccd: () => void;
  onVerifyGplx: () => void;
  email: string;
  emailVerified: boolean;
  cccdVerified: boolean;
  gplxVerified: boolean;
  gplxLicenseClass?: string | null;
  bankVerified: boolean;
};

type HubItem = {
  key: string;
  icon: HubIcon;
  label: string;
  description: string;
  verified: boolean;
  verifyLabel?: string;
  onVerify?: () => void;
};

export default function VerificationHubScreen({
  onBack,
  onVerifyCccd,
  onVerifyGplx,
  email,
  emailVerified,
  cccdVerified,
  gplxVerified,
  gplxLicenseClass,
  bankVerified,
}: VerificationHubScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const items: HubItem[] = [
    {
      key: "email",
      icon: Mail,
      label: "Email",
      description: email || "-",
      verified: emailVerified,
    },
    {
      key: "cccd",
      icon: IdCard,
      label: "CCCD",
      description: "Căn cước công dân",
      verified: cccdVerified,
      verifyLabel: "Xác minh CCCD",
      onVerify: onVerifyCccd,
    },
    {
      key: "gplx",
      icon: FileBadge,
      label: "Giấy phép lái xe",
      description: gplxLicenseClass ? `Hạng ${gplxLicenseClass}` : "Bằng lái xe các hạng",
      verified: gplxVerified,
      verifyLabel: "Xác minh GPLX",
      onVerify: onVerifyGplx,
    },
    {
      key: "bank",
      icon: Landmark,
      label: "Ngân hàng",
      description: "Tài khoản thụ hưởng",
      verified: bankVerified,
    },
  ];

  const verifiedCount = items.filter((item) => item.verified).length;
  const allVerified = verifiedCount === items.length;

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Xác minh tài khoản</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Kiểm tra trạng thái xác minh giấy tờ của bạn</Text>
          <View style={[styles.countPill, allVerified ? styles.countPillDone : styles.countPillPending]}>
            <Text style={[styles.countText, allVerified ? styles.countTextDone : styles.countTextPending]}>
              {`${verifiedCount}/${items.length} đã xác minh`}
            </Text>
          </View>
        </View>

        {items.map((item) => (
          <DocumentCard key={item.key} item={item} />
        ))}

        <View style={styles.infoPanel}>
          <View style={styles.infoIcon}>
            {allVerified ? (
              <CheckCircle2 color={theme.success} size={20} strokeWidth={2.3} />
            ) : (
              <CircleAlert color={theme.brand} size={20} strokeWidth={2.3} />
            )}
          </View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>
              {allVerified ? "Tài khoản đã sẵn sàng" : "Còn bước xác minh cần hoàn tất"}
            </Text>
            <Text style={styles.infoDescription}>
              Các bước xác minh giúp giảm rủi ro khi đặt xe, hỗ trợ duyệt hồ sơ nhanh hơn và bảo vệ
              giao dịch giữa khách hàng với chủ xe.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgeUnverified]}>
      {verified ? (
        <CheckCircle2 color={theme.success} size={12} strokeWidth={2.5} />
      ) : (
        <CircleAlert color={theme.muted} size={12} strokeWidth={2.5} />
      )}
      <Text style={[styles.badgeText, verified ? styles.badgeTextVerified : styles.badgeTextUnverified]}>
        {verified ? "Đã xác minh" : "Chưa xác minh"}
      </Text>
    </View>
  );
}

function DocumentCard({ item }: { item: HubItem }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const Icon = item.icon;
  const actionable = !item.verified && item.onVerify !== undefined;

  return (
    <View style={[styles.card, item.verified && styles.cardVerified]}>
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole={actionable ? "button" : undefined}
        disabled={!actionable}
        onPress={item.onVerify}
        style={styles.cardTop}
      >
        <View style={[styles.cardIcon, item.verified ? styles.cardIconVerified : styles.cardIconUnverified]}>
          <Icon color={item.verified ? theme.success : theme.muted} size={21} strokeWidth={2.3} />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{item.label}</Text>
          <Text numberOfLines={1} style={styles.cardDescription}>
            {item.description}
          </Text>
          <View style={styles.badgeRow}>
            <VerifiedBadge verified={item.verified} />
          </View>
        </View>
        {actionable ? <ArrowRight color={theme.faint} size={18} strokeWidth={2.4} /> : null}
      </Pressable>
      {actionable ? (
        <Pressable accessibilityRole="button" onPress={item.onVerify} style={styles.verifyButton}>
          <Text style={styles.verifyText}>{item.verifyLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 48,
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
    headerRow: { gap: 8 },
    subtitle: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    countPill: {
      alignSelf: "flex-start",
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countPillDone: { borderColor: theme.success, backgroundColor: theme.successSoft },
    countPillPending: { borderColor: theme.brandBorder, backgroundColor: theme.brandSoft },
    countText: { fontSize: 12, fontWeight: "800" },
    countTextDone: { color: theme.success },
    countTextPending: { color: theme.brand },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 12,
    },
    cardVerified: { borderColor: theme.success, backgroundColor: theme.successSoft },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    cardIconVerified: { backgroundColor: theme.surface },
    cardIconUnverified: { backgroundColor: theme.surfaceAlt },
    cardTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    cardDescription: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    badgeRow: { flexDirection: "row", marginTop: 3 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    badgeVerified: { backgroundColor: theme.surface },
    badgeUnverified: { backgroundColor: theme.surfaceAlt },
    badgeText: { fontSize: 11, fontWeight: "800" },
    badgeTextVerified: { color: theme.success },
    badgeTextUnverified: { color: theme.muted },
    verifyButton: {
      minHeight: 46,
      borderRadius: 13,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    verifyText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    infoPanel: {
      flexDirection: "row",
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      alignItems: "flex-start",
    },
    infoIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    infoBody: { flex: 1, minWidth: 0, gap: 4 },
    infoTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    infoDescription: { color: theme.muted, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  });
