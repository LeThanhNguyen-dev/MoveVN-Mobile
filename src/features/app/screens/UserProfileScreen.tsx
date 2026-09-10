import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  FileBadge,
  IdCard,
  Landmark,
  LogOut,
  Mail,
  Pencil,
  Phone,
  UserRound,
  X,
} from "lucide-react-native";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { toApiError, updateProfile, uploadAvatar } from "@/features/auth/services/authService";
import { signOut } from "@/features/auth/services/authSession";
import type { AuthUser, UserRole } from "@/features/auth/types";
import { driverLicenseStatusLabel } from "@/features/driverLicenses/driverLicenseDisplay";
import { getMyDriverLicense } from "@/features/driverLicenses/services/driverLicenseService";
import type { DriverLicenseStatusResponse } from "@/features/driverLicenses/types";
import { getMyApplication } from "@/features/owner/services/ownerService";
import type { OwnerApplicationDto } from "@/features/owner/types";
import type { UploadFileInput } from "@/types/upload";

const roleLabels: Record<UserRole, string> = {
  Admin: "Quản trị",
  Staff: "Nhân viên",
  Owner: "Chủ xe",
  Customer: "Khách thuê",
};

const roleBadgeStyles: Record<UserRole, { backgroundColor: string; color: string }> = {
  Admin: { backgroundColor: "#FFE4E6", color: "#BE123C" },
  Staff: { backgroundColor: "#CFFAFE", color: "#0E7490" },
  Owner: { backgroundColor: "#FEF3C7", color: "#B45309" },
  Customer: { backgroundColor: "#DBEAFE", color: "#1D4ED8" },
};

type ExpandedKey = "cccd" | "gplx" | "bank" | null;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function maskAccountNumber(value?: string | null) {
  if (!value) return "-";
  const digits = value.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return `****${digits.slice(-4)}`;
}

export default function UserProfileScreen({ onBack, user }: { onBack: () => void; user: AuthUser }) {
  const updateUser = useAuthStore((state) => state.updateUser);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<UploadFileInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [expandedKey, setExpandedKey] = useState<ExpandedKey>(null);
  const [driverLicense, setDriverLicense] = useState<DriverLicenseStatusResponse | null>(null);
  const [ownerApp, setOwnerApp] = useState<OwnerApplicationDto | null>(null);

  useEffect(() => {
    let ignore = false;
    void Promise.allSettled([getMyDriverLicense(), getMyApplication()]).then(([licenseResult, appResult]) => {
      if (ignore) return;
      if (licenseResult.status === "fulfilled") setDriverLicense(licenseResult.value);
      if (appResult.status === "fulfilled" && appResult.value?.id > 0) setOwnerApp(appResult.value);
    });
    return () => {
      ignore = true;
    };
  }, []);

  function toggleExpanded(key: Exclude<ExpandedKey, null>) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  function handleCloseSheet() {
    if (isSaving) return;
    setSheetVisible(false);
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setAvatarPreview(null);
    setAvatarFile(null);
    setEditError("");
  }

  function handleOpenSheet() {
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setAvatarPreview(null);
    setAvatarFile(null);
    setEditError("");
    setSheetVisible(true);
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setEditError("Cần quyền truy cập thư viện ảnh để đổi ảnh đại diện.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    setAvatarPreview(asset.uri);
    setAvatarFile({
      name: asset.fileName ?? "avatar.jpg",
      type: asset.mimeType ?? "image/jpeg",
      uri: asset.uri,
    });
  }

  async function handleSave() {
    if (!fullName.trim()) {
      setEditError("Vui lòng nhập họ và tên.");
      return;
    }
    setIsSaving(true);
    setEditError("");
    try {
      const updated = await updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null });
      let avatarUrl = updated.avatarUrl ?? user.avatarUrl ?? null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }
      // Backend UserResponse không trả về roles nên giữ lại roles cũ,
      // giống web ProfilePage (nếu mất roles sẽ crash ở roleFor trong auth store).
      await updateUser({
        ...user,
        ...updated,
        avatarUrl,
        roles: updated.roles ?? user.roles,
      });
      setSheetVisible(false);
      setAvatarPreview(null);
      setAvatarFile(null);
    } catch (error) {
      setEditError(toApiError(error).message);
    } finally {
      setIsSaving(false);
    }
  }

  const sheetAvatarSource = avatarPreview ?? user.avatarUrl ?? null;
  const cccdVerified = ownerApp?.nationalIdVerified ?? false;
  const gplxVerified = driverLicense?.verified ?? false;
  const bankCompleted = ownerApp?.bankInfoCompleted ?? false;

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color="#101936" size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Thông tin tài khoản</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <Pressable
            accessibilityLabel="Chỉnh sửa thông tin"
            accessibilityRole="button"
            onPress={handleOpenSheet}
            style={styles.pencilButton}
          >
            <Pencil color="#6B19FF" size={18} strokeWidth={2.3} />
          </Pressable>

          <View style={styles.profileRow}>
            <View style={styles.avatarLarge}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <UserRound color="#6B19FF" size={34} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text numberOfLines={2} style={styles.name}>
                {user.fullName}
              </Text>
              <View style={styles.roleRow}>
                {user.roles.map((role) => (
                  <View key={role} style={[styles.roleBadge, { backgroundColor: roleBadgeStyles[role].backgroundColor }]}>
                    <Text style={[styles.roleBadgeText, { color: roleBadgeStyles[role].color }]}>{roleLabels[role]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Thông tin tài khoản</Text>

          <View style={styles.row}>
            <View style={[styles.rowIcon, styles.rowIconStatic]}>
              <Mail color="#6B19FF" size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text numberOfLines={1} style={styles.rowValue}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={[styles.rowIcon, styles.rowIconStatic]}>
              <Phone color="#6B19FF" size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Số điện thoại</Text>
              <Text style={styles.rowValue}>{user.phone || "Chưa cập nhật"}</Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          <Pressable accessibilityRole="button" onPress={() => toggleExpanded("cccd")} style={styles.row}>
            <View style={[styles.rowIcon, cccdVerified ? styles.rowIconVerified : styles.rowIconUnverified]}>
              <IdCard color={cccdVerified ? "#059669" : "#94A3B8"} size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>CCCD</Text>
              <VerifyBadge verified={cccdVerified} />
            </View>
            <ChevronDown
              color="#746F7E"
              size={18}
              strokeWidth={2.3}
              style={expandedKey === "cccd" ? styles.chevronOpen : null}
            />
          </Pressable>
          {expandedKey === "cccd" ? (
            <View style={styles.detailBox}>
              {ownerApp ? (
                <>
                  <DetailLine label="Số CCCD" value={ownerApp.nationalIdNumber || "-"} />
                  <DetailLine label="Họ tên trên CCCD" value={ownerApp.fullName || "-"} />
                  <DetailLine
                    label="Trạng thái"
                    value={cccdVerified ? "Đã xác minh" : driverLicenseStatusLabel[ownerApp.nationalIdRequestStatus ?? ""] ?? "Chưa xác minh"}
                  />
                </>
              ) : (
                <Text style={styles.detailEmpty}>Bạn chưa xác minh CCCD.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.rowDivider} />

          <Pressable accessibilityRole="button" onPress={() => toggleExpanded("gplx")} style={styles.row}>
            <View style={[styles.rowIcon, gplxVerified ? styles.rowIconVerified : styles.rowIconUnverified]}>
              <FileBadge color={gplxVerified ? "#059669" : "#94A3B8"} size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>GPLX</Text>
              <VerifyBadge verified={gplxVerified} />
            </View>
            <ChevronDown
              color="#746F7E"
              size={18}
              strokeWidth={2.3}
              style={expandedKey === "gplx" ? styles.chevronOpen : null}
            />
          </Pressable>
          {expandedKey === "gplx" ? (
            <View style={styles.detailBox}>
              {driverLicense ? (
                <>
                  <DetailLine label="Hạng GPLX" value={driverLicense.licenseClass || "-"} />
                  <DetailLine label="Số GPLX" value={driverLicense.driverLicenseNumber || "-"} />
                  <DetailLine label="Xác minh lúc" value={formatDate(driverLicense.verifiedAt)} />
                  <DetailLine
                    label="Loại xe"
                    value={driverLicense.verifiedVehicleTypes.length > 0 ? driverLicense.verifiedVehicleTypes.join(", ") : "-"}
                  />
                  {!gplxVerified && driverLicense.status ? (
                    <DetailLine label="Trạng thái" value={driverLicenseStatusLabel[driverLicense.status] ?? driverLicense.status} />
                  ) : null}
                </>
              ) : (
                <Text style={styles.detailEmpty}>Chưa có thông tin GPLX.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.rowDivider} />

          <Pressable accessibilityRole="button" onPress={() => toggleExpanded("bank")} style={styles.row}>
            <View style={[styles.rowIcon, bankCompleted ? styles.rowIconVerified : styles.rowIconUnverified]}>
              <Landmark color={bankCompleted ? "#059669" : "#94A3B8"} size={18} strokeWidth={2.3} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Ngân hàng</Text>
              <VerifyBadge completed={bankCompleted} verified={bankCompleted} />
            </View>
            <ChevronDown
              color="#746F7E"
              size={18}
              strokeWidth={2.3}
              style={expandedKey === "bank" ? styles.chevronOpen : null}
            />
          </Pressable>
          {expandedKey === "bank" ? (
            <View style={styles.detailBox}>
              {ownerApp && bankCompleted ? (
                <>
                  <DetailLine label="Ngân hàng" value={ownerApp.bankName || "-"} />
                  <DetailLine label="Số tài khoản" value={maskAccountNumber(ownerApp.bankAccountNumber)} />
                  <DetailLine label="Chủ tài khoản" value={ownerApp.bankAccountHolderName || "-"} />
                </>
              ) : (
                <Text style={styles.detailEmpty}>Chưa cập nhật thông tin ngân hàng.</Text>
              )}
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel="Đăng xuất"
          accessibilityRole="button"
          onPress={() => {
            void signOut();
          }}
          style={styles.logoutButton}
        >
          <LogOut color="#FFFFFF" size={18} strokeWidth={2.3} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      <Modal animationType="slide" onRequestClose={handleCloseSheet} transparent visible={sheetVisible}>
        <View style={styles.sheetOverlay}>
          <Pressable
            accessibilityLabel="Đóng"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleCloseSheet}
            style={styles.sheetBackdrop}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityLabel="Đóng chỉnh sửa"
                accessibilityRole="button"
                disabled={isSaving}
                onPress={handleCloseSheet}
                style={styles.sheetCloseButton}
              >
                <X color="#101936" size={22} strokeWidth={2.3} />
              </Pressable>
              <Text style={styles.sheetTitle}>Chỉnh sửa thông tin</Text>
              <View style={styles.sheetHeaderSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetAvatarWrap}>
                <Pressable
                  accessibilityLabel="Đổi ảnh đại diện"
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => {
                    void handlePickAvatar();
                  }}
                  style={styles.avatarLarge}
                >
                  {sheetAvatarSource ? (
                    <Image source={{ uri: sheetAvatarSource }} style={styles.avatarImage} />
                  ) : (
                    <UserRound color="#6B19FF" size={34} />
                  )}
                  <View style={styles.cameraBadge}>
                    <Camera color="#FFFFFF" size={14} strokeWidth={2.3} />
                  </View>
                </Pressable>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Họ và tên</Text>
                <TextInput
                  autoCapitalize="words"
                  editable={!isSaving}
                  placeholder="Nhập họ và tên"
                  placeholderTextColor="#A7A1B3"
                  style={styles.fieldInput}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Số điện thoại</Text>
                <TextInput
                  editable={!isSaving}
                  keyboardType="phone-pad"
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="#A7A1B3"
                  style={styles.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.fieldReadonly}>{user.email}</Text>
              </View>

              {editError ? <Text style={styles.sheetError}>{editError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void handleSave();
                }}
                style={[styles.sheetSaveButton, isSaving ? styles.saveButtonDisabled : null]}
              >
                <Text style={styles.saveText}>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function VerifyBadge({ completed, verified }: { completed?: boolean; verified: boolean }) {
  if (verified) {
    return (
      <View style={[styles.badge, styles.badgeVerified]}>
        <Text style={[styles.badgeText, styles.badgeTextVerified]}>{completed ? "Đã hoàn thành" : "Đã xác minh"}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeUnverified]}>
      <Text style={[styles.badgeText, styles.badgeTextUnverified]}>Chưa xác minh</Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  topBarTitle: {
    color: "#101936",
    fontSize: 17,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 14,
  },
  profileCard: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E1F2",
    padding: 16,
  },
  pencilButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    zIndex: 1,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingRight: 36,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1E7FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#6B19FF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  name: {
    color: "#101936",
    fontSize: 18,
    fontWeight: "800",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  roleBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E1F2",
    padding: 16,
  },
  cardTitle: {
    color: "#101936",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconStatic: {
    backgroundColor: "#F1E7FF",
  },
  rowIconVerified: {
    backgroundColor: "#D1FAE5",
  },
  rowIconUnverified: {
    backgroundColor: "#F1F5F9",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowLabel: {
    color: "#746F7E",
    fontSize: 12,
    fontWeight: "700",
  },
  rowValue: {
    color: "#101936",
    fontSize: 15,
    fontWeight: "700",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#E8E1F2",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeVerified: {
    backgroundColor: "#D1FAE5",
  },
  badgeUnverified: {
    backgroundColor: "#F1F5F9",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextVerified: {
    color: "#059669",
  },
  badgeTextUnverified: {
    color: "#94A3B8",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  detailBox: {
    backgroundColor: "#FAF6FF",
    borderWidth: 1,
    borderColor: "#E8E1F2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    gap: 2,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  detailLabel: {
    color: "#746F7E",
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    color: "#101936",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
  },
  detailEmpty: {
    color: "#746F7E",
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 6,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#6B19FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 25, 54, 0.45)",
  },
  sheet: {
    height: "67%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E1F2",
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  sheetTitle: {
    color: "#101936",
    fontSize: 16,
    fontWeight: "800",
  },
  sheetHeaderSpacer: {
    width: 40,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  sheetAvatarWrap: {
    alignItems: "center",
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: "#746F7E",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldInput: {
    color: "#101936",
    fontSize: 15,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#E8E1F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#FAF6FF",
  },
  fieldReadonly: {
    color: "#746F7E",
    fontSize: 15,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#E8E1F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#F1F5F9",
  },
  sheetError: {
    color: "#F43F5E",
    fontSize: 13,
    fontWeight: "600",
  },
  sheetSaveButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#6B19FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
});
