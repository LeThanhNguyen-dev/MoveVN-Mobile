import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { getDisputeById } from "@/features/disputes/disputeService";
import type { DisputeDetailResponse } from "@/features/disputes/types";
import { disputeStatusLabel, disputeTypeLabel } from "@/features/disputes/disputeLabels";
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

export default function DisputeDetailScreen({
  disputeId,
  onBack,
}: {
  disputeId: number;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [detail, setDetail] = useState<DisputeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await getDisputeById(disputeId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được chi tiết tranh chấp."));
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Tranh chấp #{disputeId}
        </Text>
        <View style={styles.backButton} />
      </View>
      {loading || !detail ? (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={theme.brand} />
          ) : (
            <>
              <Text style={styles.title}>Không tải được</Text>
              <Text style={styles.muted}>{error}</Text>
              <Pressable style={styles.retry} onPress={() => void load()}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.code}>{(detail.bookingCode ?? "").toUpperCase()}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{disputeStatusLabel(detail.status)}</Text>
              </View>
            </View>
            <Row label="Loại" value={disputeTypeLabel(detail.reportType)} />
            <Row label="Mở lúc" value={formatDateTime(detail.createdAt)} />
            <Row label="Người mở" value={detail.openedByName || `#${detail.openedBy}`} />
            {detail.assignedStaffName ? <Row label="Nhân viên xử lý" value={detail.assignedStaffName} /> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mô tả</Text>
            <Text style={styles.text}>{detail.description}</Text>
            {detail.evidenceUrls ? <Text style={styles.muted}>Chứng cứ: {detail.evidenceUrls}</Text> : null}
          </View>

          {detail.resolution || detail.finalCompensationAmount != null ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kết quả xử lý</Text>
              {detail.resolution ? <Text style={styles.text}>{detail.resolution}</Text> : null}
              {detail.finalCompensationAmount != null ? (
                <Row label="Bồi thường chốt" value={formatMoney(detail.finalCompensationAmount)} strong />
              ) : null}
              {detail.decisionIssuedAt ? <Row label="Ngày quyết định" value={formatDateTime(detail.decisionIssuedAt)} /> : null}
            </View>
          ) : null}

          {detail.evidenceSubmissions.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bổ sung chứng cứ ({detail.evidenceSubmissions.length})</Text>
              {detail.evidenceSubmissions.map((s) => (
                <View key={s.id} style={styles.block}>
                  <Text style={styles.blockTitle}>
                    {s.submittedByName || `#${s.submittedBy}`} · {formatDateTime(s.createdAt)}
                  </Text>
                  <Text style={styles.text}>{s.message}</Text>
                  {s.evidenceUrls ? <Text style={styles.muted}>{s.evidenceUrls}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {detail.auditLogs.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lịch sử xử lý</Text>
              {detail.auditLogs.map((log) => (
                <Text key={log.id} style={styles.muted}>
                  {formatDateTime(log.createdAt)} · {log.actorName || "Hệ thống"}: {log.action}
                  {log.newValue ? ` → ${log.newValue}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, { color: theme.text, fontWeight: strong ? "800" : "600" }]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  label: { fontSize: 13 },
  value: { fontSize: 13, textAlign: "right", flexShrink: 1 },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    body: { padding: 16, gap: 12 },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 6,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    code: { color: theme.faint, fontSize: 11, fontWeight: "700", flex: 1 },
    badge: { borderRadius: 999, backgroundColor: theme.brandSoft, paddingHorizontal: 9, paddingVertical: 4 },
    badgeText: { color: theme.brand, fontSize: 11, fontWeight: "800" },
    text: { color: theme.text, fontSize: 14, lineHeight: 21 },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    block: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 8, gap: 4 },
    blockTitle: { color: theme.text, fontSize: 13, fontWeight: "700" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
    title: { color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    retry: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: theme.brandSoft, borderRadius: 12 },
    retryText: { color: theme.brand, fontSize: 13, fontWeight: "700" },
  });
