import {
  Bike,
  CalendarDays,
  CarFront,
  ChevronRight,
  CreditCard,
  IdCard,
  Landmark,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import ProfileAvatar from "@/features/users/components/ProfileAvatar";
import type { PublicUserProfile } from "@/features/users/services/publicUserProfileService";
import { membershipLabel, relativeTime } from "@/features/users/utils/profileTime";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  profile: PublicUserProfile;
  onOpenReviews: () => void;
  onOpenVehicles: () => void;
};

type DocTone = "emerald" | "blue" | "purple";

const DOC_TONES: Record<
  DocTone,
  { color: string; colorDark: string; bg: string; bgDark: string; border: string; borderDark: string }
> = {
  emerald: {
    color: "#059669",
    colorDark: "#34D399",
    bg: "#ECFDF5",
    bgDark: "rgba(52,211,153,0.12)",
    border: "#A7F3D0",
    borderDark: "rgba(52,211,153,0.3)",
  },
  blue: {
    color: "#2563EB",
    colorDark: "#60A5FA",
    bg: "#EFF6FF",
    bgDark: "rgba(96,165,250,0.12)",
    border: "#BFDBFE",
    borderDark: "rgba(96,165,250,0.3)",
  },
  purple: {
    color: "#7C3AED",
    colorDark: "#A78BFA",
    bg: "#F5F3FF",
    bgDark: "rgba(167,139,250,0.12)",
    border: "#DDD6FE",
    borderDark: "rgba(167,139,250,0.3)",
  },
};

function presenceText(profile: PublicUserProfile): string {
  if (profile.isOnline) return "Đang hoạt động";
  const seen = relativeTime(profile.lastSeenAt);
  return seen ? `Hoạt động ${seen}` : "Không hoạt động";
}

/** Màn 2: chi tiết chủ xe — điểm đánh giá, số xe, thời gian tham gia, xác minh. */
export default function OwnerProfileDetail({ profile, onOpenReviews, onOpenVehicles }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rating = profile.ownerAverageRating;
  const reviewCount = profile.ownerReviewCount;
  const ratingText =
    rating == null ? "Chưa có đánh giá" : `${rating.toFixed(1)}/5 (${reviewCount})`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <ProfileAvatar avatarUrl={profile.avatarUrl} fullName={profile.fullName} size={56} />
        <AppText display style={styles.profileName} numberOfLines={2}>
          {profile.fullName}
        </AppText>
        <View style={styles.presenceRow}>
          {profile.isOnline ? <View style={styles.onlineDot} /> : null}
          <AppText style={styles.presenceText}>{presenceText(profile)}</AppText>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <AppText style={styles.roleBadgeText}>Chủ xe</AppText>
          </View>
          {profile.isVerified ? (
            <View style={styles.verifiedBadge}>
              <ShieldCheck color={theme.mode === "dark" ? "#34D399" : "#059669"} size={10} />
              <AppText style={styles.verifiedBadgeText}>Đã xác minh</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.infoCard}>
        <Pressable
          style={({ pressed }) => [styles.infoRow, pressed && styles.rowPressed]}
          onPress={onOpenReviews}
          accessibilityRole="button"
          accessibilityLabel={`Xem ${reviewCount} đánh giá của chủ xe`}
        >
          <View
            style={[
              styles.infoIcon,
              { backgroundColor: theme.mode === "dark" ? "#34280F" : "#FFF6E2" },
            ]}
          >
            <Star color="#F59E0B" fill="#F59E0B" size={14} />
          </View>
          <AppText style={styles.infoLabel}>Đánh giá</AppText>
          <AppText style={styles.infoValue} numberOfLines={1}>
            {ratingText}
          </AppText>
          <ChevronRight color={theme.faint} size={15} />
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: theme.brandSoft }]}>
            <Bike color={theme.brand} size={14} />
          </View>
          <AppText style={styles.infoLabel}>Số sản phẩm (Xe)</AppText>
          <AppText style={styles.infoValue}>{profile.totalVehicles} xe</AppText>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: theme.infoSoft }]}>
            <CalendarDays color={theme.info} size={14} />
          </View>
          <AppText style={styles.infoLabel}>Đã tham gia</AppText>
          <AppText style={styles.infoValue}>{membershipLabel(profile.createdAt)}</AppText>
        </View>
      </View>

      <View style={[styles.verifyCard, !profile.isVerified && styles.verifyCardMuted]}>
        <View style={styles.verifyHead}>
          <View
            style={[
              styles.verifyIcon,
              { backgroundColor: profile.isVerified ? theme.successSoft : theme.surfaceAlt },
            ]}
          >
            <ShieldCheck
              color={profile.isVerified ? theme.success : theme.faint}
              size={17}
            />
          </View>
          <View style={styles.verifyBody}>
            <AppText style={styles.verifyTitle}>
              {profile.isVerified ? "Tài khoản đã được xác minh" : "Tài khoản chưa xác minh"}
            </AppText>
            <AppText style={styles.verifyDesc}>
              {profile.isVerified
                ? "Hồ sơ chủ xe đã được MoveVN xác minh."
                : "Chủ xe chưa hoàn tất xác minh hồ sơ."}
            </AppText>
          </View>
        </View>
        <View style={styles.docRow}>
          <DocChip
            icon={IdCard}
            label="CCCD"
            tone="emerald"
            active={profile.isVerified}
            styles={styles}
          />
          <DocChip
            icon={CreditCard}
            label="GPLX"
            tone="blue"
            active={profile.isVerified}
            styles={styles}
          />
          <DocChip
            icon={Landmark}
            label="Ngân hàng"
            tone="purple"
            active={profile.isVerified}
            styles={styles}
          />
        </View>
      </View>

      <Pressable
        onPress={onOpenVehicles}
        style={({ pressed }) => [styles.vehiclesButton, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Xem tất cả ${profile.totalVehicles} xe`}
      >
        <CarFront color={theme.onBrand} size={15} />
        <AppText style={styles.vehiclesButtonText}>
          Xem tất cả xe ({profile.totalVehicles})
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

function DocChip({
  icon: Icon,
  label,
  tone,
  active,
  styles,
}: {
  icon: typeof IdCard;
  label: string;
  tone: DocTone;
  active: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { theme } = useTheme();
  const palette = DOC_TONES[tone];
  const dark = theme.mode === "dark";
  const chipStyle = active
    ? {
        borderColor: dark ? palette.borderDark : palette.border,
        backgroundColor: dark ? palette.bgDark : palette.bg,
      }
    : { borderColor: theme.border, backgroundColor: theme.surfaceAlt };
  const color = active ? (dark ? palette.colorDark : palette.color) : theme.faint;

  return (
    <View style={[styles.docChip, chipStyle]}>
      <Icon color={color} size={13} />
      <AppText style={[styles.docChipText, { color }]}>{label}</AppText>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 12, paddingBottom: 24, gap: 10 },

    profileCard: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingVertical: 16,
      paddingHorizontal: 14,
      gap: 5,
    },
    profileName: {
      color: theme.text,
      fontFamily: "Quicksand_700Bold",
      fontSize: 17,
      textAlign: "center",
      marginTop: 3,
    },
    presenceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success },
    presenceText: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_500Medium",
      fontSize: 11,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 5,
      marginTop: 2,
    },
    roleBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    roleBadgeText: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 10,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(52,211,153,0.3)" : "#A7F3D0",
      backgroundColor: theme.mode === "dark" ? "rgba(52,211,153,0.12)" : "#ECFDF5",
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    verifiedBadgeText: {
      color: theme.mode === "dark" ? "#34D399" : "#059669",
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 10,
    },

    infoCard: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 46,
    },
    rowPressed: { opacity: 0.65 },
    infoIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    infoLabel: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontFamily: "BeVietnamPro_600SemiBold",
      fontSize: 12,
    },
    infoValue: {
      color: theme.brand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
      maxWidth: "50%",
      textAlign: "right",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginLeft: 51,
    },

    verifyCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(52,211,153,0.28)" : "#C7F0DF",
      backgroundColor: theme.mode === "dark" ? "rgba(52,211,153,0.08)" : "#F4FCF8",
      padding: 12,
      gap: 10,
    },
    verifyCardMuted: {
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    verifyHead: { flexDirection: "row", alignItems: "center", gap: 9 },
    verifyIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    verifyBody: { flex: 1, minWidth: 0, gap: 1 },
    verifyTitle: {
      color: theme.text,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 12,
    },
    verifyDesc: {
      color: theme.muted,
      fontFamily: "BeVietnamPro_400Regular",
      fontSize: 10.5,
      lineHeight: 14,
    },
    docRow: { flexDirection: "row", gap: 6 },
    docChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 6,
    },
    docChipText: {
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 10,
    },

    vehiclesButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      height: 44,
      borderRadius: 10,
      backgroundColor: theme.brand,
    },
    vehiclesButtonText: {
      color: theme.onBrand,
      fontFamily: "BeVietnamPro_700Bold",
      fontSize: 13,
    },
  });
