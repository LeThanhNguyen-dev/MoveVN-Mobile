import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { formatMoney } from "../bookingDisplay";
import { settleCheckoutSurcharges } from "../bookingService";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BookingField } from "./BookingControls";
import { DetailButton, DetailNotice, DetailPill, DetailSectionHeader } from "./detail/BookingDetailUI";

export default function OutstandingSurchargePayment({ booking, report, role, onUpdated, onOpenWallet }: {
  booking: BookingResponse; report?: InspectionReportResponse; role?: "Owner" | "Customer"; onUpdated?: () => void | Promise<void>; onOpenWallet?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("");
  const lock = useRef(false);
  const external = report?.externalPendingSurchargeAmount ?? booking.externalPendingSurchargeAmount ?? 0;
  const amount = Math.max(report?.outstandingSurchargeAmount ?? booking.outstandingSurchargeAmount ?? 0, external);
  async function pay(action: "Wallet" | "External" | "ConfirmExternal") {
    if (lock.current || !report || (action === "ConfirmExternal" && !note.trim())) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const updated = await settleCheckoutSurcharges(booking.id, { action, expectedVersion: report.version ?? 1, ...(action === "ConfirmExternal" ? { note: note.trim() } : {}) });
      await onUpdated?.(); setNote("");
      if (action === "Wallet" && (updated.outstandingSurchargeAmount ?? 0) > 0) setError(t("booking:checkout.outstandingWalletInsufficient"));
    } catch (e) { setError(getApiErrorMessage(e, t("booking:checkout.outstandingUpdateError"))); }
    finally { lock.current = false; setBusy(false); }
  }
  if (amount <= 0 || !["Returned", "Completed"].includes(booking.status)) return null;
  const ownerConfirm = role === "Owner" && external > 0;
  return <View accessibilityRole="alert" style={{ backgroundColor: theme.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.dangerBorder, padding: 16, gap: 12 }}>
    <DetailSectionHeader
      title={ownerConfirm ? t("booking:checkout.outstandingOwnerTitle") : t("booking:checkout.outstandingTitle")}
      subtitle={t("mobile:inspection.outstanding.subtitle")}
      right={<DetailPill label={formatMoney(amount)} tone="warn" />}
    />

    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft, padding: 12, gap: 3 }}>
      <Text style={{ color: theme.muted, fontFamily: font.bold, fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase" }}>{t("mobile:inspection.outstanding.remainingLabel")}</Text>
      <Text style={{ color: theme.danger, fontFamily: font.display, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 }}>{formatMoney(amount)}</Text>
      <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 15 }}>
        {external > 0 ? t("mobile:inspection.outstanding.externalPending", { amount: formatMoney(external) }) : t("mobile:inspection.outstanding.walletHint")}
      </Text>
    </View>

    {role === "Customer" && report ? <>
      <DetailButton label={t("booking:checkout.outstandingPayWallet")} busy={busy} onPress={() => void pay("Wallet")} />
      <DetailButton variant="secondary" label={t("booking:checkout.outstandingChooseExternal")} disabled={busy || external >= amount} onPress={() => void pay("External")} />
      {onOpenWallet && <DetailButton variant="ghost" label={t("booking:checkout.outstandingTopUp")} disabled={busy} onPress={onOpenWallet} />}
      <Text style={{ color: theme.muted, fontFamily: font.regular, fontSize: 10, lineHeight: 15 }}>{t("mobile:inspection.outstanding.topUpHint")}</Text>
    </> : null}
    {ownerConfirm && report ? <>
      <BookingField label={t("booking:checkout.outstandingNoteLabel")} value={note} onChangeText={setNote} multiline editable={!busy} />
      <DetailButton label={t("booking:checkout.outstandingConfirmExternal")} busy={busy} disabled={!note.trim()} onPress={() => void pay("ConfirmExternal")} />
    </> : null}

    {booking.status === "Returned" ? <DetailNotice title={t("mobile:inspection.outstanding.nextStepTitle")} tone="brand">
      {role === "Owner" ? t("mobile:inspection.outstanding.nextStepOwner") : t("mobile:inspection.outstanding.nextStepCustomer")}
    </DetailNotice> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontFamily: font.medium, fontSize: 10.5, lineHeight: 15 }}>{error}</Text> : null}
  </View>;
}
