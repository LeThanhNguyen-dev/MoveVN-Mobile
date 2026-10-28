import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { CalendarDays, Car, Check, Copy, Expand, TicketPercent, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { showToast } from "@/features/notifications/toastStore";
import {
  CTA_GRADIENT,
  formatDiscountLong,
  formatEndDate,
  formatVnd,
  formatVehicleLabelShort,
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
};

type PromotionDetailSheetProps = {
  slide: PromotionDetailSlide | null;
  onClose: () => void;
  /** Điều hướng sang màn Săn mã kèm promotionId (mirror web navigate ctaTo). */
  onCta: (promotionId: number) => void;
};

/**
 * Bottom sheet chi tiết khuyến mãi trên mobile (mirror web PromotionDetailModal):
 * nền đen bấm đóng, nút X, drag handle, footer CTA sticky,
 * hiệu ứng 380ms "Đang mở săn voucher... ✓" trước khi điều hướng.
 */
function PromotionDetailSheet({ slide, onClose, onCta }: PromotionDetailSheetProps) {
  const { theme } = useTheme();
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
  const endLabel = formatEndDate(slide.endAt);
  const startLabel = formatEndDate(slide.startAt);
  const code = slide.code ?? null;
  const effectiveTitle = slide.promotionName || slide.popupTitle || slide.title || "Chi tiết khuyến mãi";
  const hasPromotion =
    slide.promotionId != null && (slide.code != null || slide.promotionName != null);
  const usagePercent =
    slide.maxUsageCount && slide.maxUsageCount > 0 && slide.usageCount != null
      ? voucherUsagePercent(slide.usageCount, slide.maxUsageCount)
      : null;

  // Danh sách điều kiện áp dụng (mirror web PromotionDetailModal conditions).
  const conditions: string[] = [];
  if (discount) {
    conditions.push(
      slide.maxDiscountAmount != null && slide.maxDiscountAmount > 0
        ? `${discount} trên mỗi chuyến đi hợp lệ, tối đa ${formatVnd(slide.maxDiscountAmount)}.`
        : `${discount} trên mỗi chuyến đi hợp lệ.`,
    );
  }
  conditions.push(
    slide.minOrderAmount != null && slide.minOrderAmount > 0
      ? `Chỉ áp dụng cho đơn chuyến đi có giá trị tối thiểu ${formatVnd(slide.minOrderAmount)}.`
      : "Không yêu cầu giá trị đơn chuyến đi tối thiểu.",
  );
  if (vehicleLabel) conditions.push(`Áp dụng cho ${vehicleLabel.toLocaleLowerCase("vi-VN")} của MoveVN.`);
  if (usagePercent !== null) {
    conditions.push(
      `Số lượt phát hành giới hạn ${Number(slide.maxUsageCount).toLocaleString("vi-VN")} lượt, hiện đã dùng ${Number(
        slide.usageCount,
      ).toLocaleString("vi-VN")} lượt.`,
    );
  }
  conditions.push("Mỗi tài khoản chỉ được dùng tối đa 1 lần cho mỗi mã ưu đãi.");
  conditions.push("Không áp dụng đồng thời với chương trình ưu đãi khác và không quy đổi được thành tiền mặt.");

  function handleCta() {
    if (claimed || slide?.promotionId == null) return;
    setClaimed(true);
    const promotionId = slide.promotionId;
    setTimeout(() => onCta(promotionId), 380);
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showToast({ type: "success", title: "Đã sao chép mã", message: code });
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
          accessibilityLabel="Đóng chi tiết khuyến mãi"
        />
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            hitSlop={8}
          >
            <X color={theme.mode === "dark" ? "#E4E4E7" : "#3F3F46"} size={18} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {!!slide.image ? (
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: slide.image }}
                  style={styles.image}
                  contentFit="cover"
                  transition={250}
                  accessibilityLabel={slide.title}
                />
                <View style={styles.imageBadge}>
                  <Expand color="#FFFFFF" size={14} />
                </View>
              </View>
            ) : null}

            <View style={styles.heroCard}>
              <LinearGradient
                colors={[CTA_GRADIENT[0], CTA_GRADIENT[1], "#4F46E5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <AppText style={styles.heroEyebrow}>CHI TIẾT ƯU ĐÃI</AppText>
              <AppText display style={styles.heroTitle}>
                {effectiveTitle}
              </AppText>
              {slide.popupDescription ? (
                <AppText style={styles.heroDesc} numberOfLines={3}>
                  {slide.popupDescription}
                </AppText>
              ) : (
                <AppText style={styles.heroDesc}>Ưu đãi MoveVN đang diễn ra.</AppText>
              )}
              <AppText style={styles.heroVehicle}>
                Áp dụng cho {vehicleLabel ? vehicleLabel.toLocaleLowerCase("vi-VN") : "tất cả xe"}.
              </AppText>
            </View>

            {code ? (
              <View style={styles.codeRow}>
                <View style={styles.codeBox}>
                  <AppText style={styles.codeLabel}>MÃ ƯU ĐÃI</AppText>
                  <AppText style={styles.codeText} numberOfLines={1}>
                    {code}
                  </AppText>
                </View>
                <Pressable
                  onPress={handleCopy}
                  style={styles.copyButton}
                  accessibilityRole="button"
                  accessibilityLabel="Sao chép mã ưu đãi"
                >
                  {copied ? (
                    <Check color="#FFFFFF" size={14} />
                  ) : (
                    <Copy color="#FFFFFF" size={14} />
                  )}
                  <AppText style={styles.copyButtonText}>{copied ? "Đã sao chép" : "Sao chép"}</AppText>
                </Pressable>
              </View>
            ) : null}

            {usagePercent !== null ? (
              <View style={styles.usageWrap}>
                <View style={styles.usageHead}>
                  <AppText style={styles.usageLabel}>Đã dùng {Math.round(usagePercent)}%</AppText>
                  <AppText style={styles.usageCount}>
                    {Number(slide.usageCount).toLocaleString("vi-VN")}/
                    {Number(slide.maxUsageCount).toLocaleString("vi-VN")} lượt
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

            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <View style={styles.metaLabelRow}>
                  <CalendarDays color={theme.faint} size={12} />
                  <AppText style={styles.metaLabel}>Thời hạn</AppText>
                </View>
                <AppText style={styles.metaValue}>
                  {endLabel ? `Đến ${endLabel}` : startLabel ? `Từ ${startLabel}` : "Không giới hạn"}
                </AppText>
              </View>
              <View style={styles.metaCell}>
                <View style={styles.metaLabelRow}>
                  <Car color={theme.faint} size={12} />
                  <AppText style={styles.metaLabel}>Phương tiện</AppText>
                </View>
                <AppText style={styles.metaValue}>{vehicleLabel ?? "Tất cả xe"}</AppText>
              </View>
            </View>

            <View style={styles.conditionsBox}>
              <View style={styles.conditionsTitleRow}>
                <View style={styles.conditionsDot} />
                <AppText style={styles.conditionsTitle}>ĐIỀU KIỆN ÁP DỤNG</AppText>
              </View>
              {conditions.map((condition) => (
                <View key={condition} style={styles.conditionRow}>
                  <AppText style={styles.conditionBullet}>•</AppText>
                  <AppText style={styles.conditionText}>{condition}</AppText>
                </View>
              ))}
            </View>
          </ScrollView>

          {hasPromotion ? (
            <View style={styles.footer}>
              <Pressable
                onPress={handleCta}
                disabled={claimed}
                style={styles.ctaTouch}
                accessibilityRole="button"
                accessibilityLabel={slide.popupCtaLabel || "Nhận voucher"}
              >
                <LinearGradient
                  colors={
                    claimed
                      ? (["#10B981", "#14B8A6"] as const)
                      : [CTA_GRADIENT[0], CTA_GRADIENT[1], CTA_GRADIENT[2]]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaBg}
                >
                  {claimed ? (
                    <AppText style={styles.ctaText}>Đang mở săn voucher... ✓</AppText>
                  ) : (
                    <>
                      <TicketPercent color="#FFFFFF" size={15} />
                      <AppText style={styles.ctaText}>{slide.popupCtaLabel || "Nhận voucher"}</AppText>
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
    imageWrap: { borderRadius: 16, overflow: "hidden" },
    image: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.surfaceAlt },
    imageBadge: {
      position: "absolute",
      right: 8,
      bottom: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15,23,42,0.55)",
    },
    heroCard: {
      borderRadius: 14,
      padding: 14,
      gap: 4,
      overflow: "hidden",
    },
    heroEyebrow: {
      color: "#FDE68A",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.4,
    },
    heroTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", lineHeight: 22 },
    heroDesc: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 17 },
    heroVehicle: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "600" },
    codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    codeBox: {
      flex: 1,
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
    codeText: { color: theme.text, fontSize: 14, fontWeight: "800", fontFamily: "monospace" },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 10,
      backgroundColor: "#7C3AED",
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
    metaGrid: { flexDirection: "row", gap: 8 },
    metaCell: {
      flex: 1,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F8FAFC",
      padding: 10,
      gap: 4,
    },
    metaLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaLabel: { color: theme.faint, fontSize: 10, fontWeight: "600" },
    metaValue: { color: theme.text, fontSize: 11, fontWeight: "800" },
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
