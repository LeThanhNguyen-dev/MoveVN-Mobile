import { useMemo, type ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  detailFont as font,
  useDetailTheme,
  type DetailPalette,
} from "@/features/vehicles/components/detail/detailTheme";

/** Header trong suốt, đồng bộ với màn Xác nhận đặt xe / Chi tiết xe. */
export function DetailHeader({
  kicker,
  title,
  onBack,
  right,
  style,
}: {
  kicker?: string;
  title: string;
  onBack: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={[styles.header, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={6}
        onPress={onBack}
        style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
      >
        <ArrowLeft color={p.ink} size={20} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.headerBody}>
        {kicker ? (
          <Text style={styles.headerKicker} numberOfLines={1}>
            {kicker}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Bo góc + bóng dùng chung cho các card chi tiết chuyến đi / đơn thuê. */
export function DetailCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Card tóm tắt đè lên ảnh hero (kiểu VehicleSummaryCard).
 * `footer` thường là dải thông tin nhanh (DetailStat).
 */
export function DetailSummaryCard({
  children,
  footer,
  style,
}: {
  children: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  return (
    <View style={[styles.summaryCard, style]}>
      <View style={styles.summaryBody}>{children}</View>
      {footer ? <View style={styles.summaryFooter}>{footer}</View> : null}
    </View>
  );
}

export function DetailSectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "brand",
  right,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: "brand" | "mint" | "amber";
  right?: ReactNode;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const tint = tone === "mint" ? p.mint : tone === "amber" ? p.rating : p.brand;
  const tintSoft = tone === "mint" ? p.mintSoft : tone === "amber" ? p.ratingSoft : p.brandSoft;
  return (
    <View style={styles.sectionHeader}>
      {Icon ? (
        <View style={[styles.iconTile, { backgroundColor: tintSoft }]}>
          <Icon color={tint} size={17} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function DetailDivider() {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  return <View style={styles.divider} />;
}

export function DetailRow({
  label,
  value,
  tone,
  strong,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "muted" | "success" | "danger";
  strong?: boolean;
  icon?: LucideIcon;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const color = tone === "success" ? p.mint : tone === "danger" ? p.danger : p.ink;
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        {Icon ? <Icon color={p.faint} size={13} strokeWidth={2.1} /> : null}
        <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>{label}</Text>
      </View>
      <Text
        numberOfLines={2}
        style={[
          styles.rowValue,
          { color },
          tone === "muted" && { color: p.faint },
          strong && styles.rowValueStrong,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function DetailPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "brand" | "mint" | "warn" | "danger" | "neutral";
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const palette =
    tone === "brand"
      ? { fg: p.brand, bg: p.brandSoft, border: p.brandBorder }
      : tone === "mint"
        ? { fg: p.mint, bg: p.mintSoft, border: p.mintBorder }
        : tone === "warn"
          ? { fg: p.warning, bg: p.warningSoft, border: p.warningBorder }
          : tone === "danger"
            ? { fg: p.danger, bg: p.dangerSoft, border: p.dangerBorder }
            : { fg: p.muted, bg: p.surfaceAlt, border: p.line };
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.pillText, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function DetailButton({
  label,
  onPress,
  disabled,
  busy,
  variant = "primary",
  icon: Icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const foreground =
    variant === "primary"
      ? p.onBrand
      : variant === "danger"
        ? p.danger
        : variant === "secondary"
          ? p.brand
          : p.ink;
  const background =
    variant === "primary"
      ? p.brand
      : variant === "danger"
        ? p.dangerSoft
        : variant === "secondary"
          ? p.brandSoft
          : p.surface;
  const borderColor =
    variant === "primary"
      ? p.brand
      : variant === "danger"
        ? p.dangerBorder
        : variant === "secondary"
          ? p.brandBorder
          : p.line;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) || Boolean(busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor },
        pressed && !disabled && !busy && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : Icon ? (
        <Icon color={foreground} size={16} strokeWidth={2.2} />
      ) : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function DetailNotice({
  title,
  children,
  tone = "warn",
  icon: Icon,
}: {
  title: string;
  children: ReactNode;
  tone?: "warn" | "brand" | "mint" | "danger";
  icon?: LucideIcon;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const palette =
    tone === "brand"
      ? { fg: p.brand, bg: p.brandSoft, border: p.brandBorder }
      : tone === "mint"
        ? { fg: p.mint, bg: p.mintSoft, border: p.mintBorder }
        : tone === "danger"
          ? { fg: p.danger, bg: p.dangerSoft, border: p.dangerBorder }
          : { fg: p.warning, bg: p.warningSoft, border: p.warningBorder };
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {Icon ? (
        <View style={[styles.noticeIcon, { backgroundColor: p.surface }]}>
          <Icon color={palette.fg} size={16} strokeWidth={2.1} />
        </View>
      ) : null}
      <View style={styles.noticeBody}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeText}>{children}</Text>
      </View>
    </View>
  );
}

export function DetailStat({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "neutral" | "brand" | "mint" | "danger";
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const tint =
    tone === "brand" ? p.brand : tone === "mint" ? p.mint : tone === "danger" ? p.danger : p.muted;
  const tintSoft =
    tone === "brand"
      ? p.brandSoft
      : tone === "mint"
        ? p.mintSoft
        : tone === "danger"
          ? p.dangerSoft
          : p.surfaceAlt;
  return (
    <View style={styles.stat}>
      {Icon ? (
        <View style={[styles.statIcon, { backgroundColor: tintSoft }]}>
          <Icon color={tint} size={14} strokeWidth={2} />
        </View>
      ) : null}
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function useDetailCardStyles() {
  const { p } = useDetailTheme();
  return useMemo(() => createStyles(p), [p]);
}

export const createStyles = (p: DetailPalette) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    headerBack: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    headerBody: { flex: 1, minWidth: 0 },
    headerKicker: {
      color: p.brand,
      fontFamily: font.extraBold,
      fontSize: 8.5,
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    headerTitle: {
      color: p.ink,
      fontFamily: font.display,
      fontSize: 19,
      letterSpacing: -0.3,
    },
    card: {
      backgroundColor: p.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      padding: 16,
      gap: 13,
      shadowColor: p.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    summaryCard: {
      marginTop: -30,
      marginHorizontal: 14,
      zIndex: 2,
      backgroundColor: p.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: p.line,
      shadowColor: p.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
    },
    summaryBody: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 18 },
    summaryFooter: {
      flexDirection: "row",
      marginTop: 14,
      marginHorizontal: -18,
      paddingHorizontal: 8,
      paddingTop: 12,
      paddingBottom: 13,
      borderTopWidth: 1,
      borderTopColor: p.line,
      backgroundColor: p.surfaceSoft,
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
    },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconTile: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionBody: { flex: 1, minWidth: 0 },
    sectionTitle: {
      color: p.ink,
      fontFamily: font.display,
      fontSize: 15.5,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      color: p.muted,
      fontFamily: font.regular,
      fontSize: 10.5,
      lineHeight: 15,
      marginTop: 1,
    },
    divider: { height: 1, backgroundColor: p.line },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    rowLabelWrap: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    rowLabel: { color: p.muted, fontFamily: font.regular, fontSize: 11.5, flexShrink: 1 },
    rowLabelStrong: { color: p.ink, fontFamily: font.semibold, fontSize: 12.5 },
    rowValue: {
      color: p.ink,
      fontFamily: font.semibold,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
      maxWidth: "58%",
    },
    rowValueStrong: { fontFamily: font.display, fontSize: 18, letterSpacing: -0.4 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      maxWidth: 190,
    },
    pillText: { fontFamily: font.bold, fontSize: 9.5, flexShrink: 1 },
    button: {
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    buttonText: { fontFamily: font.bold, fontSize: 13 },
    pressed: { opacity: 0.78 },
    disabled: { opacity: 0.45 },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
    },
    noticeIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    noticeBody: { flex: 1, minWidth: 0, gap: 3 },
    noticeTitle: { color: p.ink, fontFamily: font.semibold, fontSize: 11.5 },
    noticeText: { color: p.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 },
    stat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 3 },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      color: p.faint,
      fontFamily: font.semibold,
      fontSize: 8.5,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    statValue: {
      color: p.ink,
      fontFamily: font.bold,
      fontSize: 10.5,
      lineHeight: 14,
      textAlign: "center",
      maxWidth: "100%",
    },
  });
