import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, CalendarDays, Car, Check, TicketPercent, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { CTA_GRADIENT, formatDiscountLong, formatEndDate, formatVehicleLabel } from "@/features/vouchers/voucherFormat";

export type PromotionDetailSlide = {
  id: string | number;
  image?: string | null;
  title: string;
  code?: string | null;
  popupTitle?: string;
  popupDescription?: string | null;
  popupCtaLabel?: string;
  promotionId?: number | null;
  promotionName?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  vehicleType?: string | null;
  endAt?: string | null;
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

  useEffect(() => {
    setClaimed(false);
  }, [slide?.id]);

  if (!slide) return null;

  const discount = formatDiscountLong(slide.discountType, slide.discountValue);
  const vehicleLabel = slide.vehicleType ? formatVehicleLabel(slide.vehicleType) : null;
  const endLabel = formatEndDate(slide.endAt);
  const code = slide.code ?? null;
  const effectiveTitle = slide.promotionName || slide.popupTitle || slide.title || "Chi tiết khuyến mãi";
  const hasPromotion =
    slide.promotionId != null && (slide.code != null || slide.promotionName != null);

  function handleCta() {
    if (claimed || slide?.promotionId == null) return;
    setClaimed(true);
    const promotionId = slide.promotionId;
    setTimeout(() => onCta(promotionId), 380);
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
            {!!slide.image && (
              <Image
                source={{ uri: slide.image }}
                style={styles.image}
                contentFit="cover"
                transition={250}
                accessibilityLabel={slide.title}
              />
            )}
            <AppText display style={styles.title}>{slide.popupTitle || slide.title}</AppText>
            <View style={styles.divider} />
            {!!slide.popupDescription && <AppText style={styles.desc}>{slide.popupDescription}</AppText>}

            <View style={styles.chipRow}>
              {!!code && (
                <View style={styles.chip}>
                  <TicketPercent color={theme.brand} size={13} />
                  <AppText style={[styles.chipText, styles.chipMono]}>{code}</AppText>
                </View>
              )}
              {!!discount && (
                <View style={styles.chip}>
                  <AppText style={styles.chipText}>{discount}</AppText>
                </View>
              )}
              {!!vehicleLabel && (
                <View style={styles.chip}>
                  <Car color={theme.brand} size={13} />
                  <AppText style={styles.chipText}>{vehicleLabel}</AppText>
                </View>
              )}
              {!!endLabel && (
                <View style={styles.chip}>
                  <CalendarDays color={theme.brand} size={13} />
                  <AppText style={styles.chipText}>HSD: {endLabel}</AppText>
                </View>
              )}
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
                      <AppText style={styles.ctaText}>{slide.popupCtaLabel || "Nhận voucher"}</AppText>
                      <ArrowRight color="#FFFFFF" size={16} />
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
    image: { width: "100%", aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    divider: { alignSelf: "center", width: 64, height: 3, borderRadius: 2, backgroundColor: theme.brand },
    desc: { color: theme.muted, fontSize: 13, lineHeight: 21 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipText: { color: theme.brand, fontSize: 12, fontWeight: "700" },
    chipMono: { fontFamily: "monospace" },
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
