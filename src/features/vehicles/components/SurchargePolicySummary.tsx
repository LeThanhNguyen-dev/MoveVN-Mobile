import { BadgeInfo } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { VehicleSurchargePolicy } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  policies?: VehicleSurchargePolicy[];
  showInactive?: boolean;
};

function formatCurrency(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function calculationLabel(policy: VehicleSurchargePolicy) {
  if (policy.calculationMethod === "PerKm") return `${formatCurrency(policy.unitPrice)}/km`;
  if (policy.calculationMethod === "PerHour") return `${formatCurrency(policy.unitPrice)}/giờ`;
  if (policy.calculationMethod === "PerDay") return `${formatCurrency(policy.unitPrice)}/ngày`;
  return formatCurrency(policy.unitPrice);
}

/** Ưu tiên giờ, fallback dữ liệu cũ (phút) quy đổi sang giờ. */
function resolveGraceHours(policy: VehicleSurchargePolicy): number | null {
  if (policy.lateGraceHours != null && Number(policy.lateGraceHours) >= 0) return Number(policy.lateGraceHours);
  if (policy.lateGraceMinutes != null && Number(policy.lateGraceMinutes) >= 0) return Number(policy.lateGraceMinutes) / 60;
  return null;
}

function resolveDayThresholdHours(policy: VehicleSurchargePolicy): number | null {
  if (policy.lateDayThresholdHours != null && Number(policy.lateDayThresholdHours) >= 0) return Number(policy.lateDayThresholdHours);
  if (policy.lateDayThresholdMinutes != null && Number(policy.lateDayThresholdMinutes) >= 0) return Number(policy.lateDayThresholdMinutes) / 60;
  return null;
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function SurchargeDescription({ policy, styles }: { policy: VehicleSurchargePolicy; styles: ReturnType<typeof createStyles> }) {
  if (policy.feeType === "ExcessMileage" && policy.includedKm != null) {
    return (
      <Text style={styles.desc}>
        Phụ phí phát sinh nếu di chuyển quá <Text style={styles.bold}>{policy.includedKm.toLocaleString("vi-VN")} km</Text>{" "}
        {policy.allowanceScope === "PerBooking" ? "trong toàn bộ chuyến thuê" : "khi thuê xe 1 ngày"}
        {policy.maxAmount != null ? (
          <>
            . Tối đa <Text style={styles.bold}>{formatCurrency(policy.maxAmount)}</Text>
          </>
        ) : null}
      </Text>
    );
  }

  if (policy.feeType === "LateReturn") {
    const graceHours = resolveGraceHours(policy);
    const dayThresholdHours = resolveDayThresholdHours(policy);
    return (
      <Text style={styles.desc}>
        Phụ phí phát sinh nếu hoàn trả xe trễ giờ
        {graceHours != null && graceHours > 0 ? (
          <>
            , miễn trễ <Text style={styles.bold}>{formatHours(graceHours)} giờ</Text> đầu
          </>
        ) : null}
        {dayThresholdHours != null && dayThresholdHours > 0 ? (
          <>
            . Trường hợp trễ quá <Text style={styles.bold}>{formatHours(dayThresholdHours)} giờ</Text> phụ phí thêm{" "}
            <Text style={styles.bold}>1 ngày</Text>
          </>
        ) : null}
        {policy.lateDailyRate != null ? <> ({formatCurrency(policy.lateDailyRate)}/ngày)</> : null}
        {policy.maxAmount != null ? (
          <>
            . Tối đa <Text style={styles.bold}>{formatCurrency(policy.maxAmount)}</Text>
          </>
        ) : null}
      </Text>
    );
  }

  return (
    <Text style={styles.desc}>
      {policy.description || "Phụ phí có thể phát sinh theo tình trạng xe khi hoàn trả."}
      {policy.maxAmount != null ? (
        <>
          {" "}
          Tối đa <Text style={styles.bold}>{formatCurrency(policy.maxAmount)}</Text>.
        </>
      ) : null}
    </Text>
  );
}

export default function SurchargePolicySummary({ policies = [], showInactive = false }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const items = policies.filter((policy) => showInactive || policy.isActive);

  if (items.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconTile}>
          <BadgeInfo color={theme.brand} size={15} />
        </View>
        <Text style={styles.title}>Phụ phí có thể phát sinh</Text>
      </View>
      <View style={styles.list}>
        {items.map((policy) => (
          <View key={`${policy.id ?? policy.name}`} style={styles.item}>
            <View style={styles.itemHead}>
              <View style={styles.nameWrap}>
                <Text style={styles.itemTitle}>{policy.name}</Text>
                {!policy.isActive ? <Text style={styles.inactive}>Tắt</Text> : null}
              </View>
              <Text style={styles.price}>{calculationLabel(policy)}</Text>
            </View>
            <SurchargeDescription policy={policy} styles={styles} />
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, padding: 14, gap: 10 },
    head: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconTile: { width: 28, height: 28, borderRadius: 10, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    title: { color: theme.text, fontSize: 15, fontWeight: "800" },
    list: { gap: 8 },
    item: { borderRadius: 14, backgroundColor: theme.surfaceAlt, padding: 11, gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    nameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    itemTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    price: { flexShrink: 0, color: theme.text, fontSize: 13, fontWeight: "900", textAlign: "right" },
    inactive: { color: theme.faint, fontSize: 11, fontWeight: "800", backgroundColor: theme.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    desc: { color: theme.muted, fontSize: 12, lineHeight: 18 },
    bold: { color: theme.text, fontWeight: "900" },
  });
