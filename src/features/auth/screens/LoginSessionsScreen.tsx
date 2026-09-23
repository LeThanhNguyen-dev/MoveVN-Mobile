import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { ArrowLeft, Monitor, RefreshCw, ShieldCheck, Smartphone } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { clearSession, useAuthStore } from "../hooks/useAuth";
import { getLoginSessions, revokeLoginSession, revokeOtherLoginSessions, type LoginSession } from "../services/loginSessionService";
import { getApiErrorMessage } from "@/services/apiClient";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

function describeDevice(deviceType?: string | null) {
  if (!deviceType) return { label: "Thiết bị không xác định", mobile: false };
  const mobile = /android|iphone|ipad|mobile/i.test(deviceType);
  return { label: deviceType, mobile };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

export default function LoginSessionsScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentSessionId = useAuthStore((state) => state.token?.sessionId ?? "");
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeSessions = useMemo(() => sessions.filter((session) => session.isActive), [sessions]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setSessions(await getLoginSessions());
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Không thể tải danh sách phiên đăng nhập."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmAction(title: string, message: string, onConfirm: () => void) {
    Alert.alert(title, message, [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: onConfirm },
    ]);
  }

  async function handleRevoke(session: LoginSession) {
    setBusyId(session.sessionId);
    setError("");
    setNotice("");
    try {
      await revokeLoginSession(session.sessionId);
      if (session.sessionId === currentSessionId) {
        await clearSession();
        return;
      }
      setSessions((items) =>
        items.map((item) => (item.sessionId === session.sessionId ? { ...item, isActive: false } : item)),
      );
      setNotice("Đã đăng xuất thiết bị. Phiên đăng nhập trên thiết bị đã được thu hồi.");
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Không thể thu hồi phiên đăng nhập."));
    } finally {
      setBusyId("");
    }
  }

  async function handleRevokeOthers() {
    if (!currentSessionId) return;
    setBusyId("others");
    setError("");
    setNotice("");
    try {
      await revokeOtherLoginSessions(currentSessionId);
      setSessions((items) =>
        items.map((item) => (item.sessionId === currentSessionId ? item : { ...item, isActive: false })),
      );
      setNotice("Đã đăng xuất các thiết bị khác. Tài khoản chỉ còn hoạt động trên thiết bị này.");
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Không thể thu hồi các phiên đăng nhập khác."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Phiên đăng nhập</Text>
        <Pressable
          accessibilityLabel="Tải lại"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => { void load(); }}
          style={styles.backButton}
        >
          <RefreshCw color={theme.brand} size={19} strokeWidth={2.3} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Monitor color="#2563EB" size={22} strokeWidth={2.3} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>Phiên đăng nhập</Text>
              <Text style={styles.cardDescription}>Kiểm tra và đăng xuất các thiết bị đang truy cập tài khoản.</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!currentSessionId || activeSessions.length < 2 || busyId !== ""}
            onPress={() =>
              confirmAction("Đăng xuất thiết bị khác?", "Đăng xuất tất cả thiết bị khác?", () => { void handleRevokeOthers(); })
            }
            style={[styles.outlineButton, (!currentSessionId || activeSessions.length < 2 || busyId !== "") && styles.disabled]}
          >
            <Text style={styles.outlineText}>
              {busyId === "others" ? "Đang xử lý..." : "Đăng xuất thiết bị khác"}
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {loading ? (
            <Text style={styles.muted}>Đang tải danh sách...</Text>
          ) : sessions.length === 0 ? (
            <Text style={styles.muted}>Chưa có dữ liệu phiên đăng nhập mới.</Text>
          ) : (
            <View style={styles.list}>
              {sessions.map((session) => {
                const device = describeDevice(session.deviceType);
                const DeviceIcon = device.mobile ? Smartphone : Monitor;
                const isCurrent = session.sessionId === currentSessionId;
                const busy = busyId === session.sessionId;
                return (
                  <View key={session.sessionId} style={styles.row}>
                    <View style={styles.deviceIcon}>
                      <DeviceIcon color={theme.muted} size={20} strokeWidth={2.3} />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitleLine}>
                        <Text numberOfLines={1} style={styles.rowTitle}>
                          {device.label}
                        </Text>
                        {isCurrent ? (
                          <View style={styles.currentPill}>
                            <ShieldCheck color={theme.success} size={12} strokeWidth={2.5} />
                            <Text style={styles.currentPillText}>Thiết bị này</Text>
                          </View>
                        ) : null}
                        {!session.isActive ? (
                          <View style={styles.expiredPill}>
                            <Text style={styles.expiredPillText}>Đã hết phiên</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.rowMeta}>IP: {session.ipAddress || "Không xác định"}</Text>
                      <Text style={styles.rowMetaSmall}>Đăng nhập lúc {formatDate(session.signedInAt)}</Text>
                    </View>
                    {session.isActive ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() =>
                          confirmAction("Đăng xuất thiết bị?", "Bạn có chắc muốn đăng xuất thiết bị này?", () => { void handleRevoke(session); })
                        }
                        style={[styles.smallButton, busy && styles.disabled]}
                      >
                        <Text style={styles.smallButtonText}>{busy ? "..." : "Đăng xuất"}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
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
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: "#DBEAFE",
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    cardDescription: { color: theme.muted, fontSize: 12, lineHeight: 17, fontWeight: "600" },
    outlineButton: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    outlineText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.55 },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    notice: { color: theme.success, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    list: { gap: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    deviceIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    rowTitle: { color: theme.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
    currentPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: 999,
      backgroundColor: theme.successSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    currentPillText: { color: theme.success, fontSize: 11, fontWeight: "800" },
    expiredPill: {
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    expiredPillText: { color: theme.muted, fontSize: 11, fontWeight: "700" },
    rowMeta: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    rowMetaSmall: { color: theme.faint, fontSize: 12, fontWeight: "600" },
    smallButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    smallButtonText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  });
