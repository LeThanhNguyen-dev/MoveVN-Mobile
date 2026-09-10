import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  ChevronRight,
  FileText,
  Headphones,
  Heart,
  IdCard,
  KeyRound,
  LogOut,
  Monitor,
  Scale,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wallet,
} from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { signOut } from "@/features/auth/services/authSession";
import { getCurrentUser } from "@/features/auth/services/authService";
import type { AuthUser, UserRole } from "@/features/auth/types";
import { getMyDriverLicense } from "@/features/driverLicenses/services/driverLicenseService";
import type { DriverLicenseStatusResponse } from "@/features/driverLicenses/types";
import { getMyApplication } from "@/features/owner/services/ownerService";
import type { OwnerApplicationDto } from "@/features/owner/types";

type TabIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

type AccountMenuItem = {
  key: string;
  label: string;
  icon: TabIcon;
  accent: string;
  value?: string;
  onPress?: () => void;
};

type AccountSection = {
  title: string;
  items: AccountMenuItem[];
};

const roleLabels: Record<UserRole, string> = {
  Admin: "Quản trị",
  Staff: "Nhân viên",
  Owner: "Chủ xe",
  Customer: "Khách hàng",
};

const verificationTotal = 4;

export default function AccountTabScreen({ onProfilePress, user }: { onProfilePress: () => void; user: AuthUser }) {
  const activeRole = useAuthStore((state) => state.activeRole);
  const setActiveRole = useAuthStore((state) => state.setActiveRole);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [ownerApp, setOwnerApp] = useState<OwnerApplicationDto | null>(null);
  const [driverLicense, setDriverLicense] = useState<DriverLicenseStatusResponse | null>(null);

  useEffect(() => {
    let ignore = false;

    getCurrentUser()
      .then((currentUser) => {
        if (!ignore) void updateUser(currentUser);
      })
      .catch(() => undefined);

    getMyApplication()
      .then((application) => {
        if (!ignore && application?.id > 0) setOwnerApp(application);
      })
      .catch(() => undefined);

    getMyDriverLicense()
      .then((license) => {
        if (!ignore) setDriverLicense(license);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [updateUser]);

  const verifiedCount = useMemo(() => {
    return [
      user.isEmailVerified,
      ownerApp?.nationalIdVerified,
      driverLicense?.verified ?? ownerApp?.driverLicenseVerified,
      ownerApp?.bankInfoCompleted,
    ].filter(Boolean).length;
  }, [driverLicense?.verified, ownerApp?.bankInfoCompleted, ownerApp?.driverLicenseVerified, ownerApp?.nationalIdVerified, user.isEmailVerified]);

  const roleAction = getRoleAction(user.roles, activeRole);

  function handleRoleAction() {
    if (roleAction.targetRole) {
      void setActiveRole(roleAction.targetRole);
    }
  }

  const sections: AccountSection[] = [
    {
      title: "Xác thực",
      items: [
        {
          key: "verification",
          label: "Xác minh tài khoản",
          icon: ShieldCheck,
          accent: verifiedCount === verificationTotal ? "#059669" : "#6B19FF",
          value: `${verifiedCount}/${verificationTotal}`,
        },
      ],
    },
    {
      title: "Quản lý",
      items: [
        { key: "wallet", label: "Ví của tôi", icon: Wallet, accent: "#059669" },
        { key: "favorites", label: "Yêu thích", icon: Heart, accent: "#E11D48" },
        { key: "deals", label: "Ưu đãi", icon: BadgePercent, accent: "#D97706" },
        { key: "disputes", label: "Tranh chấp", icon: Scale, accent: "#DC2626" },
        { key: "stats", label: "Thống kê", icon: BarChart3, accent: "#2563EB" },
      ],
    },
    {
      title: "Hỗ trợ",
      items: [
        { key: "support", label: "Trung tâm hỗ trợ", icon: Headphones, accent: "#0F766E" },
        { key: "policy", label: "Điều khoản & chính sách", icon: FileText, accent: "#64748B" },
      ],
    },
    {
      title: "Bảo mật",
      items: [
        { key: "password", label: "Đổi mật khẩu", icon: KeyRound, accent: "#D97706" },
        { key: "sessions", label: "Phiên đăng nhập", icon: Monitor, accent: "#2563EB" },
      ],
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
      <Pressable accessibilityLabel="Xem thông tin tài khoản" accessibilityRole="button" onPress={onProfilePress} style={styles.profileCard}>
        <View style={styles.avatar}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <UserRound color="#6B19FF" size={28} strokeWidth={2.3} />
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text numberOfLines={1} style={styles.profileName}>{user.fullName || "Tài khoản MoveVN"}</Text>
          <Text numberOfLines={1} style={styles.profileMeta}>{user.email || user.phone || "Xem thông tin tài khoản"}</Text>
          <View style={styles.roleRow}>
            {(user.roles.length ? user.roles : ["Customer"]).map((role) => (
              <View key={role} style={styles.rolePill}>
                <Text style={styles.roleText}>{roleLabels[role as UserRole] ?? role}</Text>
              </View>
            ))}
          </View>
        </View>
        <ChevronRight color="#9A90A8" size={21} strokeWidth={2.4} />
      </Pressable>

      <Pressable accessibilityRole="button" onPress={handleRoleAction} style={styles.ownerCard}>
        <View style={styles.ownerIcon}>
          {roleAction.targetRole ? (
            <ArrowLeftRight color="#6B19FF" size={22} strokeWidth={2.4} />
          ) : (
            <UserPlus color="#6B19FF" size={23} strokeWidth={2.4} />
          )}
        </View>
        <View style={styles.ownerInfo}>
          <Text style={styles.ownerTitle}>{roleAction.title}</Text>
          <Text style={styles.ownerDescription}>{roleAction.description}</Text>
        </View>
        <ChevronRight color="#6B19FF" size={21} strokeWidth={2.5} />
      </Pressable>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, index) => (
              <MenuRow
                key={item.key}
                item={item}
                last={index === section.items.length - 1}
                progress={item.key === "verification" ? verifiedCount / verificationTotal : undefined}
              />
            ))}
          </View>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.logoutButton}>
        <LogOut color="#DC2626" size={19} strokeWidth={2.4} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({ item, last, progress }: { item: AccountMenuItem; last: boolean; progress?: number }) {
  const Icon = item.icon;
  const progressPercent: DimensionValue = `${Math.round((progress ?? 0) * 100)}%`;

  return (
    <Pressable accessibilityRole="button" onPress={item.onPress ?? (() => undefined)} style={[styles.menuRow, !last && styles.menuDivider]}>
      <View style={[styles.menuIcon, { backgroundColor: iconBackground(item.accent) }]}>
        <Icon color={item.accent} size={20} strokeWidth={2.3} />
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuLine}>
          <Text numberOfLines={1} style={styles.menuLabel}>{item.label}</Text>
          {item.value ? <Text style={[styles.menuValue, { color: item.accent }]}>{item.value}</Text> : null}
        </View>
        {typeof progress === "number" ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressPercent, backgroundColor: item.accent }]} />
          </View>
        ) : null}
      </View>
      <ChevronRight color="#B0A7BB" size={19} strokeWidth={2.4} />
    </Pressable>
  );
}

function getRoleAction(roles: UserRole[], activeRole: UserRole | null) {
  const hasOwner = roles.includes("Owner");
  const hasCustomer = roles.includes("Customer");

  if (hasOwner && activeRole === "Owner" && hasCustomer) {
    return {
      title: "Chuyển sang Khách hàng",
      description: "Thuê xe và quản lý nhu cầu di chuyển của bạn",
      targetRole: "Customer" as UserRole,
    };
  }

  if (hasOwner && activeRole !== "Owner") {
    return {
      title: "Chuyển sang Chủ xe",
      description: "Quản lý xe, đơn thuê và doanh thu",
      targetRole: "Owner" as UserRole,
    };
  }

  return {
    title: "Đăng ký làm chủ xe",
    description: "Tạo hồ sơ cho thuê xe trên MoveVN",
    targetRole: null,
  };
}

function iconBackground(color: string) {
  return `${color}12`;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#FAF6FF",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 112,
  },
  profileCard: {
    minHeight: 104,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8E1F2",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F1E7FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  profileInfo: {
    minWidth: 0,
    flex: 1,
  },
  profileName: {
    color: "#101936",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  profileMeta: {
    color: "#746F7E",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 2,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  rolePill: {
    borderRadius: 999,
    backgroundColor: "#F1E7FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  roleText: {
    color: "#6B19FF",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  ownerCard: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DACBFF",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 15,
    marginTop: 14,
  },
  ownerIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ownerInfo: {
    minWidth: 0,
    flex: 1,
  },
  ownerTitle: {
    color: "#24143F",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  ownerDescription: {
    color: "#6C5D84",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: "#625B6B",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8E1F2",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  menuRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  menuDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0EBF6",
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    minWidth: 0,
    flex: 1,
    gap: 8,
  },
  menuLine: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuLabel: {
    minWidth: 0,
    flex: 1,
    color: "#101936",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  menuValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#EEE7F6",
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 999,
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FECACA",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 24,
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "800",
  },
});
