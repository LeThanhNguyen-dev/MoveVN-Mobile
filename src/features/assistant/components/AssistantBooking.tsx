import { memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import QRCode from "react-native-qrcode-svg";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getFormatLocale } from "@/i18n/formatLocale";
import { getApiErrorMessage } from "@/services/apiClient";
import { actionIsExpired } from "@/features/assistant/assistantProtocol";
import {
  confirmAction,
  getAssistantPaymentStatus,
  getDraft,
  getDraftPaymentLink,
  prepareDraft,
  type AssistantQuote,
  type BookingDraft,
  type DraftSlots,
  type CancellationProposal,
  type ConfirmResult,
  type PaymentLink,
} from "@/features/assistant/assistantService";

export type AssistantBlock = { type: string; data: Record<string, unknown> };

// Port RN của FrontEnd AssistantBookingCards.tsx: báo giá, xác nhận đặt/hủy,
// thanh toán — để chatbot đặt xe ngay trong đoạn chat trên mobile.

const money = (value: number) =>
  new Intl.NumberFormat(getFormatLocale(), { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const formatDateTime = (value: string) => new Date(value).toLocaleString(getFormatLocale(), { timeZone: "Asia/Ho_Chi_Minh" });

function checkoutUrl(value?: string) {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

export function QuoteCard({ quote, slots }: { quote: AssistantQuote; slots?: DraftSlots }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);
  const delivery = quote.deliveryDistanceKm != null
    ? t("mobile:assistant.booking.deliveryFeeDistance", {
        km: quote.deliveryDistanceKm,
        amount: (quote.deliveryFee ?? 0) > 0 ? money(quote.deliveryFee!) : t("mobile:assistant.booking.free"),
      })
    : t("mobile:assistant.booking.deliveryFee", {
        amount: (quote.deliveryFee ?? 0) > 0 ? money(quote.deliveryFee!) : t("mobile:assistant.booking.free"),
      });
  const pickupNote = slots?.pickupMode === "delivery" || quote.deliveryDistanceKm != null
    ? t("mobile:assistant.booking.deliveryNote", {
        address: slots?.pickupAddress
          ? t("mobile:assistant.booking.deliveryAddressSuffix", { address: slots.pickupAddress })
          : t("mobile:assistant.booking.deliveryAddressFallback"),
      })
    : t("mobile:assistant.booking.pickupNote");
  return (
    <View style={styles.quoteCard}>
      <Text style={styles.cardTitle}>{t("mobile:assistant.booking.quoteTitle")}</Text>
      <Text style={styles.body}>
        {formatDateTime(quote.startAt)} → {formatDateTime(quote.endAt)}
      </Text>
      <Text style={styles.body}>{t("mobile:assistant.booking.rental", { amount: money(quote.rental) })}</Text>
      {quote.rentalDiscount > 0 ? <Text style={styles.body}>{t("mobile:assistant.booking.rentalDiscount", { amount: money(quote.rentalDiscount) })}</Text> : null}
      {quote.promotionDiscount > 0 ? <Text style={styles.body}>{t("mobile:assistant.booking.promotion", { amount: money(quote.promotionDiscount) })}</Text> : null}
      {quote.deliveryDistanceKm != null || (quote.deliveryFee ?? 0) > 0 ? <Text style={styles.body}>{delivery}</Text> : null}
      <Text style={styles.total}>{t("mobile:assistant.booking.total", { amount: money(quote.total) })}</Text>
      <Text style={styles.body}>{t("mobile:assistant.booking.deposit", { amount: money(quote.deposit) })}</Text>
      <Text style={styles.body}>{t("mobile:assistant.booking.securityDeposit", { amount: money(quote.securityDeposit) })}</Text>
      <Text style={styles.muted}>{pickupNote}</Text>
      {slots?.returnAddress ? <Text style={styles.muted}>{t("mobile:assistant.booking.returnAddress", { address: slots.returnAddress })}</Text> : null}
    </View>
  );
}

export function BookingPaymentCard({
  conversationId,
  bookingId,
  initial,
  onViewBooking,
}: {
  conversationId: string;
  bookingId: number;
  initial?: PaymentLink;
  onViewBooking?: (id: number) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);
  const [payment, setPayment] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const actionLock = useRef(false);
  const safeCheckout = checkoutUrl(payment?.checkoutUrl);

  async function openCheckout() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const link = safeCheckout && payment ? payment : await getDraftPaymentLink(conversationId);
      setPayment(link);
      const url = checkoutUrl(link.checkoutUrl);
      if (url) {
        await Linking.openURL(url);
      } else {
        setMessage(t("mobile:assistant.booking.payment.invalidLink"));
      }
    } catch (err) {
      setMessage(getApiErrorMessage(err, t("mobile:assistant.booking.payment.connectFailed")));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function checkPaid() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const result = await getAssistantPaymentStatus(bookingId);
      setMessage(
        typeof result.status === "string"
          ? t("mobile:assistant.booking.payment.notRecorded")
          : result.status.isConfirmed
            ? t("mobile:assistant.booking.payment.recorded")
            : result.status.message,
      );
    } catch (err) {
      setMessage(getApiErrorMessage(err, t("mobile:assistant.booking.payment.checkFailed")));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.paymentCard}>
      <Pressable disabled={!onViewBooking} onPress={() => onViewBooking?.(bookingId)}><Text style={styles.cardTitle}>{t("mobile:assistant.booking.payment.viewBooking", { id: bookingId })}</Text></Pressable>
      {safeCheckout ? (
        <Pressable disabled={busy} onPress={openCheckout} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{t("mobile:assistant.booking.payment.openCheckout")}</Text>
        </Pressable>
      ) : (
        <Pressable disabled={busy} onPress={openCheckout} style={styles.primaryButton}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>{t("mobile:assistant.booking.payment.getLink")}</Text>}
        </Pressable>
      )}
      {!!safeCheckout && !!payment?.qrCode && <View accessibilityLabel={t("mobile:assistant.booking.payment.qr")} style={{ alignItems: "center", padding: 8 }}><QRCode value={payment.qrCode} size={160} quietZone={8} /></View>}
      <Pressable disabled={busy} onPress={checkPaid}>
        <Text style={styles.link}>{t("mobile:assistant.booking.payment.checkPaid")}</Text>
      </Pressable>
      {message ? <Text style={styles.body}>{message}</Text> : null}
    </View>
  );
}

export function ConfirmationCard({
  conversationId,
  proposal,
  onChanged,
  onBooked,
  onViewBooking,
  disabled = false,
}: {
  conversationId: string;
  proposal: BookingDraft | CancellationProposal;
  onChanged?: () => void;
  onBooked?: (bookingId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);
  const [current, setCurrent] = useState(proposal);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const actionLock = useRef(false);

  useEffect(() => { const delay = Date.parse(current.expiresAt) - Date.now(); if (!Number.isFinite(delay) || delay <= 0) return; const timer = setTimeout(() => tick(value => value + 1), Math.min(delay + 1, 2147483647)); return () => clearTimeout(timer); }, [current.expiresAt]);

  useEffect(() => {
    setCurrent(proposal);
    setAck(false);
    setResult(null);
  }, [proposal.confirmToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = "kind" in current;
  const bookingDraft = cancel ? null : (current as BookingDraft);
  const rose = !!bookingDraft?.quote && bookingDraft.previousTotal != null && bookingDraft.quote.total > bookingDraft.previousTotal;

  async function confirm() {
    if (disabled || actionIsExpired(current) || !current.confirmToken || actionLock.current || Boolean(rose && !ack)) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await confirmAction(current.confirmToken, ack);
      if (response.status === "PriceChanged" && response.draft) {
        setCurrent(response.draft);
        setAck(false);
        setError(response.message ?? t("mobile:assistant.booking.confirm.priceChanged"));
      } else {
        setResult(response);
        if (!cancel && response.status === "PaymentPending" && Number.isSafeInteger(response.bookingId) && response.bookingId! > 0) {
          // A custom completion handler owns navigation; otherwise use the
          // existing booking-detail route (which also closes the chat modal).
          (onBooked ?? onViewBooking)?.(response.bookingId!);
        }
      }
      onChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, t("mobile:assistant.booking.confirm.expired")));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function requote() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await getDraft(conversationId);
      if (latest) {
        setCurrent(await prepareDraft(conversationId, latest.version));
        setAck(false);
        onChanged?.();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t("mobile:assistant.booking.confirm.requoteFailed")));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.confirmCard}>
      {cancel ? (
        <>
          <Text style={styles.cardTitle}>{t("mobile:assistant.booking.confirm.cancelTitle", { id: (current as CancellationProposal).bookingId })}</Text>
          <Text style={styles.body}>{(current as CancellationProposal).quote.policyMessage}</Text>
          <Text style={styles.body}>
            {t("mobile:assistant.booking.confirm.refund", {
              amount: money((current as CancellationProposal).quote.refundAmount),
              forfeited: money((current as CancellationProposal).quote.forfeitedAmount),
            })}
          </Text>
        </>
      ) : (
        bookingDraft?.quote && <QuoteCard quote={bookingDraft.quote} slots={bookingDraft.slots} />
      )}
      {rose && !result ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ack }} disabled={busy} onPress={() => setAck(value => !value)}><Text style={styles.warn}>{ack ? "✓ " : "☐ "}{t("mobile:assistant.booking.confirm.rose")}</Text></Pressable> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {result ? (
        <>
          <Text style={styles.cardTitle}>
            {result.status === "Cancelled" ? t("mobile:assistant.booking.confirm.cancelled") : t("mobile:assistant.booking.confirm.created")}
          </Text>
          {result.message ? <Text style={styles.body}>{result.message}</Text> : null}
          {result.status === "PaymentPending" && result.bookingId ? (
            <BookingPaymentCard conversationId={conversationId} bookingId={result.bookingId} initial={result.payment} onViewBooking={onViewBooking} />
          ) : null}
        </>
      ) : (
        <>
          <Pressable
            disabled={disabled || actionIsExpired(current) || busy || !current.confirmToken || Boolean(rose && !ack)}
            onPress={() => void confirm()}
            style={[styles.primaryButton, (busy || !current.confirmToken || Boolean(rose && !ack)) && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryText}>{cancel ? t("mobile:assistant.booking.confirm.cancelAction") : t("mobile:assistant.booking.confirm.bookAction")}</Text>
            )}
          </Pressable>
          {!cancel ? (
            <Pressable disabled={busy} onPress={() => void requote()}>
              <Text style={styles.link}>{t("mobile:assistant.booking.confirm.requote")}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

export const AgentBlocks = memo(function AgentBlocks({
  blocks,
  conversationId,
  onChanged,
  onBooked,
  onViewBooking,
  disabled = false,
}: {
  blocks: AssistantBlock[];
  conversationId: string;
  onChanged: () => void;
  onBooked?: (bookingId: number) => void;
  onViewBooking?: (bookingId: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "confirmCard")
          return (
            <ConfirmationCard
              key={index}
              conversationId={conversationId}
              proposal={block.data as unknown as BookingDraft | CancellationProposal}
              onChanged={onChanged}
              onBooked={onBooked}
              onViewBooking={onViewBooking}
              disabled={disabled}
            />
          );
        if (block.type === "quoteCard") return <QuoteCard key={index} quote={block.data as unknown as AssistantQuote} />;
        if (block.type === "draftCard")
          return (
            <Text key={index} style={{ color: "#6b7280", fontSize: 12 }}>
              {t("mobile:assistant.booking.confirm.draftSaved")}
            </Text>
          );
        return null;
      })}
    </>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    quoteCard: { gap: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, backgroundColor: theme.surface },
    paymentCard: { gap: 8, marginTop: 8, borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 12, padding: 12, backgroundColor: theme.brandSoft },
    confirmCard: { gap: 8, marginTop: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, backgroundColor: theme.surface },
    cardTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    body: { color: theme.text, fontSize: 12, lineHeight: 18 },
    muted: { color: theme.muted, fontSize: 12 },
    total: { color: theme.text, fontSize: 13, fontWeight: "800" },
    warn: { color: "#92400e", backgroundColor: "#fef3c7", fontSize: 12, borderRadius: 8, padding: 8 },
    error: { color: theme.danger, fontSize: 12 },
    primaryButton: { borderRadius: 12, backgroundColor: theme.brand, paddingVertical: 12, alignItems: "center" },
    disabled: { opacity: 0.4 },
    primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    link: { color: theme.brand, fontSize: 12, fontWeight: "700" },
  });
