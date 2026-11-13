import { BadgeInfo } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import i18n from "@/i18n";
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
  if (policy.calculationMethod === "PerKm") {
    return `${formatCurrency(policy.unitPrice)}${i18n.t("mobile:ownerVehicle.surcharge.unit.km")}`;
  }
  if (policy.calculationMethod === "PerHour") {
    return `${formatCurrency(policy.unitPrice)}${i18n.t("mobile:ownerVehicle.surcharge.unit.hour")}`;
  }
  if (policy.calculationMethod === "PerDay") {
    return `${formatCurrency(policy.unitPrice)}${i18n.t("mobile:ownerVehicle.surcharge.unit.day")}`;
  }
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
  const { t } = useTranslation();

  if (policy.feeType === "ExcessMileage" && policy.includedKm != null) {
    return (
      <AppText style={styles.desc}>
        {t("mobile:ownerVehicle.surcharge.summary.excessPrefix")}
        <AppText style={styles.bold}>{policy.includedKm.toLocaleString("vi-VN")} km</AppText>
        {policy.allowanceScope === "PerBooking"
          ? t("mobile:ownerVehicle.surcharge.summary.excessScopeBooking")
          : t("mobile:ownerVehicle.surcharge.summary.excessScopeDay")}
        {policy.maxAmount != null ? (
          <>
            {t("mobile:ownerVehicle.surcharge.summary.maxPrefix")}
            <AppText style={styles.bold}>{formatCurrency(policy.maxAmount)}</AppText>
          </>
        ) : null}
      </AppText>
    );
  }

  if (policy.feeType === "LateReturn") {
    const graceHours = resolveGraceHours(policy);
    const dayThresholdHours = resolveDayThresholdHours(policy);
    return (
      <AppText style={styles.desc}>
        {t("mobile:ownerVehicle.surcharge.summary.lateBase")}
        {graceHours != null && graceHours > 0 ? (
          <>
            {t("mobile:ownerVehicle.surcharge.summary.lateGracePrefix")}
            <AppText style={styles.bold}>{formatHours(graceHours)}</AppText>
            {t("mobile:ownerVehicle.surcharge.summary.lateGraceSuffix")}
          </>
        ) : null}
        {dayThresholdHours != null && dayThresholdHours > 0 ? (
          <>
            {t("mobile:ownerVehicle.surcharge.summary.lateThresholdPrefix")}
            <AppText style={styles.bold}>{formatHours(dayThresholdHours)}</AppText>
            {t("mobile:ownerVehicle.surcharge.summary.lateThresholdSuffix")}
            <AppText style={styles.bold}>{t("mobile:ownerVehicle.surcharge.summary.lateDayUnit")}</AppText>
          </>
        ) : null}
        {policy.lateDailyRate != null
          ? t("mobile:ownerVehicle.surcharge.summary.lateDailyRate", { price: formatCurrency(policy.lateDailyRate) })
          : null}
        {policy.maxAmount != null ? (
          <>
            {t("mobile:ownerVehicle.surcharge.summary.maxPrefix")}
            <AppText style={styles.bold}>{formatCurrency(policy.maxAmount)}</AppText>
          </>
        ) : null}
      </AppText>
    );
  }

  return (
    <AppText style={styles.desc}>
      {policy.description || t("mobile:ownerVehicle.surcharge.summary.defaultDescription")}
      {policy.maxAmount != null ? (
        <>
          {t("mobile:ownerVehicle.surcharge.summary.maxInlinePrefix")}
          <AppText style={styles.bold}>{formatCurrency(policy.maxAmount)}</AppText>
          {t("mobile:ownerVehicle.surcharge.summary.sentenceEnd")}
        </>
      ) : null}
    </AppText>
  );
}

export default function SurchargePolicySummary({ policies = [], showInactive = false }: Props) {
  const { t } = useTranslation();
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
        <AppText display style={styles.title}>{t("mobile:ownerVehicle.surcharge.title")}</AppText>
      </View>
      <View style={styles.list}>
        {items.map((policy) => (
          <View key={`${policy.id ?? policy.name}`} style={styles.item}>
            <View style={styles.itemHead}>
              <View style={styles.nameWrap}>
                <AppText display style={styles.itemTitle}>{policy.name}</AppText>
                {!policy.isActive ? <AppText style={styles.inactive}>{t("mobile:ownerVehicle.surcharge.summary.inactive")}</AppText> : null}
              </View>
              <AppText style={styles.price}>{calculationLabel(policy)}</AppText>
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
