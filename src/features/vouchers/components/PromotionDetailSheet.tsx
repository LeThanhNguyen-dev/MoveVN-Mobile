import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { AlertTriangle, Check, Copy, Info, Lock, TicketPercent, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { showToast } from "@/features/notifications/toastStore";
import {
  CTA_GRADIENT,
  formatDiscountLong,
  formatVnd,
  formatVehicleLabelShort,
  formatVoucherDateTime,
  voucherUsagePercent,
} from "@/features/vouchers/voucherFormat";

export type PromotionDetailSlide = {
  id: string | number;
  image?: string | null;
  title: string;
  caption?: string | null;
  code?: string | null;
  popupTitle?: string;
  popupDescription?: string | null;
  popupCtaLabel?: string;
  promotionId?: number | null;
  promotionName?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  vehicleType?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  usageCount?: number | null;
  maxUsageCount?: number | null;
  /** Cảnh báo campaign-level hiển thị trong sheet (không phải lý do từ chối của một chủ xe). */
  warning?: string | null;
  /** Phạm vi chiến dịch + số chủ xe đã tham gia. */
  scopeNote?: string | null;
};

type PromotionDetailSheetProps = {
  slide: PromotionDetailSlide | null;
  onClose: () => void;
  /** Điều hướng sang màn Săn mã kèm promotionId (mirror web navigate ctaTo). */
  onCta: (promotionId: number) => void;
  /** Ẩn CTA khi chỉ dùng sheet để xem thông tin (vd. trang Lịch sử). */
  hideCta?: boolean;
};

/**
 * Bottom sheet chi tiết khuyến mãi trên mobile (mirror web PromotionDetailModal):
 * nền đen bấm đóng, nút X, drag handle, footer CTA sticky,
 * hiệu ứng 380ms "Đang mở săn voucher... ✓" trước khi điều hướng.
 */
function PromotionDetailSheet({ slide, onClose, onCta, hideCta = false }: PromotionDetailSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setClaimed(false);
    setCopied(false);
  }, [slide?.id]);

  if (!slide) return null;

  const discount = formatDiscountLong(slide.discountType, slide.discountValue);
  const vehicleLabel = slide.vehicleType ? formatVehicleLabelShort(slide.vehicleType) : null;
  const endLabel = formatVoucherDateTime(slide.endAt);
  const startLabel = formatVoucherDateTime(slide.startAt);
  const vehicleValueLabel = vehicleLabel;
  const vehicleText = vehicleValueLabel ?? t("mobile:voucher.detail.allVehicles");
  const code = slide.code ?? null;
  const effectiveTitle =
    slide.promotionName || slide.popupTitle || slide.title || t("mobile:voucher.detail.fallbackTitle");
  const hasPromotion =
    slide.promotionId != null && (slide.code != null || slide.promotionName != null);
  const usagePercent =
    slide.maxUsageCount && slide.maxUsageCount > 0 && slide.usageCount != null
      ? voucherUsagePercent(slide.usageCount, slide.maxUsageCount)
      : null;

  // Danh sách điều kiện áp dụng (mirror web PromotionDetailModal conditions).
  const vehicleLower = vehicleLabel
    ? vehicleLabel.toLocaleLowerCase("vi-VN")
    : t("mobile:voucher.detail.allVehiclesLower");
  const conditions: string[] = [];
  if (discount) {
    conditions.push(
      slide.maxDiscountAmount != null && slide.maxDiscountAmount > 0
        ? t("mobile:voucher.detail.conditionDiscountMax", {
            discount,
            maxDiscountAmount: formatVnd(slide.maxDiscountAmount),
          })
        : t("mobile:voucher.detail.conditionDiscount", { discount }),
    );
  }
  conditions.push(
    slide.minOrderAmount != null && slide.minOrderAmount > 0
      ? t("mobile:voucher.detail.conditionMinOrder", {
          minOrderAmount: formatVnd(slide.minOrderAmount),
        })
      : t("mobile:voucher.detail.conditionNoMinOrder"),
  );
  if (vehicleLabel) {
    conditions.push(t("mobile:voucher.detail.conditionVehicle", { vehicle: vehicleLower }));
  }
  if (usagePercent !== null) {
    conditions.push(
      t("mobile:voucher.detail.conditionUsageLimit", {
        maxUsage: Number(slide.maxUsageCount).toLocaleString("vi-VN"),
        usage: Number(slide.usageCount).toLocaleString("vi-VN"),
      }),
    );
  }
  conditions.push(t("mobile:voucher.detail.conditionOncePerAccount"));
  conditions.push(t("mobile:voucher.detail.conditionNoStacking"));

  const ctaBlockedReason = slide.warning ?? null;

  function handleCta() {
    if (claimed || slide?.promotionId == null) return;
    if (ctaBlockedReason) {
      showToast({
        type: "info",
        title: slide.popupCtaLabel || t("promo:hunt.claim"),
        message: ctaBlockedReason,
      });
      return;
    }
    setClaimed(true);
    const promotionId = slide.promotionId;
    setTimeout(() => onCta(promotionId), 380);
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showToast({ type: "success", title: t("promo:hunt.copiedTitle"), message: code });
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("mobile:voucher.detail.closeAria")}
        />
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t("common:closeAction")}
            hitSlop={8}
          >
            <X color={theme.mode === "dark" ? "#E4E4E7" : "#3F3F46"} size={18} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <View style={styles.heroCard}>
              <AppText style={styles.heroEyebrow}>{t("mobile:voucher.detail.eyebrow")}</AppText>
              <AppText display style={styles.heroTitle}>
                {effectiveTitle}
              </AppText>
              {slide.popupDescription ? (
                <AppText style={styles.heroDesc}>
                  {slide.popupDescription}
                </AppText>
              ) : (
                <AppText style={styles.heroDesc}>
                  {t("mobile:voucher.detail.fallbackDescription")}
                </AppText>
              )}
              <AppText style={styles.heroVehicle}>
                {t("mobile:voucher.detail.applicableTo", { vehicle: vehicleLower })}
              </AppText>
            </View>

            {slide.warning ? (
              <View style={[styles.notice, styles.noticeWarning]}>
                <AlertTriangle
                  color={theme.mode === "dark" ? "#FBBF24" : "#B45309"}
                  size={13}
                />
                <AppText style={styles.noticeWarningText}>{slide.warning}</AppText>
              </View>
            ) : null}

            {code ? (
              <View style={styles.codeRow}>
                <View style={styles.codeBox}>
                  <AppText style={styles.codeLabel}>{t("mobile:voucher.detail.codeLabel")}</AppText>
                  <AppText style={styles.codeText}>
                    {code}
                  </AppText>
                </View>
                <Pressable
                  onPress={handleCopy}
                  style={styles.copyButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile:voucher.detail.copyCodeAria")}
                >
                  {copied ? (
                    <Check color="#FFFFFF" size={14} />
                  ) : (
                    <Copy color="#FFFFFF" size={14} />
                  )}
                  <AppText style={styles.copyButtonText}>
                    {copied ? t("mobile:voucher.detail.copied") : t("mobile:voucher.detail.copy")}
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {usagePercent !== null ? (
              <View style={styles.usageWrap}>
                <View style={styles.usageHead}>
                  <AppText style={styles.usageLabel}>
                    {t("mobile:voucher.detail.usedPercent", { percent: Math.round(usagePercent) })}
                  </AppText>
                  <AppText style={styles.usageCount}>
                    {t("mobile:voucher.detail.usageCount", {
                      used: Number(slide.usageCount).toLocaleString("vi-VN"),
                      maxUsage: Number(slide.maxUsageCount).toLocaleString("vi-VN"),
                    })}
                  </AppText>
                </View>
                <View style={styles.usageTrack}>
                  <LinearGradient
                    colors={[CTA_GRADIENT[1], "#4F46E5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.usageFill, { width: `${usagePercent}%` }]}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.metaList}>
              <View style={styles.metaRow}>
                <AppText style={styles.metaLabel}>{t("mobile:voucher.detail.validityLabel")}:</AppText>
                <View style={styles.metaValueColumn}>
                  {startLabel ? (
                    <AppText style={styles.metaValue}>
                      {t("mobile:voucher.detail.fromDate", { date: startLabel })}
                    </AppText>
                  ) : null}
                  {endLabel ? (
                    <AppText style={styles.metaValue}>
                      {t("mobile:voucher.detail.untilDate", { date: endLabel })}
                    </AppText>
                  ) : null}
                  {!startLabel && !endLabel ? (
                    <AppText style={styles.metaValue}>
                      {t("mobile:voucher.detail.unlimited")}
                    </AppText>
                  ) : null}
                </View>
              </View>
              <View style={styles.metaRow}>
                <AppText style={styles.metaLabel}>
                  {t("mobile:voucher.detail.vehicleFieldLabel")}:
                </AppText>
                <AppText style={styles.metaValue}>{vehicleText}</AppText>
              </View>
            </View>

            <View style={styles.conditionsBox}>
              <View style={styles.conditionsTitleRow}>
                <View style={styles.conditionsDot} />
                <AppText style={styles.conditionsTitle}>
                  {t("mobile:voucher.detail.conditionsTitle")}
                </AppText>
              </View>
              {conditions.map((condition) => (
                <View key={condition} style={styles.conditionRow}>
                  <AppText style={styles.conditionBullet}>•</AppText>
                  <AppText style={styles.conditionText}>{condition}</AppText>
                </View>
              ))}
            </View>

            {slide.scopeNote ? (
              <View style={[styles.notice, styles.noticeInfo]}>
                <Info color={theme.brand} size={13} />
                <AppText style={styles.noticeInfoText}>{slide.scopeNote}</AppText>
              </View>
            ) : null}
          </ScrollView>

          {hasPromotion && !hideCta ? (
            <View style={styles.footer}>
              <Pressable
                onPress={handleCta}
                disabled={claimed}
                style={styles.ctaTouch}
                accessibilityRole="button"
                accessibilityState={{ disabled: claimed || Boolean(ctaBlockedReason) }}
                accessibilityLabel={slide.popupCtaLabel || t("promo:hunt.claim")}
              >
                <LinearGradient
                  colors={
                    claimed
                      ? (["#10B981", "#14B8A6"] as const)
                      : ctaBlockedReason
                        ? (["#9CA3AF", "#6B7280"] as const)
                        : [CTA_GRADIENT[0], CTA_GRADIENT[1], CTA_GRADIENT[2]]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaBg}
                >
                  {claimed ? (
                    <AppText style={styles.ctaText}>
                      {t("mobile:voucher.detail.openingClaim")}
                    </AppText>
                  ) : ctaBlockedReason ? (
                    <>
                      <Lock color="#FFFFFF" size={15} />
                      <AppText style={styles.ctaText}>
                        {slide.popupCtaLabel || t("promo:hunt.claim")}
                      </AppText>
                    </>
                  ) : (
                    <>
                      <TicketPercent color="#FFFFFF" size={15} />
                      <AppText style={styles.ctaText}>
                        {slide.popupCtaLabel || t("promo:hunt.claim")}
                      </AppText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default memo(PromotionDetailSheet);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
      width: "100%",
      maxHeight: "88%",
      backgroundColor: theme.mode === "dark" ? "#202029" : "#FFFFFF",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
    },
    dragHandle: {
      alignSelf: "center",
      width: 40,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? "#52525B" : "#D4D4D8",
      marginTop: 10,
      marginBottom: 4,
    },
    closeButton: {
      position: "absolute",
      right: 12,
      top: 16,
      zIndex: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    body: { padding: 16, gap: 12 },
    heroCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      padding: 14,
      gap: 4,
    },
    heroEyebrow: {
      color: theme.brand,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    heroTitle: { color: theme.text, fontSize: 17, fontWeight: "900", lineHeight: 22 },
    heroDesc: { color: theme.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
    heroVehicle: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    codeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    codeBox: {
      flex: 1,
      minWidth: 0,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
    },
    codeLabel: { color: theme.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    codeText: { color: theme.text, fontSize: 14, fontWeight: "800", fontFamily: "monospace", flexShrink: 1 },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexShrink: 0,
    },
    copyButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
    usageWrap: { gap: 5 },
    usageHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    usageLabel: { color: theme.muted, fontSize: 11, fontWeight: "700" },
    usageCount: { color: theme.brand, fontSize: 11, fontWeight: "800" },
    usageTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
      overflow: "hidden",
    },
    usageFill: { height: "100%", borderRadius: 3 },
    metaList: { gap: 4 },
    metaRow: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", gap: 4 },
    metaLabel: { color: theme.faint, fontSize: 11, fontWeight: "600" },
    metaValue: { color: theme.text, fontSize: 12, fontWeight: "700", flexShrink: 1 },
    metaValueColumn: { flexShrink: 1, gap: 1 },
    conditionsBox: { gap: 6 },
    conditionsTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    conditionsTitle: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },
    conditionsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.brand,
    },
    conditionRow: { flexDirection: "row", gap: 6 },
    conditionBullet: { color: theme.brand, fontSize: 11, fontWeight: "900", lineHeight: 16 },
    conditionText: { flex: 1, color: theme.muted, fontSize: 11, lineHeight: 16 },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    noticeWarning: {
      borderColor: theme.mode === "dark" ? "rgba(245,158,11,0.35)" : "#FDE68A",
      backgroundColor: theme.mode === "dark" ? "rgba(245,158,11,0.12)" : "#FFFBEB",
    },
    noticeWarningText: {
      flex: 1,
      color: theme.mode === "dark" ? "#FCD34D" : "#92400E",
      fontSize: 11.5,
      lineHeight: 16,
    },
    noticeInfo: {
      borderColor: theme.border,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F8FAFC",
    },
    noticeInfoText: { flex: 1, color: theme.muted, fontSize: 11.5, lineHeight: 16 },
    footer: {
      padding: 16,
      backgroundColor: theme.mode === "dark" ? "rgba(32,32,41,0.95)" : "rgba(255,255,255,0.95)",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    ctaTouch: { borderRadius: 12 },
    ctaBg: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 52,
      borderRadius: 12,
    },
    ctaText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  });
