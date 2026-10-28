import { TicketPercent } from "lucide-react-native";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { formatVoucherStub } from "@/features/vouchers/voucherFormat";

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
  topLabel = "",
  caption = null,
  hideIcon = true,
}: VoucherTicketStubProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.stub, dimmed && styles.stubDimmed]}>
      {topLabel ? <AppText style={styles.stubLabel}>{topLabel}</AppText> : null}
      <AppText style={styles.stubHint}>GIẢM</AppText>
      <AppText
        style={styles.stubValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatVoucherStub(discountType, discountValue)}
      </AppText>
      {hideIcon ? null : <TicketPercent color={theme.brand} size={16} />}
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
      width: 66,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: 12,
      paddingHorizontal: 6,
      overflow: "hidden",
      backgroundColor: theme.brandSoft,
    },
    stubDimmed: {
      backgroundColor: theme.surfaceAlt,
    },
    stubLabel: {
      color: theme.brand,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.6,
    },
    stubHint: {
      color: theme.brand,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    stubValue: {
      color: theme.brand,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.4,
    },
    captionWrap: {
      alignSelf: "stretch",
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.brandBorder,
      paddingTop: 6,
      alignItems: "center",
    },
    captionText: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "700",
      lineHeight: 12,
      textAlign: "center",
    },
  });
