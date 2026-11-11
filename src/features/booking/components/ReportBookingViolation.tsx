import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiClient, getApiErrorMessage } from "@/services/apiClient";
import type { ApiResponse } from "@/features/auth/types";
import { appendUploadFile } from "@/types/upload";
import { useTheme } from "@/theme/useTheme";
import { BookingButton, BookingField } from "./BookingControls";

type Reason = { code: string; label: string; targetTypes: string[] };
type Report = { id: string; targetId: number; status: string; description: string; resolution?: string; evidenceUrls?: string[]; history?: { id: number; note: string; actorName: string }[] };
const base = "/api/violation-reports";
const REPORT_STATUSES: readonly string[] = ["Open", "InReview", "Resolved", "Rejected"];

export default function ReportBookingViolation({ bookingId, bookingCode }: { bookingId: number; bookingCode: string }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [options, setOptions] = useState<Reason[]>([]), [reason, setReason] = useState(""), [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]), [reports, setReports] = useState<Report[]>([]), [selected, setSelected] = useState<Report | null>(null);
  const lock = useRef(false);
  const statusLabel = (status: string) => REPORT_STATUSES.includes(status) ? t(`violations:status.${status}`) : status;
  async function execute(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await operation(); }
    catch (err) { setError(getApiErrorMessage(err, t("mobile:inspection.violation.error"))); }
    finally { lock.current = false; setBusy(false); }
  }
  function show() {
    setOpen(true);
    void execute(async () => {
      const [reasons, page] = await Promise.all([
        apiClient.get<ApiResponse<Reason[]>>(`${base}/reasons`),
        apiClient.get<ApiResponse<{ items: Report[] }>>(`${base}/my`, { params: { targetType: "Booking", keyword: bookingCode, pageSize: 50 } }),
      ]);
      setOptions((reasons.data.data ?? []).filter(item => item.targetTypes.includes("Booking")));
      setReports((page.data.data?.items ?? []).filter(item => item.targetId === bookingId));
    });
  }
  async function capture() {
    await execute(async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error(t("mobile:inspection.violation.cameraPermission"));
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0]; if (!asset) return;
      if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) throw new Error(t("mobile:inspection.violation.imageTooLarge"));
      const form = new FormData();
      appendUploadFile(form, "file", asset.file ?? { uri: asset.uri, name: asset.fileName ?? "evidence.jpg", type: asset.mimeType ?? "image/jpeg" });
      const response = await apiClient.post<ApiResponse<{ url: string }>>(`${base}/evidence`, form);
      if (response.data.data?.url) setEvidence(current => [...current, response.data.data!.url].slice(0, 5));
    });
  }
  function submit() {
    if (!reason || description.trim().length < 20) { setError(t("mobile:inspection.violation.validation")); return; }
    void execute(async () => {
      const response = await apiClient.post<ApiResponse<Report>>(base, { targetType: "Booking", targetId: bookingId, reason, description: description.trim(), evidenceUrls: evidence });
      setSelected(response.data.data!); setDescription(""); setEvidence([]);
    });
  }
  function inspect(id: string) { void execute(async () => setSelected((await apiClient.get<ApiResponse<Report>>(`${base}/${encodeURIComponent(id)}`)).data.data!)); }
  return <>
    <BookingButton danger regular title={t("mobile:inspection.violation.reportButton")} onPress={show} />
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={{ flex: 1, backgroundColor: theme.background, padding: 20, paddingTop: 48, gap: 12 }}>
        <Text style={{ color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: "700" }}>{t("mobile:inspection.violation.title", { code: bookingCode })}</Text>
        <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.muted, fontSize: 11.5, lineHeight: 16 }}>{t("mobile:inspection.violation.intro")}</Text>
          {selected ? <>
            <Text style={{ color: theme.brand, fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>{statusLabel(selected.status)}</Text>
            <Text style={{ color: theme.text, fontSize: 11.5, lineHeight: 16 }}>{selected.description}</Text>
            {!!selected.resolution && <Text style={{ color: theme.text, fontSize: 11.5, lineHeight: 16 }}>{t("mobile:inspection.violation.resolution", { resolution: selected.resolution })}</Text>}
            {selected.history?.map(item => <Text key={item.id} style={{ color: theme.text, fontSize: 11.5, lineHeight: 16 }}>{item.actorName}: {item.note}</Text>)}
            <BookingButton title={t("mobile:inspection.violation.refresh")} disabled={busy} onPress={() => inspect(selected.id)} />
            <BookingButton secondary title={t("mobile:inspection.violation.back")} disabled={busy} onPress={() => { setSelected(null); show(); }} />
          </> : <>
            {reports.map(item => <BookingButton key={item.id} secondary title={t("mobile:inspection.violation.sent", { status: statusLabel(item.status) })} disabled={busy} onPress={() => inspect(item.id)} />)}
            {options.map(item => <BookingButton key={item.code} secondary title={`${reason === item.code ? "✓ " : ""}${item.label}`} disabled={busy} onPress={() => setReason(item.code)} />)}
            <BookingField label={t("mobile:inspection.violation.descriptionLabel")} value={description} onChangeText={setDescription} multiline editable={!busy} />
            <BookingButton secondary title={t("mobile:inspection.violation.capture", { selected: evidence.length })} disabled={busy || evidence.length >= 5} onPress={() => void capture()} />
            {evidence.map((url, index) => <View key={url} style={{ gap: 6 }}><Image source={{ uri: url }} style={{ width: 120, height: 120 }} /><BookingButton secondary title={t("mobile:inspection.violation.removeEvidence", { index: index + 1 })} disabled={busy} onPress={() => setEvidence(current => current.filter(value => value !== url))} /></View>)}
            <BookingButton title={t("mobile:inspection.violation.submit")} busy={busy} disabled={!reason || description.trim().length < 20} onPress={submit} />
          </>}
          {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 11.5, lineHeight: 16 }}>{error}</Text>}
        </ScrollView>
        <BookingButton secondary title={t("mobile:inspection.violation.close")} disabled={busy} onPress={() => setOpen(false)} />
      </View>
    </Modal>
  </>;
}
