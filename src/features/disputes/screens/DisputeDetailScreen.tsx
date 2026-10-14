import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = useAuthStore((state) => state.user?.userId);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await getDisputeById(disputeId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải chi tiết tranh chấp."));
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setBusy(true);
    try {
      setDetail(await acceptDisputeResolution(detail.id, detail.updatedAt));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xác nhận kết quả."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmExternal() {
    if (!detail) return;
    setBusy(true);
    try {
      setDetail(await confirmExternalSettlement(detail.id, detail.updatedAt));
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xác nhận thanh toán."));
    } finally {
      setBusy(false);
    }
  }

  async function submitEscalate() {
    if (!detail || !escalationReason.trim()) return;
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
    } finally {
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
    } finally {
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
    <ScrollView contentContainerStyle={styles.scrollBody}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>‹ Danh sách</Text>
      </Pressable>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {detail.bookingCode} · #{detail.id}
        </Text>
        <Text style={styles.status}>{disputeStatusLabels[detail.status] ?? detail.status}</Text>
      </View>
      <Text style={styles.problem}>{problemLabels[detail.reportType] ?? detail.reportType}</Text>
      {detail.adminManaged ? <Text style={styles.error}>Do Admin xử lý</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Collapsible title="Thông tin" open={openSections.has("info")} onToggle={() => toggleSection("info")}>
        <View style={styles.stack}>
          <View>
            <Text style={styles.muted}>KHÁCH HÀNG</Text>
            <Text style={styles.value}>{detail.customerName}</Text>
          </View>
          <View>
            <Text style={styles.muted}>CHỦ XE</Text>
            <Text style={styles.value}>{detail.ownerName}</Text>
          </View>
        </View>
        <Text style={styles.body}>{detail.description}</Text>
        <Text style={styles.muted}>Mở lúc {formatDisputeDateTime(detail.createdAt)}</Text>
      </Collapsible>

      {evidenceList(detail.evidenceUrls).length > 0 ? (
        <Collapsible title="Bằng chứng ban đầu" open={openSections.has("evidence")} onToggle={() => toggleSection("evidence")}>
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
        <Collapsible title="Biên bản giao/nhận xe" open={openSections.has("reports")} onToggle={() => toggleSection("reports")}>
          <View style={styles.stack}>
            {detail.inspectionReports.map((report) => (
              <InspectionReportCard key={report.id} report={report} />
            ))}
          </View>
        </Collapsible>
      ) : null}

      {detail.reportType === "TrafficFine" ? (
        <TrafficFinePanel dispute={detail} onChange={setDetail} />
      ) : null}

      {detail.resolution ? (
        <Collapsible title="Kết quả xử lý" open={openSections.has("resolution")} onToggle={() => toggleSection("resolution")}>
          <Text style={styles.body}>{detail.resolution}</Text>
          {detail.reportType === "Payment" && detail.paymentAdjustmentNote ? (
            <Text style={styles.body}>Ghi chú đề xuất điều chỉnh thanh toán: {detail.paymentAdjustmentNote}</Text>
          ) : null}
          {detail.reportType !== "TrafficFine" && detail.reportType !== "Payment" ? (
            <>
              <Text style={styles.body}>{compensationDirectionLabels[detail.compensationDirection]}</Text>
              <Text style={styles.value}>Số tiền bồi thường tham khảo: {formatDisputeMoney(detail.finalCompensationAmount)}</Text>
              <Text style={styles.muted}>Hai bên tự quyết toán trực tiếp ngoài nền tảng.</Text>
            </>
          ) : null}
        </Collapsible>
      ) : null}

      {detail.evidenceSubmissions.length > 0 ? (
        <Collapsible title="Phản hồi bằng chứng" open={openSections.has("submissions")} onToggle={() => toggleSection("submissions")}>
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
        <Collapsible title="Chờ xác nhận quyết toán" open={openSections.has("settlement")} onToggle={() => toggleSection("settlement")}>
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
        <Collapsible title="Cần bổ sung bằng chứng" open={openSections.has("evidenceRequest")} onToggle={() => toggleSection("evidenceRequest")}>
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
        <Collapsible title="Lịch sử thao tác" open={openSections.has("audit")} onToggle={() => toggleSection("audit")}>
          <View style={styles.stack}>
            {detail.auditLogs.map((log) => (
              <View key={log.id} style={styles.auditRow}>
                <Text style={styles.value}>{log.action}</Text>
                <Text style={styles.muted}>
                  {log.actorName} · {log.actorRole} · {formatDisputeDateTime(log.createdAt)}
                </Text>
                {log.newValue ? <Text style={styles.muted}>{log.newValue}</Text> : null}
              </View>
            ))}
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
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollBody: { padding: 16, gap: 10, paddingBottom: 32 },
    body: { color: theme.text, fontSize: 13, lineHeight: 19 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
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
    section: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: theme.surface },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.surfaceAlt },
    sectionTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    sectionChevron: { color: theme.muted, fontSize: 12 },
    sectionBody: { gap: 8, padding: 14 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    thumb: { width: 96, height: 96, borderRadius: 8 },
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
    actionBox: { gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, backgroundColor: theme.surface },
    primaryButton: { borderRadius: 12, backgroundColor: theme.brand, paddingVertical: 12, alignItems: "center" },
    primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: theme.brandBorder, paddingVertical: 12, alignItems: "center" },
    secondaryText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.4 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    submission: { gap: 4, borderRadius: 10, backgroundColor: theme.surfaceAlt, padding: 10 },
    auditRow: { gap: 2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: theme.brandBorder },
    viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
    fullImage: { width: "100%", height: "80%" },
    viewerHint: { color: "#fff", fontSize: 12, marginTop: 10 },
  });
