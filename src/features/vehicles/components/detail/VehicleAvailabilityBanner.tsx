import { CalendarClock, CalendarDays, CircleAlert, CircleCheck } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { detailFont, useDetailTheme } from "./detailTheme";
import { formatShortRange } from "./rentalPricing";

type Props = {
  days: number;
  overlapping: boolean;
  availabilityLoading: boolean;
  availabilityReady: boolean;
  availabilityError: boolean;
  startDate: string;
  endDate: string;
  onChangeDates: () => void;
  onRetry: () => void;
};

export default function VehicleAvailabilityBanner({
  days,
  overlapping,
  availabilityLoading,
  availabilityReady,
  availabilityError,
  startDate,
  endDate,
  onChangeDates,
  onRetry,
}: Props) {
  const { p } = useDetailTheme();

  const hasDates = days > 0;
  const state: "idle" | "loading" | "busy" | "error" | "ready" = !hasDates
    ? "idle"
    : availabilityLoading
      ? "loading"
      : overlapping
        ? "busy"
        : availabilityError || !availabilityReady
          ? "error"
          : "ready";

  const tone =
    state === "ready"
      ? { fg: p.mint, bg: p.mintSoft, border: p.mintBorder }
      : state === "busy"
        ? { fg: p.danger, bg: p.dangerSoft, border: p.dangerBorder }
        : state === "error"
          ? { fg: p.warning, bg: p.warningSoft, border: p.warningBorder }
          : { fg: p.brand, bg: p.brandSoft, border: p.brandBorder };

  const title =
    state === "idle"
      ? "Chọn ngày để kiểm tra lịch"
      : state === "loading"
        ? "Đang kiểm tra lịch xe…"
        : state === "busy"
          ? "Xe đã bận trong khoảng này"
          : state === "error"
            ? "Chưa kiểm tra được lịch"
            : `Còn trống · ${formatShortRange(startDate, endDate)}`;

  const subtitle =
    state === "idle"
      ? "Xe có thể còn trống cho khoảng ngày của bạn"
      : state === "loading"
        ? "Vui lòng chờ trong giây lát"
        : state === "busy"
          ? "Chọn khoảng ngày khác để tiếp tục"
          : state === "error"
            ? "Thử lại để xem xe có trống không"
            : "Không trùng lịch bận hiện tại của xe";

  const actionLabel =
    state === "idle" ? "Chọn" : state === "ready" ? "Đổi" : state === "busy" ? "Đổi ngày" : state === "error" ? "Thử lại" : "";
  const onAction = state === "error" ? onRetry : onChangeDates;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <View style={[styles.statusIcon, { backgroundColor: p.surface }]}>
        {state === "loading" ? (
          <ActivityIndicator color={tone.fg} size="small" />
        ) : state === "ready" ? (
          <CircleCheck color={tone.fg} size={19} strokeWidth={2.1} />
        ) : state === "busy" || state === "error" ? (
          <CircleAlert color={tone.fg} size={19} strokeWidth={2.1} />
        ) : (
          <CalendarDays color={tone.fg} size={18} strokeWidth={2.1} />
        )}
      </View>
      <View style={styles.body}>
        <AppText style={[styles.title, { color: p.ink }]}>{title}</AppText>
        <AppText style={[styles.subtitle, { color: p.muted }]}>{subtitle}</AppText>
      </View>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: p.surface },
            pressed && styles.pressed,
          ]}
        >
          <AppText style={[styles.actionText, { color: tone.fg }]}>{actionLabel}</AppText>
        </Pressable>
      ) : state === "loading" ? (
        <CalendarClock color={tone.fg} size={16} strokeWidth={2} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: detailFont.bold, fontSize: 12.5, lineHeight: 17 },
  subtitle: { fontFamily: detailFont.regular, fontSize: 10.5, lineHeight: 15, marginTop: 1 },
  action: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionText: { fontFamily: detailFont.bold, fontSize: 10.5 },
  pressed: { opacity: 0.65 },
});
