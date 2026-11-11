import {
  ChevronRight,
  ReceiptText,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import SurchargePolicySummary from "@/features/vehicles/components/SurchargePolicySummary";
import type { VehicleSurchargePolicy } from "@/features/vehicles/types";
import { formatVnd } from "@/features/vehicles/ownerDisplay";
import type { DeliveryConfig } from "@/features/booking/utils/bookingPricing";
import DetailSectionHeader from "./DetailSectionHeader";
import { detailFont, useDetailTheme } from "./detailTheme";

type Props = {
  delivery: DeliveryConfig;
  depositPercent: number;
  securityRequiresDeposit: boolean;
  securityDepositAmount: number;
  surchargePolicies: VehicleSurchargePolicy[];
};

export default function VehiclePoliciesCard({
  delivery,
  depositPercent,
  securityRequiresDeposit,
  securityDepositAmount,
  surchargePolicies,
}: Props) {
  const { t } = useTranslation();
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const insets = useSafeAreaInsets();
  const [surchargeOpen, setSurchargeOpen] = useState(false);
  const activePolicies = surchargePolicies.filter((policy) => policy.isActive);

  return (
    <>
      <View style={styles.card}>
        <DetailSectionHeader
          icon={ShieldCheck}
          title={t("mobile:vehicleDetail.policies.title")}
          tone="mint"
        />

        <View style={styles.list}>
          <PolicyRow
            icon={Truck}
            title={t("mobile:vehicleDetail.policies.deliveryTitle")}
            value={
              delivery.freeKm > 0
                ? t("mobile:vehicleDetail.policies.deliveryFree", { km: delivery.freeKm })
                : t("mobile:vehicleDetail.policies.deliveryByDistance")
            }
            sub={
              delivery.perKm > 0
                ? t("mobile:vehicleDetail.policies.deliveryPerKm", {
                    price: formatVnd(delivery.perKm),
                    max: delivery.maxKm,
                  })
                : t("mobile:vehicleDetail.policies.deliveryWithin", { max: delivery.maxKm })
            }
            tone={delivery.freeKm > 0 ? "mint" : "default"}
          />
          <PolicyRow
            icon={ReceiptText}
            title={t("mobile:vehicleDetail.policies.depositTitle")}
            value={
              depositPercent > 0
                ? t("mobile:vehicleDetail.policies.depositPercent", { percent: depositPercent })
                : t("vehicleDetail:pricing.notRequired")
            }
            sub={
              depositPercent > 0
                ? t("mobile:vehicleDetail.policies.depositSub")
                : t("mobile:vehicleDetail.policies.depositNoPrepay")
            }
            tone={depositPercent > 0 ? "default" : "mint"}
          />
          <PolicyRow
            icon={ShieldCheck}
            title={t("mobile:vehicleDetail.policies.collateralTitle")}
            value={
              securityRequiresDeposit
                ? securityDepositAmount > 0
                  ? formatVnd(securityDepositAmount)
                  : t("mobile:vehicleDetail.policies.collateralAgreed")
                : t("vehicleDetail:pricing.notRequired")
            }
            sub={
              securityRequiresDeposit
                ? t("mobile:vehicleDetail.policies.collateralSub")
                : t("mobile:vehicleDetail.policies.collateralNone")
            }
            tone={securityRequiresDeposit ? "default" : "mint"}
          />
          <PolicyRow
            icon={ReceiptText}
            title={t("mobile:vehicleDetail.policies.surchargeTitle")}
            value={
              activePolicies.length > 0
                ? t("mobile:vehicleDetail.policies.surchargeCount", { count: activePolicies.length })
                : t("mobile:vehicleDetail.policies.surchargeNone")
            }
            sub={
              activePolicies.length > 0
                ? t("mobile:vehicleDetail.policies.surchargeSub")
                : t("mobile:vehicleDetail.policies.surchargeNoExtra")
            }
            tone={activePolicies.length > 0 ? "default" : "mint"}
            onPress={activePolicies.length > 0 ? () => setSurchargeOpen(true) : undefined}
            accessibilityLabel={t("mobile:vehicleDetail.policies.surchargeAria")}
          />
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setSurchargeOpen(false)}
        transparent
        visible={surchargeOpen}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityLabel={t("mobile:vehicleDetail.policies.closeSurchargeAria")}
            accessibilityRole="button"
            onPress={() => setSurchargeOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetTitleWrap}>
                <AppText style={styles.sheetTitle}>
                  {t("mobile:vehicleDetail.policies.sheetTitle")}
                </AppText>
                <AppText style={styles.sheetSub}>
                  {t("mobile:vehicleDetail.policies.sheetSubtitle")}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel={t("common:closeAction")}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSurchargeOpen(false)}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <X color={p.ink} size={18} strokeWidth={2.2} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <SurchargePolicySummary policies={activePolicies} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function PolicyRow({
  icon: Icon,
  title,
  value,
  sub,
  tone,
  onPress,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  sub: string;
  tone: "default" | "mint";
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const valueColor = tone === "mint" ? p.mint : p.ink;

  const content = (
    <>
      <View style={styles.rowIcon}>
        <Icon color={p.brand} size={14} strokeWidth={2.1} />
      </View>
      <View style={styles.rowBody}>
        <AppText style={styles.rowTitle}>{title}</AppText>
        <AppText style={[styles.rowSub, tone === "mint" && { color: valueColor }]}>{sub}</AppText>
      </View>
      <View style={styles.rowValueWrap}>
        <AppText style={[styles.rowValue, { color: valueColor }]} numberOfLines={1}>
          {value}
        </AppText>
        {onPress ? <ChevronRight color={p.faint} size={14} strokeWidth={2.1} /> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.policyRow, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.policyRow}>{content}</View>;
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    card: {
      marginTop: 22,
      marginHorizontal: 14,
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surface,
    },
    list: { marginTop: 6 },
    policyRow: {
      minHeight: 58,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: p.line,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: p.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { color: p.ink, fontFamily: detailFont.semibold, fontSize: 12.5, lineHeight: 17 },
    rowSub: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10, lineHeight: 14, marginTop: 1 },
    rowValueWrap: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1, maxWidth: 138 },
    rowValue: { fontFamily: detailFont.bold, fontSize: 11, textAlign: "right" },
    pressed: { opacity: 0.65 },
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12, 8, 24, 0.5)" },
    sheet: {
      maxHeight: "82%",
      backgroundColor: p.canvas,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingTop: 8,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: p.line,
      marginBottom: 8,
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 18,
      paddingBottom: 8,
    },
    sheetTitleWrap: { flex: 1, minWidth: 0 },
    sheetTitle: { color: p.ink, fontFamily: detailFont.display, fontSize: 17 },
    sheetSub: { color: p.muted, fontFamily: detailFont.regular, fontSize: 10.5, marginTop: 2 },
    close: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    sheetContent: { paddingHorizontal: 16, paddingBottom: 8 },
  });
