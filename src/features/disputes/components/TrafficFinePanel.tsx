import { useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  evidenceList,
  formatDisputeDateTime,
  formatDisputeMoney,
  trafficFineStatusLabels,
} from "@/features/disputes/components/disputeLabels";
import { getFineStatusStyle } from "@/features/disputes/components/disputeStatusStyles";
import {
  getDisputeById,
  updateTrafficFine,
  uploadDisputeEvidenceImages,
} from "@/features/disputes/disputeService";
import type { DisputeDetailResponse } from "@/features/disputes/types";
import { parseVietnamDateTime, validProofAssets } from "@/features/disputes/components/TrafficFineCreateFields";

type ProofAsset = { uri: string; name: string; mime: string; size?: number | null };

// Port RN của FrontEnd TrafficFinePanel — chỉ phần khách/chủ xe
// (xác minh/escalate của staff không có trên mobile).
export default function TrafficFinePanel({
  dispute,
  onChange,
}: {
  dispute: DisputeDetailResponse;
  onChange: (detail: DisputeDetailResponse) => void;
}) {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = useAuthStore((state) => state.user?.userId);
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<ProofAsset[]>([]);
  const actionLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fine = dispute.trafficFine;
  if (!fine) {
    return (
      <View style={styles.oldBox}>
        <Text style={styles.title}>{t("disputes:trafficFine.legacyTitle")}</Text>
        <Text style={styles.body}>{t("mobile:dispute.fine.legacyDescription")}</Text>
      </View>
    );
  }

  const terminal = dispute.status === "Resolved" || ["Resolved", "Rejected"].includes(fine.status);
  const customer = userId === dispute.customerId && !terminal;
  const owner = userId === dispute.ownerId && !terminal;
  const pending = fine.paymentProofs.find((p) => p.status === "Pending");

  async function pickFiles() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    setFiles(
      result.assets
        .filter((a) => a.uri)
        .slice(0, 6)
        .map((a) => ({ uri: a.uri ?? "", name: a.fileName ?? "chung-tu.jpg", mime: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null })),
    );
  }

  async function act(
    action: "respond" | "payment-proof" | "confirm-owner-receipt",
    extra: { acceptResponsibility?: boolean } = {},
  ) {
    if (actionLock.current) return;
    const current = fine;
    if (!current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      let evidence: { urls: string[]; tokens: string[] } | undefined;
      if (action === "payment-proof") {
        if (!validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()) {
          throw new Error(i18n.t("mobile:dispute.fine.proofRequired"));
        }
        evidence = await uploadDisputeEvidenceImages(
          files.map(({ uri, name, mime }) => ({ uri, name, type: mime })),
        );
      }
      const updated = await updateTrafficFine(dispute.id, action, {
        expectedVersion: current.version,
        note,
        ...extra,
        ...(evidence
          ? {
              amount: current.amount,
              paidAt: parseVietnamDateTime(paidAt) as string,
              transactionReference: reference.trim(),
              evidenceUrls: evidence.urls.join("\n"),
              evidenceUploadTokens: evidence.tokens,
            }
          : {}),
      });
      onChange(updated);
      setNote("");
      setFiles([]);
      setPaidAt("");
      setReference("");
    } catch (err) {
      setError(getApiErrorMessage(err, err instanceof Error ? err.message : t("disputes:trafficFine.toastTryAgain")));
      try {
        onChange(await getDisputeById(dispute.id));
      } catch {
        // Giữ chi tiết hiện tại khi mất mạng.
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.box} accessibilityLabel={t("disputes:trafficFine.title")}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("disputes:trafficFine.title")}</Text>
        {(() => {
          const st = getFineStatusStyle(fine.status, mode);
          return (
            <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
              <View style={[styles.dot, { backgroundColor: st.dot }]} />
              <Text style={[styles.badgeText, { color: st.text }]}>
                {trafficFineStatusLabels[fine.status] ?? fine.status}
                {fine.isOverdue ? t("disputes:trafficFine.overdueSuffix") : ""}
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.noticeNumber")}</Text>
        <Text style={styles.value}>{fine.noticeNumber}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.issuingAuthority")}</Text>
        <Text style={styles.value}>{fine.issuingAuthority}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.licensePlate")}</Text>
        <Text style={styles.value}>{fine.licensePlate}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.amount")}</Text>
        <Text style={styles.value}>{formatDisputeMoney(fine.amount)}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.violationAt")}</Text>
        <Text style={styles.value}>{formatDisputeDateTime(fine.violationAt)}</Text>
      </View>
      <View style={styles.kv}>
        <Text style={styles.muted}>{t("disputes:trafficFine.dueAt")}</Text>
        <Text style={styles.value}>{formatDisputeDateTime(fine.dueAt)}</Text>
      </View>
      <Text style={styles.muted}>
        {t("disputes:trafficFine.rentalPeriod")}: {formatDisputeDateTime(fine.rentalStartAt)} → {formatDisputeDateTime(fine.rentalEndAt)}
      </Text>
      <Text style={styles.muted}>
        {fine.hasConfirmedRentalTimes
          ? t("disputes:trafficFine.rentalPeriodConfirmed")
          : t("mobile:dispute.fine.rentalEstimated")}{" "}
        {fine.matchesRentalPeriod
          ? t("disputes:trafficFine.rentalPeriodMatch")
          : t("disputes:trafficFine.rentalPeriodMismatch")}
      </Text>
      <Text style={styles.body}>
        {fine.paymentMode === "ReimburseOwner"
          ? t("mobile:dispute.fine.paymentModeReimburse")
          : t("mobile:dispute.fine.paymentModeDirect")}
        {t("disputes:trafficFine.trackingNote")}
      </Text>
      {fine.ownerPaidAt ? (
        <Text style={styles.body}>
          {t("disputes:trafficFine.ownerPaidAt", { date: formatDisputeDateTime(fine.ownerPaidAt) })}
          {fine.ownerPaymentEvidenceUrls
            ? t("mobile:dispute.fine.receiptPhotos", { count: evidenceList(fine.ownerPaymentEvidenceUrls).length })
            : ""}
        </Text>
      ) : null}
      {fine.verificationNote ? (
        <Text style={styles.body}>
          {t("disputes:trafficFine.verificationResult", {
            note: fine.verificationNote,
            date: formatDisputeDateTime(fine.verifiedAt),
          })}
        </Text>
      ) : null}
      {fine.customerRespondedAt ? (
        <Text style={styles.body}>
          {t("disputes:trafficFine.customerResponse", {
            response: fine.customerResponse || t("disputes:trafficFine.responseAccepted"),
            date: formatDisputeDateTime(fine.customerRespondedAt),
          })}
        </Text>
      ) : null}
      {fine.rejectionReason ? (
        <Text style={styles.warn}>{t("mobile:dispute.fine.rejectionReason", { reason: fine.rejectionReason })}</Text>
      ) : null}

      {fine.paymentProofs.length > 0 ? (
        <View style={styles.proofs}>
          <Text style={styles.title}>{t("disputes:trafficFine.proofHistory")}</Text>
          {fine.paymentProofs.map((p) => (
            <View key={p.id} style={styles.proof}>
              <Text style={styles.value}>
                {formatDisputeMoney(p.amount)} · {p.transactionReference} ·{" "}
                {p.status === "Approved"
                  ? t("disputes:trafficFine.proofApproved")
                  : p.status === "Rejected"
                    ? t("disputes:trafficFine.proofRejected")
                    : t("disputes:trafficFine.proofPending")}
              </Text>
              <Text style={styles.muted}>{t("disputes:trafficFine.proofPaidAt", { date: formatDisputeDateTime(p.paidAt) })}</Text>
              {p.note ? <Text style={styles.body}>{p.note}</Text> : null}
              {p.ownerReceiptConfirmedAt ? (
                <Text style={styles.body}>
                  {t("disputes:trafficFine.ownerReceiptConfirmedAt", { date: formatDisputeDateTime(p.ownerReceiptConfirmedAt) })}
                </Text>
              ) : null}
              {p.reviewNote ? (
                <Text style={styles.body}>
                  {t("disputes:trafficFine.reviewResult", { note: p.reviewNote, date: formatDisputeDateTime(p.reviewedAt) })}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {customer && fine.status === "AwaitingCustomerResponse" ? (
        <View style={styles.actions}>
          <Text style={styles.body}>{t("disputes:trafficFine.acceptanceHint")}</Text>
          <Text style={styles.label}>{t("mobile:dispute.fine.dissentReasonLabel")}</Text>
          <TextInput value={note} onChangeText={setNote} maxLength={2000} multiline style={[styles.input, styles.multiline]} />
          <View style={styles.actionRow}>
            <Pressable disabled={busy} onPress={() => void act("respond", { acceptResponsibility: true })} style={styles.primaryButton}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t("disputes:trafficFine.accept")}</Text>}
            </Pressable>
            <Pressable
              disabled={busy || !note.trim()}
              onPress={() => void act("respond", { acceptResponsibility: false })}
              style={[styles.secondaryButton, (busy || !note.trim()) && styles.disabled]}
            >
              <Text style={styles.secondaryText}>{t("disputes:trafficFine.dispute")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {customer && fine.status === "AwaitingPayment" ? (
        <View style={styles.actions}>
          <Text style={styles.title}>
            {t("disputes:trafficFine.submitProofTitle", {
              mode:
                fine.paymentMode === "ReimburseOwner"
                  ? t("disputes:trafficFine.submitProofModeReimburse")
                  : t("disputes:trafficFine.submitProofModeDirect"),
            })}
          </Text>
          <Text style={styles.body}>{t("disputes:trafficFine.amountToProve", { amount: formatDisputeMoney(fine.amount) })}</Text>
          <Text style={styles.label}>{t("mobile:dispute.fine.paidAtLabel")}</Text>
          <TextInput value={paidAt} onChangeText={setPaidAt} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={theme.placeholder} style={styles.input} />
          <Text style={styles.label}>{t("disputes:trafficFine.referenceLabel")}</Text>
          <TextInput value={reference} onChangeText={setReference} maxLength={150} style={styles.input} />
          <Pressable onPress={() => void pickFiles()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{t("mobile:dispute.fine.pickProof", { count: files.length, max: 6 })}</Text>
          </Pressable>
          <Pressable
            disabled={busy || !validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()}
            onPress={() => void act("payment-proof")}
            style={[styles.primaryButton, (busy || !validProofAssets(files) || !parseVietnamDateTime(paidAt) || !reference.trim()) && styles.disabled]}
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t("disputes:trafficFine.submitProof")}</Text>}
          </Pressable>
        </View>
      ) : null}

      {owner && fine.paymentMode === "ReimburseOwner" && pending && !pending.ownerReceiptConfirmedAt ? (
        <Pressable disabled={busy} onPress={() => void act("confirm-owner-receipt")} style={[styles.primaryButton, busy && styles.disabled]}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryText}>{t("disputes:trafficFine.confirmReceipt", { amount: formatDisputeMoney(fine.amount) })}</Text>
          )}
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    box: { gap: 8, borderWidth: 1, borderColor: "#BAE6FD", backgroundColor: theme.surface, borderRadius: 12, padding: 12 },
    oldBox: { gap: 6, borderWidth: 1, borderColor: "#FCD34D", backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: "800" },
    status: { color: "#0284C7", fontSize: 12, fontWeight: "700" },
    kv: { gap: 1 },
    muted: { color: theme.muted, fontSize: 12 },
    value: { color: theme.text, fontSize: 13, fontWeight: "600" },
    body: { color: theme.text, fontSize: 13, lineHeight: 19 },
    warn: { color: "#92400e", backgroundColor: "#FEF3C7", fontSize: 12, borderRadius: 8, padding: 8 },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    proofs: { gap: 8 },
    proof: { gap: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10 },
    actions: { gap: 8, marginTop: 4 },
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
    multiline: { minHeight: 70, textAlignVertical: "top" },
    actionRow: { flexDirection: "row", gap: 8 },
    primaryButton: { borderRadius: 12, backgroundColor: theme.brand, paddingVertical: 12, alignItems: "center", flex: 1 },
    primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    secondaryButton: { borderRadius: 12, borderWidth: 1, borderColor: theme.brandBorder, paddingVertical: 12, alignItems: "center", flex: 1 },
    secondaryText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    disabled: { opacity: 0.4 },
  });
