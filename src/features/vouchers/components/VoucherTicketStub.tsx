import { LinearGradient } from "expo-linear-gradient";
import { TicketPercent } from "lucide-react-native";
import { memo } from "react";
import { StyleSheet } from "react-native";
import AppText from "@/components/AppText";
import { CTA_GRADIENT, formatVoucherStub } from "@/features/vouchers/voucherFormat";

const MUTED_GRADIENT: readonly [string, string] = ["#94A3B8", "#64748B"];

type VoucherTicketStubProps = {
  discountType: string;
  discountValue: number;
  dimmed?: boolean;
};

/** Cuống vé gradient bên trái thẻ voucher (kiểu ticket Shopee): icon + mức giảm + MoveVN. */
function VoucherTicketStub({ discountType, discountValue, dimmed = false }: VoucherTicketStubProps) {
  return (
    <LinearGradient
      colors={dimmed ? MUTED_GRADIENT : CTA_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.stub}
    >
      <TicketPercent color="rgba(255,255,255,0.92)" size={13} />
      <AppText style={styles.value} numberOfLines={1}>
        {formatVoucherStub(discountType, discountValue)}
      </AppText>
      <AppText style={styles.label}>MoveVN</AppText>
    </LinearGradient>
  );
}

export default memo(VoucherTicketStub);

const styles = StyleSheet.create({
  stub: {
    width: 76,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
});
