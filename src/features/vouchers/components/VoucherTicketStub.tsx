import { TicketPercent } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { CTA_GRADIENT, formatDiscountShort } from "@/features/vouchers/voucherFormat";

type VoucherTicketStubProps = {
  discountType: string;
  discountValue: number;
  /** Tab Đã dùng: cuống vé xám + mờ (mobile không có filter grayscale). */
  dimmed?: boolean;
};

/** Cuống vé trái w-24: "GIẢM" + giá trị lớn + icon TicketPercent mờ nền. */
function VoucherTicketStub({ discountType, discountValue, dimmed = false }: VoucherTicketStubProps) {
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
      <Text style={styles.stubLabel}>GIẢM</Text>
      <Text style={styles.stubValue} numberOfLines={1}>
        {formatDiscountShort(discountType, discountValue)}
      </Text>
      <TicketPercent color="rgba(255,255,255,0.6)" size={16} />
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
      paddingVertical: 16,
      paddingHorizontal: 6,
      overflow: "hidden",
    },
    stubDimmed: {
      backgroundColor: theme.mode === "dark" ? "#3F3F46" : "#94A3B8",
    },
    stubLabel: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
    },
    stubValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  });
