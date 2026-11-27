import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import type { ViewInstance } from "react-native";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import { BOOKING_TOUR_STEPS, useBookingTour, type BookingTourStep } from "@/features/onboarding/bookingTour";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Rect = { x: number; y: number; width: number; height: number };

const SPOTLIGHT_PAD = 8;
const MEASURE_RETRY_MS = 200;
const MEASURE_MAX_ATTEMPTS = 8;

/** Lớp spotlight cho tour đặt xe: 4 khối tối phủ quanh target (chừa "lỗ" cho
 *  khách bấm đúng phần tử đang được chỉ) + thẻ hướng dẫn. Chỉ render khi store
 *  đang ở đúng bước của màn hình này. */
export default function TourOverlay({
  step,
  anchorRef,
  onNext,
}: {
  step: BookingTourStep;
  anchorRef: RefObject<ViewInstance | null>;
  /** Ghi đè nút "Tiếp tục" khi bước cần tự chuyển màn (vd. mở tab Chuyến đi). */
  onNext?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const active = useBookingTour((state) => state.step);
  const next = useBookingTour((state) => state.next);
  const skip = useBookingTour((state) => state.skip);
  const [rect, setRect] = useState<Rect | null>(null);
  // Gốc toạ độ của overlay trong cửa sổ: một số màn (Trang chủ) kéo root lên
  // dưới status bar bằng margin âm, nên rect của target phải trừ đi gốc này.
  const overlayRef = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  function measureOrigin() {
    overlayRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }

  useEffect(() => {
    if (active !== step) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function schedule() {
      attempts += 1;
      if (attempts > MEASURE_MAX_ATTEMPTS || cancelled) return;
      timer = setTimeout(measure, MEASURE_RETRY_MS);
    }

    function measure() {
      if (cancelled) return;
      const node = anchorRef.current;
      if (!node) {
        schedule();
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        if (cancelled) return;
        if (width > 0 && height > 0) setRect({ x, y, width, height });
        // Đo lại sau khi màn tự cuộn tới phần tử được chỉ (bước địa chỉ/voucher).
        schedule();
      });
    }

    measure();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, step, anchorRef]);

  if (active !== step) return null;

  const stepIndex = BOOKING_TOUR_STEPS.indexOf(step);
  const isLast = stepIndex === BOOKING_TOUR_STEPS.length - 1;
  const local =
    rect && origin
      ? { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
      : null;
  const spotlight =
    local && rect && rect.y >= 12 && rect.y + rect.height <= winH - 12
      ? {
          x: Math.max(local.x - SPOTLIGHT_PAD, 0),
          y: Math.max(local.y - SPOTLIGHT_PAD, 0),
          width: Math.min(local.width + SPOTLIGHT_PAD * 2, winW),
          height: local.height + SPOTLIGHT_PAD * 2,
        }
      : null;
  const tooltipBelow = !spotlight || spotlight.y + spotlight.height < winH / 2;

  return (
    <View
      ref={overlayRef}
      onLayout={measureOrigin}
      style={styles.overlay}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      {spotlight ? (
        <>
          <View style={[styles.dim, { left: 0, right: 0, top: 0, height: spotlight.y }]} />
          <View style={[styles.dim, { left: 0, right: 0, top: spotlight.y + spotlight.height, bottom: 0 }]} />
          <View style={[styles.dim, { left: 0, top: spotlight.y, width: spotlight.x, height: spotlight.height }]} />
          <View
            style={[
              styles.dim,
              { left: spotlight.x + spotlight.width, right: 0, top: spotlight.y, height: spotlight.height },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.spotlight,
              { left: spotlight.x, top: spotlight.y, width: spotlight.width, height: spotlight.height },
            ]}
          />
        </>
      ) : (
        // Target đang ngoài màn hình: chỉ phủ mờ, không chặn thao tác để khách
        // vẫn cuộn tới phần tử được hướng dẫn.
        <View style={styles.dim} pointerEvents="none" />
      )}

      <View
        style={[styles.tooltip, tooltipBelow ? { bottom: insets.bottom + 24 } : { top: insets.top + 16 }]}
        accessibilityRole="alert"
      >
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>
            {t("mobile:tour.badge", { current: stepIndex + 1, total: BOOKING_TOUR_STEPS.length })}
          </AppText>
        </View>
        <AppText display style={styles.title}>
          {t(`mobile:tour.steps.${step}.title`)}
        </AppText>
        <AppText style={styles.body}>{t(`mobile:tour.steps.${step}.body`)}</AppText>
        <View style={styles.actions}>
          <Pressable onPress={skip} style={styles.skipButton} accessibilityRole="button">
            <AppText style={styles.skipText}>{t("mobile:tour.skip")}</AppText>
          </Pressable>
          <Pressable onPress={onNext ?? next} style={styles.nextButton} accessibilityRole="button">
            <AppText style={styles.nextText}>{isLast ? t("mobile:tour.done") : t("mobile:tour.next")}</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    dim: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "rgba(9, 6, 20, 0.68)",
    },
    spotlight: {
      position: "absolute",
      borderRadius: 18,
      borderWidth: 2,
      borderColor: theme.brand,
    },
    tooltip: {
      position: "absolute",
      left: 20,
      right: 20,
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 18,
      gap: 8,
      shadowColor: "#000000",
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: theme.brandSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: {
      color: theme.brand,
      fontSize: 11,
      fontWeight: "800",
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
    },
    body: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 4,
    },
    skipButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
    },
    skipText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    nextButton: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: theme.brand,
    },
    nextText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
