import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, IdCard } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { OwnerApplicationDto } from "@/features/owner/types";
import MaskedDocumentValue from "@/features/pin/components/MaskedDocumentValue";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type CccdInfoScreenProps = {
  onBack: () => void;
  onVerify: () => void;
  application: OwnerApplicationDto | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("vi-VN");
}

export default function CccdInfoScreen({ onBack, onVerify, application }: CccdInfoScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const verified = application?.nationalIdVerified ?? false;

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {verified && application ? (
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Thông tin CCCD</Text>
              <Text style={styles.headerDescription}>Thông tin định danh đã được xác minh</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.statusBox}>
                <StatusBadge />
                <DetailLine label="Họ và tên" value={application.fullName || "-"} />
                <View style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Số CCCD</Text>
                  <MaskedDocumentValue
                    canReveal
                    documentType="CCCD"
                    maskedValue={application.nationalIdNumber ?? null}
                    revealDisabledHint="Giấy tờ chưa được xác thực để hiển thị."
                  />
                </View>
                <DetailLine label="Ngày xác thực" value={formatDate(application.createdAt)} />
              </View>
            </View>

            <View style={styles.successBox}>
              <CheckCircle2 color={theme.success} size={20} strokeWidth={2.3} />
              <View style={styles.successBody}>
                <Text style={styles.successTitle}>CCCD đã được xác thực</Text>
                <Text style={styles.successText}>Thông tin được lưu trữ an toàn.</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, styles.cardIconUnverified]}>
                <IdCard color={theme.brand} size={24} strokeWidth={2.3} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Căn cước công dân</Text>
                <View style={styles.statusRow}>
                  <CircleAlert color={theme.danger} size={15} strokeWidth={2.5} />
                  <Text style={[styles.statusText, styles.statusUnverified]}>Chưa xác minh</Text>
                </View>
              </View>
            </View>
            <View style={styles.stack}>
              <Text style={styles.description}>
                Bạn chưa xác minh CCCD. Xác minh ngay để mở khóa đầy đủ tính năng của MoveVN.
              </Text>
              <Pressable accessibilityRole="button" onPress={onVerify} style={styles.verifyButton}>
                <Text style={styles.verifyText}>Xác minh CCCD</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatusBadge() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.badge, styles.badgeVerified]}>
      <CheckCircle2 color={theme.success} size={14} strokeWidth={2.5} />
      <Text style={[styles.badgeText, styles.badgeTextVerified]}>Đã xác minh</Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
    header: { gap: 4, paddingTop: 2 },
    headerTitle: { color: theme.text, fontSize: 20, fontWeight: "800" },
    headerDescription: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "500" },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
    },
    statusBox: { gap: 2 },
    badge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 4,
    },
    badgeVerified: { backgroundColor: theme.successSoft },
    badgeText: { fontSize: 12, fontWeight: "800" },
    badgeTextVerified: { color: theme.success },
    detailLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 5,
    },
    detailLabel: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    detailValue: { color: theme.text, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 },
    successBox: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 14,
      backgroundColor: theme.successSoft,
      padding: 14,
      alignItems: "flex-start",
    },
    successBody: { flex: 1, gap: 2 },
    successTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    successText: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardIcon: { width: 50, height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    cardIconUnverified: { backgroundColor: theme.brandSoft },
    cardTitleWrap: { flex: 1, minWidth: 0, gap: 4 },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    statusText: { fontSize: 13, fontWeight: "700" },
    statusUnverified: { color: theme.danger },
    stack: { gap: 12 },
    description: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "500" },
    verifyButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    verifyText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
