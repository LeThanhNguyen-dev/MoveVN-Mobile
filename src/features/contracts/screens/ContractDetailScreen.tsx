import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Download, History, KeyRound, LockKeyhole, PenLine, X } from "lucide-react-native";
import { DetailButton, DetailHeader, DetailPill, DetailSectionHeader } from "@/features/booking/components/detail/BookingDetailUI";
import { detailFont as font, useDetailTheme, type DetailPalette } from "@/features/vehicles/components/detail/detailTheme";
import ContractDocument from "@/features/contracts/components/ContractDocument";
import ContractPinFlow from "@/features/contracts/components/ContractPinFlow";
import ContractSignDialog from "@/features/contracts/components/ContractSignDialog";
import {
  downloadContractPdf,
  getContractAudit,
  getContractsByBooking,
  tryViewWithGrant,
  type ContractAuditLogItem,
} from "@/features/contracts/contractService";
import { auditEntryView, canSignContract, contractTone } from "@/features/contracts/contractUi";
import { CONTRACT_STATUS_LABELS, type ContractContent, type ContractSummary } from "@/features/contracts/types";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { formatDateTime } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

type Phase = "loading" | "locked" | "ready";

/** Trang xem hợp đồng dạng tài liệu (một trang giấy liền mạch) + lịch sử trong popup riêng. */
export default function ContractDetailScreen({
  contract,
  onBack,
}: {
  contract: ContractSummary;
  onBack: () => void;
}) {
  const { p } = useDetailTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(p), [p]);
  const userId = useAuthStore((s) => s.user?.userId ?? 0);
  const userEmail = useAuthStore((s) => s.user?.email ?? "");

  const [summary, setSummary] = useState(contract);
  const [content, setContent] = useState<ContractContent | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<"view" | "download">("view");
  const [fileBusy, setFileBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<ContractAuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  const loadContent = useCallback(async () => {
    setPhase("loading");
    try {
      setContent(await tryViewWithGrant(contract.id));
      setPhase("ready");
    } catch {
      setContent(null);
      setPhase("locked");
    }
  }, [contract.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!auditOpen) return;
    let active = true;
    setAuditLoading(true);
    setAuditError("");
    getContractAudit(summary.id)
      .then((items) => {
        if (active) setAudit(items);
      })
      .catch((err) => {
        if (active) setAuditError(getApiErrorMessage(err, "Không tải được lịch sử hợp đồng."));
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auditOpen, summary.id]);

  async function handleDownload(verified = false) {
    if (fileBusy) return;
    setFileBusy(true);
    try {
      await downloadContractPdf(summary);
    } catch (err) {
      if (!verified) {
        setPinPurpose("download");
        setPinOpen(true);
      } else {
        Alert.alert("Thất bại", getApiErrorMessage(err, "Không tải được PDF. Vui lòng thử lại."));
      }
    } finally {
      setFileBusy(false);
    }
  }

  async function refreshAfterSign() {
    setSignOpen(false);
    try {
      const list = await getContractsByBooking(summary.bookingId);
      const updated = list.find((item) => item.id === summary.id);
      if (updated) setSummary(updated);
    } catch {
      // Danh sách chỉ dùng để cập nhật nhãn; giữ nguyên bản đang xem nếu lỗi.
    }
    try {
      setContent(await tryViewWithGrant(summary.id));
      setPhase("ready");
    } catch {
      // Giữ nội dung đang hiển thị.
    }
  }

  const signable = phase === "ready" && canSignContract(summary, userId);
  const statusLabel = CONTRACT_STATUS_LABELS[summary.status] ?? summary.status;
  const signedCount = (summary.ownerSignStatus === "Signed" ? 1 : 0) + (summary.customerSignStatus === "Signed" ? 1 : 0);

  return (
    <View style={styles.page}>
      <DetailHeader
        kicker="Hợp đồng thuê xe"
        title={summary.contractNumber}
        onBack={onBack}
        style={styles.header}
        right={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lịch sử hợp đồng"
              hitSlop={6}
              onPress={() => setAuditOpen(true)}
              style={styles.iconButton}
            >
              <History color={p.ink} size={17} strokeWidth={2.1} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tải PDF hợp đồng"
              hitSlop={6}
              disabled={fileBusy}
              onPress={() => void handleDownload()}
              style={styles.iconButton}
            >
              {fileBusy ? (
                <ActivityIndicator size="small" color={p.brand} />
              ) : (
                <Download color={p.ink} size={17} strokeWidth={2.1} />
              )}
            </Pressable>
          </View>
        }
      />

      <View style={styles.toolbar}>
        <DetailPill label={statusLabel} tone={contractTone(summary.status)} />
        <Text style={styles.toolbarMeta}>{signedCount}/2 bên đã ký</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {phase === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={p.brand} />
            <Text style={styles.centerText}>Đang mở hợp đồng…</Text>
          </View>
        ) : phase === "locked" ? (
          <View style={[styles.paper, styles.lockedPaper]}>
            <View style={styles.lockBadge}>
              <LockKeyhole color={p.brand} size={20} strokeWidth={2.1} />
            </View>
            <Text style={styles.lockTitle}>Hợp đồng được bảo vệ</Text>
            <Text style={styles.lockText}>
              Nhập mã PIN của ứng dụng để mở nội dung hợp đồng. Mã OTP chỉ được dùng khi ký.
            </Text>
            <View style={styles.lockActions}>
              <DetailButton
                icon={KeyRound}
                label="Mở khóa bằng PIN"
                onPress={() => {
                  setPinPurpose("view");
                  setPinOpen(true);
                }}
                style={styles.lockButton}
              />
              <Pressable accessibilityRole="button" onPress={() => void loadContent()} style={styles.lockRetry}>
                <Text style={styles.lockRetryText}>Thử tải lại</Text>
              </Pressable>
            </View>
          </View>
        ) : content ? (
          <View style={styles.paper}>
            <ContractDocument content={content} />
          </View>
        ) : null}
      </ScrollView>

      {signable ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <DetailButton
            icon={PenLine}
            label="Ký hợp đồng"
            onPress={() => setSignOpen(true)}
            style={styles.footerButton}
          />
        </View>
      ) : null}

      <Modal visible={auditOpen} transparent animationType="slide" onRequestClose={() => setAuditOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng lịch sử hợp đồng"
            style={StyleSheet.absoluteFill}
            onPress={() => setAuditOpen(false)}
          />
          <View style={[styles.auditSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.auditHandle} />
            <View style={styles.auditHeader}>
              <DetailSectionHeader
                icon={History}
                title="Lịch sử hợp đồng"
                subtitle={auditLoading ? "Đang tải…" : `${audit.length} thao tác được ghi nhận`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                hitSlop={6}
                onPress={() => setAuditOpen(false)}
                style={styles.auditClose}
              >
                <X color={p.muted} size={16} strokeWidth={2.2} />
              </Pressable>
            </View>
            {auditLoading ? (
              <ActivityIndicator color={p.brand} style={styles.auditLoading} />
            ) : auditError ? (
              <Text style={styles.auditEmpty}>{auditError}</Text>
            ) : audit.length === 0 ? (
              <Text style={styles.auditEmpty}>Chưa có thao tác nào được ghi nhận.</Text>
            ) : (
              <ScrollView style={styles.auditScroll} contentContainerStyle={styles.auditList} showsVerticalScrollIndicator={false}>
                {audit.map((entry, index) => {
                  const view = auditEntryView(entry);
                  return (
                    <View key={`${entry.timestamp}-${index}`} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View style={[styles.timelineDot, index === 0 && styles.timelineDotFirst]} />
                        {index < audit.length - 1 ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineAction}>{view.action}</Text>
                        <Text style={styles.timelineMeta}>
                          {formatDateTime(entry.timestamp)} · {view.actor}
                        </Text>
                        {view.note ? <Text style={styles.timelineNote}>{view.note}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <ContractSignDialog
        contract={signOpen ? summary : null}
        userId={userId}
        onClose={() => setSignOpen(false)}
        onSigned={() => void refreshAfterSign()}
      />

      {pinOpen ? (
        <ContractPinFlow
          contract={summary}
          userEmail={userEmail}
          onClose={() => setPinOpen(false)}
          onVerified={(detail) => {
            setPinOpen(false);
            setContent(detail);
            setPhase("ready");
            if (pinPurpose === "download") void handleDownload(true);
          }}
        />
      ) : null}
    </View>
  );
}

const createStyles = (p: DetailPalette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: p.canvas },
    header: { paddingTop: 0, paddingBottom: 8 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 2,
      paddingBottom: 8,
    },
    toolbarMeta: { color: p.faint, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 },
    scrollBody: { paddingHorizontal: 10, paddingBottom: 28, gap: 10 },
    paper: {
      backgroundColor: p.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.line,
      paddingHorizontal: 18,
      paddingVertical: 20,
      shadowColor: p.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 64 },
    centerText: { color: p.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 16 },
    lockedPaper: { alignItems: "center", gap: 8, paddingVertical: 40 },
    lockBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.brandSoft,
      marginBottom: 2,
    },
    lockTitle: { color: p.ink, fontFamily: font.display, fontSize: 15.5, lineHeight: 20, letterSpacing: -0.2, textAlign: "center" },
    lockText: {
      color: p.muted,
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      textAlign: "center",
      maxWidth: 280,
    },
    lockActions: { width: "100%", maxWidth: 300, gap: 4, marginTop: 8 },
    lockButton: { width: "100%" },
    lockRetry: { alignItems: "center", paddingVertical: 9 },
    lockRetryText: { color: p.brand, fontFamily: font.bold, fontSize: 12 },
    footer: {
      paddingHorizontal: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: p.line,
      backgroundColor: p.surface,
    },
    footerButton: { width: "100%" },
    backdrop: { flex: 1, backgroundColor: "rgba(9,7,15,0.45)", justifyContent: "flex-end" },
    auditSheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      paddingHorizontal: 16,
      maxHeight: "80%",
      gap: 10,
    },
    auditHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: p.line,
      marginBottom: 2,
    },
    auditHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    auditClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surfaceAlt,
      marginTop: 2,
    },
    auditLoading: { paddingVertical: 28 },
    auditScroll: { flexShrink: 1 },
    auditEmpty: {
      color: p.muted,
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      paddingVertical: 24,
      textAlign: "center",
    },
    auditList: { paddingTop: 2, paddingBottom: 8 },
    timelineRow: { flexDirection: "row", gap: 10 },
    timelineRail: { width: 10, alignItems: "center" },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.line, marginTop: 5 },
    timelineDotFirst: { backgroundColor: p.brand },
    timelineLine: { flex: 1, width: 1.5, backgroundColor: p.line, marginVertical: 2 },
    timelineBody: { flex: 1, paddingBottom: 14, gap: 2 },
    timelineAction: { color: p.ink, fontFamily: font.semibold, fontSize: 11.5, lineHeight: 16 },
    timelineMeta: { color: p.faint, fontFamily: font.regular, fontSize: 10, lineHeight: 14 },
    timelineNote: { color: p.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 },
  });
