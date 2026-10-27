import AppScreenHeader from "@/components/ui/AppScreenHeader";
import Text from "@/components/AppText";
import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import * as ImagePicker from "expo-image-picker";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import InspectionReportCard from "@/features/booking/components/InspectionReportCard";
import {
  compensationDirectionLabels,
  disputeStatusLabels,
  evidenceList,
  formatDisputeDateTime,
  formatDisputeMoney,
  problemLabels,
  settlementMethodLabels,
} from "@/features/disputes/components/disputeLabels";
import { getDisputeStatusStyle } from "@/features/disputes/components/disputeStatusStyles";
import {
  auditActionLabels,
  formatAuditRole,
  parseAuditDetailEntries,
} from "@/features/admin/auditLogLabels";
import BookingAssistance from "@/features/booking/components/BookingAssistance";
import CheckoutDecisionSummary from "@/features/disputes/components/CheckoutDecisionSummary";
import TrafficFinePanel from "@/features/disputes/components/TrafficFinePanel";
import {
  acceptDisputeResolution,
  addDisputeEvidence,
  confirmExternalSettlement,
  escalateDispute,
  getDisputeById,
  uploadDisputeEvidenceImages,
} from "@/features/disputes/disputeService";
import type { DisputeDetailResponse } from "@/features/disputes/types";

const MAX_EVIDENCE_IMAGES = 6;
const MAX_EVIDENCE_IMAGE_SIZE = 5 * 1024 * 1024;

// Port RN của drawer chi tiết trong FrontEnd DisputePage (chỉ luồng Customer/Owner).
export default function DisputeDetailScreen({
  disputeId,
  onBack,
}: {
  disputeId: number;
  onBack: () => void;
}) {
  const { theme, mode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = useAuthStore((state) => state.user?.userId);

  const requestId = useRef(0);
  const actionLock = useRef(false);
  const [detail, setDetail] = useState<DisputeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["info", "actions", "settlement", "evidenceRequest", "resolution"]),
  );
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<{ uri: string; name: string; mime: string; size?: number | null }[]>([]);
  const [escalationReason, setEscalationReason] = useState("");
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    const current = ++requestId.current;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const result = await getDisputeById(disputeId);
      if (current === requestId.current) setDetail(result);
    } catch (err) {
      if (current === requestId.current && !silent) setError(getApiErrorMessage(err, "Không thể tải chi tiết tranh chấp."));
      await load(true);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void load();
    const sync = () => { if (AppState.currentState === "active" && !actionLock.current) void load(true); };
    const interval = setInterval(sync, 15000);
    const appState = AppState.addEventListener("change", state => { if (state === "active") sync(); });
    const unsubscribe = useNotificationStore.subscribe((state, previous) => {
      if (state.revision === previous.revision) return;
      const relevant = Object.values(state.updates).some(update => {
        if (update.revision <= previous.revision || previous.updates[update.item.id]) return false;
        try { return JSON.parse(update.item.dataJson ?? "{}").disputeId === disputeId; } catch { return false; }
      });
      if (relevant) sync();
    });
    return () => { requestId.current++; clearInterval(interval); appState.remove(); unsubscribe(); };
  }, [load, disputeId]);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function acceptResult() {
    if (!detail) return;
    if (actionLock.current) return;
    actionLock.current = true; requestId.current++;
    setError("");
    setBusy(true);
    try {
      setDetail(await acceptDisputeResolution(detail.id, detail.updatedAt));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xác nhận kết quả."));
      await load(true);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function confirmExternal() {
    if (!detail) return;
    if (actionLock.current) return;
    actionLock.current = true; requestId.current++;
    setError("");
    setBusy(true);
    try {
      setDetail(await confirmExternalSettlement(detail.id, detail.updatedAt));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xác nhận thanh toán."));
      await load(true);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function submitEscalate() {
    if (!detail || !escalationReason.trim()) return;
    if (actionLock.current) return;
    actionLock.current = true; requestId.current++;
    setError("");
    setBusy(true);
    try {
      setDetail(
        await escalateDispute(detail.id, {
          resolution: escalationReason.trim(),
          compensationDirection: "NoCompensation",
          settlementMethod: "ExternalOnly",
          updatedAt: detail.updatedAt,
        }),
      );
      setEscalationReason("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể chuyển Admin."));
      await load(true);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function pickEvidence() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_EVIDENCE_IMAGES,
    });
    if (result.canceled) return;
    const picked = result.assets
      .filter((a) => a.uri)
      .slice(0, MAX_EVIDENCE_IMAGES)
      .map((a) => ({ uri: a.uri ?? "", name: a.fileName ?? "bang-chung.jpg", mime: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null }));
    const invalid = picked.find(
      (f) => !["image/jpeg", "image/png", "image/webp"].includes(f.mime) || (f.size != null && f.size > MAX_EVIDENCE_IMAGE_SIZE),
    );
    if (invalid) {
      setError("Chỉ nhận JPG, PNG, WebP và mỗi ảnh phải dưới 5MB.");
      return;
    }
    setEvidenceFiles((prev) => [...prev, ...picked].slice(0, MAX_EVIDENCE_IMAGES));
    setError("");
  }

  async function submitEvidence() {
    if (!detail || (!evidenceMessage.trim() && evidenceFiles.length === 0)) return;
    if (actionLock.current) return;
    actionLock.current = true; requestId.current++;
    setError("");
    setBusy(true);
    try {
      const uploaded =
        evidenceFiles.length > 0
          ? await uploadDisputeEvidenceImages(evidenceFiles.map(({ uri, name, mime }) => ({ uri, name, type: mime })))
          : { urls: [], tokens: [] };
      setDetail(
        await addDisputeEvidence(detail.id, {
          message: evidenceMessage.trim(),
          evidenceUrls: uploaded.urls.join("\n") || null,
          evidenceUploadTokens: uploaded.tokens,
          updatedAt: detail.updatedAt,
        }),
      );
      setEvidenceFiles([]);
      setEvidenceMessage("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể bổ sung bằng chứng."));
      await load(true);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.brand} size="large" />
      </View>
    );
  }

  if (error && !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.retryButton}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} style={styles.ghostButton}>
          <Text style={styles.ghostText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!detail) return null;

  const partyRole = detail.customerId === userId ? "Customer" : detail.ownerId === userId ? "Owner" : null;
  const requestedParty =
    partyRole && (detail.evidenceRequestedFrom === "Both" || detail.evidenceRequestedFrom === partyRole);
  const myAccepted = partyRole === "Customer" ? detail.customerAccepted : detail.ownerAccepted;
  const myExternalConfirmed =
    partyRole === "Customer" ? detail.customerExternalConfirmed : detail.ownerExternalConfirmed;

  return (
    <View style={styles.screen}>
      <AppScreenHeader title="Chi tiết tranh chấp" onBack={onBack} backLabel="Quay lại danh sách" onRefresh={() => void load(true)} refreshLabel="Làm mới tranh chấp" busy={busy} />
      <ScrollView contentContainerStyle={styles.scrollBody}>
      <View style={styles.headerCard}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {detail.bookingCode} · #{detail.id}
          </Text>
          {(() => {
            const st = getDisputeStatusStyle(detail.status, mode);
            return (
              <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
                <View style={[styles.dot, { backgroundColor: st.dot }]} />
                <Text style={[styles.badgeText, { color: st.text }]}>
                  {disputeStatusLabels[detail.status] ?? detail.status}
                </Text>
              </View>
            );
          })()}
        </View>
        <View style={styles.tagRow}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{problemLabels[detail.reportType] ?? detail.reportType}</Text>
          </View>
          {detail.adminManaged ? (
            <View style={styles.adminChip}>
              <Text style={styles.adminChipText}>Do Admin xử lý</Text>
            </View>
          ) : null}
          {detail.reportType === "TrafficFine" && detail.trafficFine?.isOverdue ? (
            <View style={styles.overdueChip}>
              <Text style={styles.overdueChipText}>Quá hạn</Text>
            </View>
          ) : null}
        </View>
        <StatusStepper status={detail.status} />
      </View>
      {detail.followUpDueAt ? <Text style={detail.followUpOverdue ? styles.error : styles.muted}>Hạn phản hồi/theo dõi: {formatDisputeDateTime(detail.followUpDueAt)}{detail.followUpOverdue ? " · Quá hạn, cần nhân viên/Admin xử lý; không tự ghi nhận đã thanh toán." : ""}</Text> : null}
      <BookingAssistance key={detail.bookingId} bookingId={detail.bookingId} bookingCode={detail.bookingCode} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Collapsible
        title="Thông tin"
        icon="◉"
        accent={theme.brand}
        open={openSections.has("info")}
        onToggle={() => toggleSection("info")}
      >
        <View style={styles.partyRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>KHÁCH HÀNG</Text>
            <Text style={styles.value}>{detail.customerName}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>CHỦ XE</Text>
            <Text style={styles.value}>{detail.ownerName}</Text>
          </View>
        </View>
        <View style={styles.descBox}>
          <Text style={styles.body}>{detail.description}</Text>
        </View>
        <Text style={styles.muted}>Mở lúc {formatDisputeDateTime(detail.createdAt)}</Text>
      </Collapsible>

      {evidenceList(detail.evidenceUrls).length > 0 ? (
        <Collapsible
          title={`Bằng chứng ban đầu · ${evidenceList(detail.evidenceUrls).length}`}
          icon="▣"
          accent="#0284C7"
          open={openSections.has("evidence")}
          onToggle={() => toggleSection("evidence")}
        >
          <View style={styles.grid}>
            {evidenceList(detail.evidenceUrls).map((url) => (
              <Pressable key={url} onPress={() => setViewingImage(url)}>
                <Image source={{ uri: url }} style={styles.thumb} />
              </Pressable>
            ))}
          </View>
        </Collapsible>
      ) : null}

      {detail.inspectionReports.length > 0 ? (
        <Collapsible
          title={`Biên bản giao/nhận xe · ${detail.inspectionReports.length}`}
          icon="▤"
          accent="#059669"
          open={openSections.has("reports")}
          onToggle={() => toggleSection("reports")}
        >
          <View style={styles.stack}>
            {detail.inspectionReports.map((report) => (
              <InspectionReportCard key={report.id} report={report} />
            ))}
          </View>
        </Collapsible>
      ) : null}

      {detail.reportType === "TrafficFine" ? (
        <TrafficFinePanel dispute={detail} onChange={updated => { requestId.current++; setDetail(updated); }} />
      ) : null}

      {detail.resolution ? (
        <Collapsible
          title="Kết quả xử lý"
          icon="✓"
          accent="#059669"
          open={openSections.has("resolution")}
          onToggle={() => toggleSection("resolution")}
        >
          <View style={styles.resultBox}>
            <Text style={styles.body}>{detail.resolution}</Text>
          </View>
          <CheckoutDecisionSummary json={detail.checkoutAdjustmentJson} appliedAt={detail.checkoutAdjustmentAppliedAt} report={detail.inspectionReports.find(r => r.type === "CheckOut")} />
          {detail.reportType === "Payment" && detail.paymentAdjustmentNote ? (
            <Text style={styles.body}>Ghi chú đề xuất điều chỉnh thanh toán: {detail.paymentAdjustmentNote}</Text>
          ) : null}
          {detail.reportType !== "TrafficFine" && detail.reportType !== "Payment" ? (
            <>
              <Text style={styles.body}>{compensationDirectionLabels[detail.compensationDirection]}</Text>
              <Text style={styles.value}>Số tiền bồi thường tham khảo: {formatDisputeMoney(detail.finalCompensationAmount)}</Text>
              <Text style={styles.muted}>{settlementMethodLabels[detail.settlementMethod]}</Text>
              <Text style={styles.body}>{detail.platformSettlementCompletedAt ? "Đã thanh toán qua ví" : "Dự kiến thanh toán qua ví"}: {formatDisputeMoney(detail.platformSettledAmount)}</Text>
              <Text style={styles.body}>Quyết toán trực tiếp: {formatDisputeMoney(detail.externalSettlementAmount)}</Text>
            </>
          ) : null}
        </Collapsible>
      ) : null}

      {detail.evidenceSubmissions.length > 0 ? (
        <Collapsible
          title={`Phản hồi bằng chứng · ${detail.evidenceSubmissions.length}`}
          icon="✉"
          accent="#7C3AED"
          open={openSections.has("submissions")}
          onToggle={() => toggleSection("submissions")}
        >
          <View style={styles.stack}>
            {detail.evidenceSubmissions.map((submission) => (
              <View key={submission.id} style={styles.submission}>
                <View style={styles.rowBetween}>
                  <Text style={styles.value}>{submission.submittedByName}</Text>
                  <Text style={styles.muted}>{submission.submittedRole}</Text>
                </View>
                <Text style={styles.body}>{submission.message}</Text>
                <View style={styles.grid}>
                  {evidenceList(submission.evidenceUrls).map((url) => (
                    <Pressable key={url} onPress={() => setViewingImage(url)}>
                      <Image source={{ uri: url }} style={styles.thumb} />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.muted}>{formatDisputeDateTime(submission.createdAt)}</Text>
              </View>
            ))}
          </View>
        </Collapsible>
      ) : null}

      {detail.reportType !== "TrafficFine" && detail.status === "DecisionIssued" ? (
        <View style={styles.actionBox}>
          <Text style={styles.title}>Chờ xác nhận kết quả</Text>
          <Text style={styles.body}>
            Khách: {detail.customerAccepted ? "Đã chấp nhận" : "Chưa chấp nhận"} · Chủ xe:{" "}
            {detail.ownerAccepted ? "Đã chấp nhận" : "Chưa chấp nhận"}
          </Text>
          {partyRole ? (
            <Pressable disabled={busy || myAccepted} onPress={() => void acceptResult()} style={[styles.primaryButton, (busy || myAccepted) && styles.disabled]}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Chấp nhận kết quả xử lý</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {detail.reportType !== "TrafficFine" && detail.status === "AwaitingExternalSettlement" ? (
        <Collapsible
          title="Chờ xác nhận quyết toán"
          icon="₫"
          accent="#A21CAF"
          open={openSections.has("settlement")}
          onToggle={() => toggleSection("settlement")}
        >
          {detail.compensationDirection === "CustomerPaysOwner" && partyRole === "Customer" && !detail.customerExternalConfirmed ? (
            <Text style={styles.body}>Toàn bộ {formatDisputeMoney(detail.externalSettlementAmount)} do hai bên tự thanh toán bên ngoài hệ thống.</Text>
          ) : null}
          <Text style={styles.body}>
            Khách: {detail.customerExternalConfirmed ? "Đã xác nhận" : "Chưa xác nhận"} · Chủ xe:{" "}
            {detail.ownerExternalConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
          </Text>
          {partyRole && !myExternalConfirmed ? (
            <Pressable disabled={busy} onPress={() => void confirmExternal()} style={[styles.primaryButton, busy && styles.disabled]}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryText}>
                  {(partyRole === "Customer") === (detail.compensationDirection === "CustomerPaysOwner")
                    ? "Xác nhận đã thanh toán"
                    : "Xác nhận đã nhận tiền"}
                </Text>
              )}
            </Pressable>
          ) : null}
        </Collapsible>
      ) : null}

      {requestedParty && detail.status === "NeedMoreEvidence" ? (
        <Collapsible
          title="Cần bổ sung bằng chứng"
          icon="↑"
          accent="#EA580C"
          open={openSections.has("evidenceRequest")}
          onToggle={() => toggleSection("evidenceRequest")}
        >
          {detail.evidenceRequestMessage ? <Text style={styles.warn}>{detail.evidenceRequestMessage}</Text> : null}
          <Text style={styles.label}>Nội dung phản hồi</Text>
          <TextInput value={evidenceMessage} onChangeText={setEvidenceMessage} multiline placeholder="Nội dung phản hồi..." placeholderTextColor={theme.placeholder} style={[styles.input, styles.multiline]} />
          <Pressable onPress={() => void pickEvidence()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Chọn ảnh ({evidenceFiles.length}/6)</Text>
          </Pressable>
          {evidenceFiles.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={styles.fileRow}>
              <Text numberOfLines={1} style={styles.fileName}>
                {file.name}
              </Text>
              <Pressable onPress={() => setEvidenceFiles((prev) => prev.filter((_, i) => i !== index))}>
                <Text style={styles.removeText}>Xóa</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            disabled={busy || (!evidenceMessage.trim() && evidenceFiles.length === 0)}
            onPress={() => void submitEvidence()}
            style={[styles.primaryButton, (busy || (!evidenceMessage.trim() && evidenceFiles.length === 0)) && styles.disabled]}
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Gửi bổ sung</Text>}
          </Pressable>
        </Collapsible>
      ) : null}

      {partyRole && !detail.adminManaged && ["Open", "Investigating", "NeedMoreEvidence", "DecisionIssued"].includes(detail.status) ? (
        <View style={styles.actionBox}>
          <Text style={styles.label}>Lý do chuyển Admin (không đồng ý cách xử lý)</Text>
          <TextInput value={escalationReason} onChangeText={setEscalationReason} multiline placeholder="Lý do..." placeholderTextColor={theme.placeholder} style={[styles.input, styles.multiline]} />
          <Pressable disabled={busy || !escalationReason.trim()} onPress={() => void submitEscalate()} style={[styles.secondaryButton, (busy || !escalationReason.trim()) && styles.disabled]}>
            {busy ? <ActivityIndicator color={theme.brand} size="small" /> : <Text style={styles.secondaryText}>Chuyển Admin</Text>}
          </Pressable>
        </View>
      ) : null}

      {detail.auditLogs.length > 0 ? (
        <Collapsible
          title={`Lịch sử thao tác · ${detail.auditLogs.length}`}
          icon="◷"
          accent={theme.muted}
          open={openSections.has("audit")}
          onToggle={() => toggleSection("audit")}
        >
          <View style={styles.timeline}>
            {detail.auditLogs.map((log, index) => {
              const entries = parseAuditDetailEntries(log.newValue, "Dispute");
              const isLast = index === detail.auditLogs.length - 1;
              return (
                <View key={log.id} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineDot} />
                    {!isLast ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.value}>{auditActionLabels[log.action] ?? log.action}</Text>
                    <Text style={styles.muted}>
                      {log.actorName} · {formatAuditRole(log.actorRole)} · {formatDisputeDateTime(log.createdAt)}
                    </Text>
                    {entries.length > 0 && !(entries.length === 1 && !entries[0]?.label && entries[0]?.value === "—") ? (
                      <View style={styles.auditDetailBox}>
                        {entries.map((entry, entryIndex) => (
                          <Text key={`${log.id}-${entryIndex}`} style={styles.auditDetailText}>
                            {entry.label ? (
                              <Text style={styles.auditDetailLabel}>{entry.label}: </Text>
                            ) : null}
                            {entry.value}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Collapsible>
      ) : null}

      <Modal visible={viewingImage !== null} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <Pressable onPress={() => setViewingImage(null)} style={styles.viewer}>
          {viewingImage ? <Image source={{ uri: viewingImage }} resizeMode="contain" style={styles.fullImage} /> : null}
          <Text style={styles.viewerHint}>Chạm để đóng</Text>
        </Pressable>
      </Modal>
      </ScrollView>
    </View>
  );
}

function StatusStepper({ status }: { status: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const steps = ["Open", "Investigating", "NeedMoreEvidence", "DecisionIssued", "AwaitingExternalSettlement"];
  const labels: Record<string, string> = {
    Open: "Mở",
    Investigating: "Điều tra",
    NeedMoreEvidence: "Bổ sung",
    DecisionIssued: "Kết quả",
    AwaitingExternalSettlement: "Quyết toán",
  };
  if (status === "Resolved") {
    return (
      <View style={styles.stepperDone}>
        <Text style={styles.stepperDoneText}>✓ Đã xử lý hoàn tất</Text>
      </View>
    );
  }
  if (status === "Escalated") {
    return (
      <View style={styles.stepperEscalated}>
        <Text style={styles.stepperEscalatedText}>Đã chuyển Admin xử lý</Text>
      </View>
    );
  }
  const current = steps.indexOf(status);
  return (
    <View style={styles.stepper}>
      {steps.map((s, i) => {
        const done = current < 0 ? false : i <= current;
        return (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, done && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, done && styles.stepDotTextDone]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{labels[s]}</Text>
            {i < steps.length - 1 ? <View style={[styles.stepLine, done && styles.stepLineDone]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Collapsible({
  title,
  icon,
  accent,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: string;
  accent?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tint = accent ?? theme.brand;
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionAccent, { backgroundColor: tint }]} />
          {icon ? <Text style={[styles.sectionIcon, { color: tint }]}>{icon}</Text> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.chevronCircle}>
          <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
        </View>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPlaceholder: { width: 32, height: 32 },
    backText: { color: theme.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    scrollBody: { padding: 16, gap: 12, paddingBottom: 40, backgroundColor: theme.background },
    body: { color: theme.text, fontSize: 13.5, lineHeight: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    headerCard: { gap: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 18, padding: 16 },
    title: { color: theme.text, fontSize: 17, fontWeight: "800", flex: 1, lineHeight: 22 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: "800" },
    tagRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    typeChip: { backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    typeChipText: { color: theme.text, fontSize: 12, fontWeight: "700" },
    adminChip: { backgroundColor: theme.brandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    adminChipText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    overdueChip: { backgroundColor: theme.dangerSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    overdueChipText: { color: theme.danger, fontSize: 12, fontWeight: "800" },
    stepper: { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
    stepItem: { flex: 1, alignItems: "center", gap: 4 },
    stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
    stepDotDone: { backgroundColor: theme.brandSolid, borderColor: theme.brand },
    stepDotText: { color: theme.muted, fontSize: 11, fontWeight: "800" },
    stepDotTextDone: { color: "#fff" },
    stepLabel: { color: theme.muted, fontSize: 10, fontWeight: "700", textAlign: "center" },
    stepLabelDone: { color: theme.text },
    stepLine: { position: "absolute", top: 11, left: "60%", right: "-40%", height: 2, backgroundColor: theme.border },
    stepLineDone: { backgroundColor: theme.brandSolid },
    stepperDone: { backgroundColor: theme.successSoft, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
    stepperDoneText: { color: theme.success, fontSize: 13, fontWeight: "800" },
    stepperEscalated: { backgroundColor: theme.brandSoft, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
    stepperEscalatedText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    status: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    problem: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 12 },
    value: { color: theme.text, fontSize: 13, fontWeight: "700" },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    warn: { color: "#92400e", fontSize: 12, fontWeight: "600" },
    retryButton: { borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    ghostButton: { borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, alignItems: "center" },
    ghostText: { color: theme.muted, fontSize: 14, fontWeight: "800" },
    stack: { gap: 10 },
    partyRow: { flexDirection: "row", gap: 8 },
    partyBox: { flex: 1, gap: 4, borderRadius: 12, backgroundColor: theme.surfaceAlt, padding: 12 },
    partyLabel: { color: theme.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
    descBox: { borderLeftWidth: 3, borderLeftColor: theme.brandBorder, backgroundColor: theme.surfaceAlt, borderRadius: 10, padding: 12 },
    resultBox: { borderRadius: 12, backgroundColor: theme.successSoft, padding: 12 },
    section: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, overflow: "hidden", backgroundColor: theme.surface },
    // Header section nền trong suốt, chỉ giữ vạch accent + icon cho thoáng.
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "transparent" },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    sectionAccent: { width: 4, height: 18, borderRadius: 2 },
    sectionIcon: { fontSize: 14, fontWeight: "800" },
    sectionTitle: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    chevronCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
    sectionChevron: { color: theme.muted, fontSize: 10 },
    sectionBody: { gap: 10, padding: 14, paddingTop: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    thumb: { width: 104, height: 104, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    label: { color: theme.text, fontSize: 13, fontWeight: "700" },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    fileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    fileName: { color: theme.text, fontSize: 12, flex: 1 },
    removeText: { color: theme.danger, fontSize: 12, fontWeight: "700" },
    actionBox: { gap: 10, borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 16, padding: 16, backgroundColor: theme.brandSoft },
    primaryButton: { borderRadius: 12, backgroundColor: theme.brandSolid, paddingVertical: 13, alignItems: "center" },
    primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: theme.brandBorder, backgroundColor: theme.surface, paddingVertical: 12, alignItems: "center" },
    secondaryText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.4 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    submission: { gap: 6, borderRadius: 12, backgroundColor: theme.surfaceAlt, padding: 12 },
    auditRow: { gap: 2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: theme.brandBorder },
    timeline: { gap: 0 },
    timelineRow: { flexDirection: "row", gap: 10 },
    timelineRail: { alignItems: "center", width: 14 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.brandSolid, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: theme.border, borderRadius: 1, marginVertical: 4 },
    timelineContent: { flex: 1, gap: 3, paddingBottom: 16 },
    auditDetailBox: { gap: 3, borderRadius: 10, backgroundColor: theme.surfaceAlt, padding: 10, marginTop: 4 },
    auditDetailText: { color: theme.text, fontSize: 12, lineHeight: 17 },
    auditDetailLabel: { fontWeight: "800" },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
    fullImage: { width: "100%", height: "80%" },
    viewerHint: { color: "#fff", fontSize: 12, marginTop: 10 },
  });
