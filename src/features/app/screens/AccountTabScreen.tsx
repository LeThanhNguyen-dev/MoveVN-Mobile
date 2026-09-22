import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  ChevronRight,
  ChevronUp,
  FileBadge,
  FileText,
  Headphones,
  Heart,
  IdCard,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Scale,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
  Wallet,
} from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, type DimensionValue } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { signOut } from "@/features/auth/services/authSession";
import { getCurrentUser } from "@/features/auth/services/authService";
import type { AuthUser, UserRole } from "@/features/auth/types";
import ChangePasswordScreen from "@/features/auth/screens/ChangePasswordScreen";
import LoginSessionsScreen from "@/features/auth/screens/LoginSessionsScreen";
import PolicyListScreen from "@/features/cms/screens/PolicyListScreen";
import DriverLicenseScreen from "@/features/driverLicenses/screens/DriverLicenseScreen";
import { getMyDriverLicense } from "@/features/driverLicenses/services/driverLicenseService";
import type { DriverLicenseStatusResponse } from "@/features/driverLicenses/types";
import OwnerVerificationScreen from "@/features/owner/screens/OwnerVerificationScreen";
import { getMyApplication } from "@/features/owner/services/ownerService";
import type { OwnerApplicationDto } from "@/features/owner/types";
import PinChangeModal from "@/features/pin/components/PinChangeModal";
import PinSetupModal from "@/features/pin/components/PinSetupModal";
import type { VerifyPinResult } from "@/features/pin/hooks/usePinReveal";
import { getPinStatus } from "@/features/pin/services/pinService";
import CccdInfoScreen from "@/features/app/screens/CccdInfoScreen";
import SupportCenterScreen from "@/features/app/screens/SupportCenterScreen";
import VerificationHubScreen from "@/features/app/screens/VerificationHubScreen";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

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
  const [showLicense, setShowLicense] = useState(false);
  const [licenseReturn, setLicenseReturn] = useState<"hub" | "account" | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [showCccd, setShowCccd] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [isPinSet, setIsPinSet] = useState<boolean | null>(null);
  const [showSetupPin, setShowSetupPin] = useState(false);
  const [ownerReturn, setOwnerReturn] = useState<"hub" | "cccd" | "account" | null>(null);
  const [showPolicies, setShowPolicies] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { mode, theme, toggleMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDark = mode === "dark";

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

    getPinStatus()
      .then((status) => {
        if (!ignore) setIsPinSet(status.isPinSet);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [updateUser, refreshKey]);

  async function refreshPinStatus() {
    try {
      const status = await getPinStatus();
      setIsPinSet(status.isPinSet);
    } catch {
      // Giữ trạng thái cũ, backend sẽ báo PIN_NOT_SET khi đổi PIN nếu chưa có.
    }
  }

  function handlePinAction() {
    if (isPinSet === false) {
      setShowSetupPin(true);
    } else {
      setShowChangePin(true);
    }
  }

  async function handleSetupDoneFromAccount(): Promise<VerifyPinResult> {
    setShowSetupPin(false);
    await refreshPinStatus();
    return { ok: true };
  }

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
    } else if (user.roles.includes("Customer")) {
      setOwnerReturn("account");
      setShowOwner(true);
    }
  }

  function openOwnerVerify(returnTo: "hub" | "cccd") {
    if (returnTo === "hub") setShowHub(false);
    else setShowCccd(false);
    setOwnerReturn(returnTo);
    setShowOwner(true);
  }

  function closeOwner() {
    const returnTo = ownerReturn;
    setShowOwner(false);
    setOwnerReturn(null);
    setRefreshKey((key) => key + 1);
    if (returnTo === "hub") setShowHub(true);
    else if (returnTo === "cccd") setShowCccd(true);
  }

  const cccdVerified = ownerApp?.nationalIdVerified ?? false;
  const gplxVerified = driverLicense?.verified ?? false;
  const hubVerifiedCount = (cccdVerified ? 1 : 0) + (gplxVerified ? 1 : 0);

  const sections: AccountSection[] = [
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
        {
          key: "support",
          label: "Trung tâm hỗ trợ",
          icon: Headphones,
          accent: "#0F766E",
          onPress: () => setShowSupport(true),
        },
        {
          key: "policy",
          label: "Điều khoản & chính sách",
          icon: FileText,
          accent: "#64748B",
          onPress: () => setShowPolicies(true),
        },
      ],
    },
    {
      title: "Bảo mật",
      items: [
        {
          key: "pin",
          label: isPinSet === false ? "Thiết lập mã PIN" : "Mã PIN",
          icon: Lock,
          accent: theme.brand,
          value: isPinSet === false ? "Chưa thiết lập" : "Đổi mã PIN",
          onPress: handlePinAction,
        },
        {
          key: "password",
          label: "Đổi mật khẩu",
          icon: KeyRound,
          accent: "#D97706",
          onPress: () => setShowChangePassword(true),
        },
        {
          key: "sessions",
          label: "Phiên đăng nhập",
          icon: Monitor,
          accent: "#2563EB",
          onPress: () => setShowSessions(true),
        },
      ],
    },
  ];

  if (showHub) {
    return (
      <VerificationHubScreen
        bankVerified={ownerApp?.bankInfoCompleted ?? false}
        cccdVerified={cccdVerified}
        email={user.email}
        emailVerified={user.isEmailVerified}
        gplxLicenseClass={driverLicense?.licenseClass}
        gplxVerified={gplxVerified}
        onBack={() => {
          setShowHub(false);
          setRefreshKey((key) => key + 1);
        }}
        onVerifyCccd={() => openOwnerVerify("hub")}
        onVerifyGplx={() => {
          setShowHub(false);
          setLicenseReturn("hub");
          setShowLicense(true);
        }}
      />
    );
  }

  if (showCccd) {
    return (
      <CccdInfoScreen
        application={ownerApp}
        onBack={() => {
          setShowCccd(false);
          setRefreshKey((key) => key + 1);
        }}
        onVerify={() => openOwnerVerify("cccd")}
      />
    );
  }

  if (showLicense) {
    return (
      <DriverLicenseScreen
        onBack={() => {
          const returnTo = licenseReturn;
          setShowLicense(false);
          setLicenseReturn(null);
          setRefreshKey((key) => key + 1);
          if (returnTo === "hub") setShowHub(true);
        }}
      />
    );
  }

  if (showOwner) {
    return <OwnerVerificationScreen onBack={closeOwner} />;
  }

  if (showPolicies) {
    return <PolicyListScreen onBack={() => setShowPolicies(false)} />;
  }

  if (showSupport) {
    return <SupportCenterScreen onBack={() => setShowSupport(false)} />;
  }

  if (showChangePassword) {
    return <ChangePasswordScreen onBack={() => setShowChangePassword(false)} />;
  }

  if (showSessions) {
    return <LoginSessionsScreen onBack={() => setShowSessions(false)} />;
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
      <Pressable accessibilityLabel="Xem thông tin tài khoản" accessibilityRole="button" onPress={onProfilePress} style={styles.profileCard}>
        <View style={styles.avatar}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <UserRound color={theme.brand} size={28} strokeWidth={2.3} />
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
        <ChevronRight color={theme.faint} size={21} strokeWidth={2.4} />
      </Pressable>

      <Pressable accessibilityRole="button" onPress={handleRoleAction} style={styles.ownerCard}>
        <View style={styles.ownerIcon}>
          {roleAction.targetRole ? (
            <ArrowLeftRight color={theme.brand} size={22} strokeWidth={2.4} />
          ) : (
            <UserPlus color={theme.brand} size={23} strokeWidth={2.4} />
          )}
        </View>
        <View style={styles.ownerInfo}>
          <Text style={styles.ownerTitle}>{roleAction.title}</Text>
          <Text style={styles.ownerDescription}>{roleAction.description}</Text>
        </View>
        <ChevronRight color={theme.brand} size={21} strokeWidth={2.5} />
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Giao diện</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: theme.brandSoft }]}>
              {isDark ? (
                <Moon color={theme.brand} size={20} strokeWidth={2.3} />
              ) : (
                <Sun color={theme.brand} size={20} strokeWidth={2.3} />
              )}
            </View>
            <View style={styles.menuContent}>
              <Text numberOfLines={1} style={styles.menuLabel}>Chế độ tối</Text>
              <Text style={styles.themeHint}>{isDark ? "Đang dùng giao diện tối" : "Đang dùng giao diện sáng"}</Text>
            </View>
            <Switch
              accessibilityLabel="Chuyển chế độ sáng tối"
              accessibilityRole="switch"
              onValueChange={() => {
                void toggleMode();
              }}
              thumbColor={theme.onBrand}
              trackColor={{ false: theme.divider, true: theme.brand }}
              value={isDark}
            />
          </View>
        </View>
      </View>

      <VerificationSection
        cccdValue={cccdVerified ? "Đã xác minh" : undefined}
        gplxValue={gplxVerified ? "Đã xác minh" : undefined}
        overviewValue={hubVerifiedCount === 2 ? "Đã xác minh" : `${hubVerifiedCount}/2`}
        onCccd={() => setShowCccd(true)}
        onGplx={() => {
          setLicenseReturn("account");
          setShowLicense(true);
        }}
        onOverview={() => setShowHub(true)}
      />

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
        <LogOut color={theme.danger} size={19} strokeWidth={2.4} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </ScrollView>
    <PinSetupModal
      documentType="CCCD"
      visible={showSetupPin}
      onClose={() => setShowSetupPin(false)}
      onSetupDone={() => handleSetupDoneFromAccount()}
    />
    <PinChangeModal
      visible={showChangePin}
      onClose={() => setShowChangePin(false)}
      onSuccess={() => { void refreshPinStatus(); }}
    />
  </>
  );
}

function VerificationSection({
  cccdValue,
  gplxValue,
  overviewValue,
  onCccd,
  onGplx,
  onOverview,
}: {
  cccdValue?: string;
  gplxValue?: string;
  overviewValue: string;
  onCccd: () => void;
  onGplx: () => void;
  onOverview: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <View style={styles.menuCard}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          style={styles.menuRow}
        >
          <View style={[styles.menuIcon, { backgroundColor: theme.successSoft }]}>
            <ShieldCheck color={theme.success} size={20} strokeWidth={2.3} />
          </View>
          <View style={styles.menuContent}>
            <Text numberOfLines={1} style={styles.menuLabel}>
              Xác minh
            </Text>
          </View>
          {expanded ? (
            <ChevronUp color={theme.faint} size={19} strokeWidth={2.4} />
          ) : (
            <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
          )}
        </Pressable>

        {expanded ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={onOverview}
              style={[styles.menuRow, styles.menuDivider, styles.subRowActive]}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.surface }]}>
                <ShieldCheck color={theme.brand} size={20} strokeWidth={2.3} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuLine}>
                  <Text numberOfLines={1} style={styles.menuLabel}>
                    Tổng quan xác minh
                  </Text>
                  <Text style={[styles.menuValue, { color: theme.brand }]}>{overviewValue}</Text>
                </View>
              </View>
              <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onCccd}
              style={[styles.menuRow, styles.menuDivider]}
            >
              <View style={[styles.menuIcon, { backgroundColor: iconBackground(theme.brand) }]}>
                <IdCard color={theme.brand} size={20} strokeWidth={2.3} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuLine}>
                  <Text numberOfLines={1} style={styles.menuLabel}>
                    CCCD / CMND
                  </Text>
                  {cccdValue ? <Text style={[styles.menuValue, { color: theme.brand }]}>{cccdValue}</Text> : null}
                </View>
              </View>
              <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
            </Pressable>

            <Pressable accessibilityRole="button" onPress={onGplx} style={styles.menuRow}>
              <View style={[styles.menuIcon, { backgroundColor: iconBackground(theme.brand) }]}>
                <FileBadge color={theme.brand} size={20} strokeWidth={2.3} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuLine}>
                  <Text numberOfLines={1} style={styles.menuLabel}>
                    Giấy phép lái xe
                  </Text>
                  {gplxValue ? <Text style={[styles.menuValue, { color: theme.brand }]}>{gplxValue}</Text> : null}
                </View>
              </View>
              <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function MenuRow({ item, last, progress }: { item: AccountMenuItem; last: boolean; progress?: number }) {
  const Icon = item.icon;
  const progressPercent: DimensionValue = `${Math.round((progress ?? 0) * 100)}%`;
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.background,
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
    borderColor: theme.border,
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
    backgroundColor: theme.brandSoft,
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
    color: theme.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  profileMeta: {
    color: theme.muted,
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
    backgroundColor: theme.brandSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  roleText: {
    color: theme.brand,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  ownerCard: {
    minHeight: 82,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.brandBorder,
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
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerInfo: {
    minWidth: 0,
    flex: 1,
  },
  ownerTitle: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  ownerDescription: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
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
    borderBottomColor: theme.divider,
  },
  subRowActive: {
    backgroundColor: theme.brandSoft,
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
    color: theme.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  themeHint: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  menuValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
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
    borderColor: theme.dangerBorder,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 24,
  },
  logoutText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: "800",
  },
});
