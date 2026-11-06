import { memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
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
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const formatDateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

function checkoutUrl(value?: string) {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}

export function QuoteCard({ quote, slots }: { quote: AssistantQuote; slots?: DraftSlots }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.quoteCard}>
      <Text style={styles.cardTitle}>Báo giá chuyến đi</Text>
      <Text style={styles.body}>
        {formatDateTime(quote.startAt)} → {formatDateTime(quote.endAt)}
      </Text>
      <Text style={styles.body}>Tiền thuê: {money(quote.rental)}</Text>
      {quote.rentalDiscount > 0 ? <Text style={styles.body}>Giảm theo thời gian thuê: −{money(quote.rentalDiscount)}</Text> : null}
      {quote.promotionDiscount > 0 ? <Text style={styles.body}>Khuyến mãi: −{money(quote.promotionDiscount)}</Text> : null}
      {quote.deliveryDistanceKm != null || (quote.deliveryFee ?? 0) > 0 ? <Text style={styles.body}>Phí giao xe{quote.deliveryDistanceKm != null ? ` (${quote.deliveryDistanceKm} km)` : ""}: {(quote.deliveryFee ?? 0) > 0 ? money(quote.deliveryFee!) : "Miễn phí"}</Text> : null}
      <Text style={styles.total}>Tổng tiền thuê: {money(quote.total)}</Text>
      <Text style={styles.body}>Thanh toán trước: {money(quote.deposit)}</Text>
      <Text style={styles.body}>Tiền bảo đảm: {money(quote.securityDeposit)}</Text>
      <Text style={styles.muted}>{slots?.pickupMode === "delivery" || quote.deliveryDistanceKm != null ? `Giao xe${slots?.pickupAddress ? `: ${slots.pickupAddress}` : " tới địa chỉ đã chọn"}.` : "Nhận xe tại địa chỉ của chủ xe."} Giá được kiểm tra lại khi xác nhận.</Text>
      {slots?.returnAddress ? <Text style={styles.muted}>Trả xe: {slots.returnAddress}</Text> : null}
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
        setMessage("Đường dẫn thanh toán không hợp lệ.");
      }
    } catch (err) {
      setMessage(getApiErrorMessage(err, "Chưa kết nối được thanh toán. Bạn có thể mở đơn để thử lại."));
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
          ? "Chưa ghi nhận thanh toán."
          : result.status.isConfirmed
            ? "Đã ghi nhận thanh toán."
            : result.status.message,
      );
    } catch (err) {
      setMessage(getApiErrorMessage(err, "Chưa kiểm tra được thanh toán."));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.paymentCard}>
      <Pressable disabled={!onViewBooking} onPress={() => onViewBooking?.(bookingId)}><Text style={styles.cardTitle}>Xem đơn #{bookingId}</Text></Pressable>
      {safeCheckout ? (
        <Pressable disabled={busy} onPress={openCheckout} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Mở trang thanh toán</Text>
        </Pressable>
      ) : (
        <Pressable disabled={busy} onPress={openCheckout} style={styles.primaryButton}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryText}>Lấy đường dẫn thanh toán</Text>}
        </Pressable>
      )}
      {!!safeCheckout && !!payment?.qrCode && <View accessibilityLabel="Mã QR thanh toán" style={{ alignItems: "center", padding: 8 }}><QRCode value={payment.qrCode} size={160} quietZone={8} /></View>}
      <Pressable disabled={busy} onPress={checkPaid}>
        <Text style={styles.link}>Tôi đã thanh toán — kiểm tra</Text>
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
        setError(response.message ?? "Giá thay đổi, vui lòng xác nhận lại.");
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
      setError(getApiErrorMessage(err, "Xác nhận đã hết hạn hoặc thông tin đã thay đổi. Vui lòng báo giá lại."));
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
      setError(getApiErrorMessage(err, "Chưa thể báo giá lại."));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.confirmCard}>
      {cancel ? (
        <>
          <Text style={styles.cardTitle}>Xác nhận hủy đơn #{(current as CancellationProposal).bookingId}</Text>
          <Text style={styles.body}>{(current as CancellationProposal).quote.policyMessage}</Text>
          <Text style={styles.body}>
            Hoàn: {money((current as CancellationProposal).quote.refundAmount)} · Khấu trừ:{" "}
            {money((current as CancellationProposal).quote.forfeitedAmount)}
          </Text>
        </>
      ) : (
        bookingDraft?.quote && <QuoteCard quote={bookingDraft.quote} slots={bookingDraft.slots} />
      )}
      {rose && !result ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ack }} disabled={busy} onPress={() => setAck(value => !value)}><Text style={styles.warn}>{ack ? "✓ " : "☐ "}Giá tăng so với báo giá trước. Tôi đồng ý giá mới.</Text></Pressable> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {result ? (
        <>
          <Text style={styles.cardTitle}>
            {result.status === "Cancelled" ? "Đơn đã hủy." : "Đơn đã tạo, bạn có thể thanh toán bên dưới."}
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
              <Text style={styles.primaryText}>{cancel ? "Xác nhận hủy đơn" : "Xác nhận đặt xe"}</Text>
            )}
          </Pressable>
          {!cancel ? (
            <Pressable disabled={busy} onPress={() => void requote()}>
              <Text style={styles.link}>Báo giá lại</Text>
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
              Thông tin đặt xe đã lưu. Bạn có thể tiếp tục trong chat hoặc mở Đặt xe nhanh.
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
