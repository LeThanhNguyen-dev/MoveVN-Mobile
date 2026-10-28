import { TicketPercent } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { CTA_GRADIENT, formatVoucherStub } from "@/features/vouchers/voucherFormat";

type VoucherTicketStubProps = {
  discountType: string;
  discountValue: number;
  /** Tab Đã dùng: cuống vé xám + mờ (mobile không có filter grayscale). */
  dimmed?: boolean;
  /** Nhãn nhỏ phía trên (web: "VOUCHER"). */
  topLabel?: string;
  /** Nhãn phụ cuối cuống vé (web: "Tối đa 50.000đ" / "Đơn từ ..."). */
  caption?: string | null;
  /** Ẩn icon TicketPercent mờ nền. */
  hideIcon?: boolean;
};

/** Cuống vé trái: nhãn + giá trị giảm lớn + icon mờ + caption (mirror web VoucherTicketCard). */
function VoucherTicketStub({
  discountType,
  discountValue,
  dimmed = false,
  topLabel = "VOUCHER",
  caption = null,
  hideIcon = false,
}: VoucherTicketStubProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.stub, dimmed && styles.stubDimmed]}>
      {!dimmed ? (
        <LinearGradient
          colors={[CTA_GRADIENT[0], CTA_GRADIENT[1], CTA_GRADIENT[2]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <AppText style={styles.stubLabel}>{topLabel}</AppText>
      <AppText style={styles.stubHint}>GIẢM</AppText>
      <AppText style={styles.stubValue} numberOfLines={1}>
        {formatVoucherStub(discountType, discountValue)}
      </AppText>
      {hideIcon ? null : <TicketPercent color="rgba(255,255,255,0.55)" size={16} />}
      {caption ? (
        <View style={styles.captionWrap}>
          <AppText style={styles.captionText} numberOfLines={2}>
            {caption}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export default memo(VoucherTicketStub);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    stub: {
      width: 96,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: 14,
      paddingHorizontal: 6,
      overflow: "hidden",
    },
    stubDimmed: {
      backgroundColor: theme.mode === "dark" ? "#3F3F46" : "#94A3B8",
    },
    stubLabel: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.6,
    },
    stubHint: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    stubValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
    captionWrap: {
      alignSelf: "stretch",
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.45)",
      paddingTop: 6,
      alignItems: "center",
    },
    captionText: {
      color: "rgba(255,255,255,0.88)",
      fontSize: 9,
      fontWeight: "700",
      lineHeight: 12,
      textAlign: "center",
    },
  });
