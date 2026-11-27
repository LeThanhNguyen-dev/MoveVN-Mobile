import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CreditCard, FileBadge, IdCard, RefreshCw } from "lucide-react-native";
import AppText from "@/components/AppText";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import OwnerCccdVerificationScreen from "@/features/owner/screens/OwnerCccdVerificationScreen";
import DriverLicenseScreen from "@/features/driverLicenses/screens/DriverLicenseScreen";
import { createApplication, getMyApplication, submitApplication } from "@/features/owner/services/ownerService";
import type { OwnerApplicationDto } from "@/features/owner/types";
import { refreshAuthSession } from "@/services/apiClient";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type VerificationCardProps = {
  title: string;
  complete: boolean;
  action: string;
  onPress: () => void;
  icon: typeof IdCard;
  completeLabel: string;
  incompleteLabel: string;
  theme: Theme;
};

function VerificationCard({
  title, complete, action, onPress, icon: Icon, completeLabel, incompleteLabel, theme,
}: VerificationCardProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, complete && styles.iconBoxComplete]}>
          <Icon color={complete ? theme.success : theme.brand} size={21} strokeWidth={2.2} />
        </View>
        <View style={styles.cardHeading}>
          <AppText display style={styles.cardTitle}>{title}</AppText>
          <View style={[styles.status, complete ? styles.statusComplete : styles.statusIncomplete]}>
            {complete
              ? <CheckCircle2 color={theme.success} size={15} strokeWidth={2.5} />
              : <Circle color={theme.muted} size={14} strokeWidth={2.1} />}
            <AppText style={[styles.statusText, complete ? styles.statusTextComplete : styles.statusTextIncomplete]}>
              {complete ? completeLabel : incompleteLabel}
            </AppText>
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.cardAction}>
        <AppText style={styles.cardActionText}>{action}</AppText>
        <ArrowRight color={theme.brand} size={17} strokeWidth={2.3} />
      </Pressable>
    </View>
  );
}

export default function OwnerVerificationScreen({
  onBack,
  onOpenWalletBank,
  onOwnerUpgraded,
}: {
  onBack: () => void;
  onOpenWalletBank?: () => void;
  onOwnerUpgraded?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [application, setApplication] = useState<OwnerApplicationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cccdOpen, setCccdOpen] = useState(false);
  const [driverLicenseOpen, setDriverLicenseOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let app: OwnerApplicationDto;
      try {
        app = await getMyApplication();
      } catch {
        await createApplication();
        app = await getMyApplication();
      }
      setApplication(app);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("mobile:ownerHome.verification.loadStatusError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  if (cccdOpen) {
    return (
      <OwnerCccdVerificationScreen
        onBack={() => { setCccdOpen(false); void loadStatus(); }}
        onVerified={(updated) => {
          if (updated) setApplication(updated);
          setCccdOpen(false);
          void loadStatus();
        }}
      />
    );
  }

  if (driverLicenseOpen) {
    return <DriverLicenseScreen onBack={() => { setDriverLicenseOpen(false); void loadStatus(); }} />;
  }

  const cccdComplete = application?.nationalIdVerified ?? false;
  const driverLicenseComplete = application?.driverLicenseVerified ?? false;
  const bankComplete = application?.bankInfoCompleted ?? false;
  const allRequirementsComplete = cccdComplete && driverLicenseComplete && bankComplete;
  const emailVerified = application?.emailVerified ?? false;

  async function handleUpgrade() {
    if (!allRequirementsComplete || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitApplication();
      if (!result.isOwner) throw new Error(t("mobile:ownerHome.verification.upgradeError"));
      const refreshed = await refreshAuthSession();
      if (!refreshed.user.roles?.includes("Owner")) {
        throw new Error(t("mobile:ownerHome.verification.refreshOwnerAccessError"));
      }
      await useAuthStore.getState().setActiveRole("Owner");
      await onOwnerUpgraded?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("mobile:ownerHome.verification.upgradeError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:wallet.a11y.back")} onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <AppText display style={styles.topBarTitle}>{t("mobile:ownerHome.verification.overviewTitle")}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mobile:driverLicense.reloadAria")}
          disabled={loading}
          onPress={() => { void loadStatus(); }}
          style={styles.backButton}
        >
          {loading
            ? <ActivityIndicator color={theme.brand} size="small" />
            : <RefreshCw color={theme.brand} size={19} strokeWidth={2.3} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading && !application ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.brand} size="large" />
            <AppText style={styles.muted}>{t("mobile:ownerHome.verification.loading")}</AppText>
          </View>
        ) : (
          <>
            <VerificationCard
              title={t("mobile:ownerHome.verification.cccdCardTitle")}
              complete={cccdComplete}
              action={t(cccdComplete ? "mobile:ownerHome.verification.viewCccd" : "mobile:ownerHome.verification.verifyCccd")}
              onPress={() => setCccdOpen(true)}
              icon={IdCard}
              completeLabel={t("mobile:ownerHome.verification.completed")}
              incompleteLabel={t("mobile:ownerHome.verification.notCompleted")}
              theme={theme}
            />
            <VerificationCard
              title={t("mobile:ownerHome.verification.driverLicenseCardTitle")}
              complete={driverLicenseComplete}
              action={t(driverLicenseComplete ? "mobile:ownerHome.verification.viewDriverLicense" : "mobile:ownerHome.verification.verifyDriverLicense")}
              onPress={() => setDriverLicenseOpen(true)}
              icon={FileBadge}
              completeLabel={t("mobile:ownerHome.verification.completed")}
              incompleteLabel={t("mobile:ownerHome.verification.notCompleted")}
              theme={theme}
            />
            <VerificationCard
              title={t("mobile:ownerHome.verification.bankCardTitle")}
              complete={bankComplete}
              action={t(bankComplete ? "mobile:ownerHome.verification.viewBank" : "mobile:ownerHome.verification.setupBank")}
              onPress={() => onOpenWalletBank?.()}
              icon={CreditCard}
              completeLabel={t("mobile:ownerHome.verification.completed")}
              incompleteLabel={t("mobile:ownerHome.verification.notCompleted")}
              theme={theme}
            />

            {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
            {allRequirementsComplete ? (
              <View style={styles.upgradeArea}>
                {!emailVerified ? <AppText style={styles.emailHint}>{t("mobile:ownerHome.verification.emailRequired")}</AppText> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting || loading || !emailVerified}
                  onPress={() => { void handleUpgrade(); }}
                  style={[styles.upgradeButton, (submitting || loading || !emailVerified) && styles.disabled]}
                >
                  {submitting ? <ActivityIndicator color={theme.onBrand} /> : null}
                  <AppText style={styles.upgradeText}>
                    {submitting ? t("mobile:ownerHome.verification.upgrading") : t("mobile:ownerHome.verification.upgradeOwner")}
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  content: { flex: 1, backgroundColor: theme.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 4, minHeight: 48 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  topBarTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 13, backgroundColor: theme.surface },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.brandSoft },
  iconBoxComplete: { backgroundColor: theme.successSoft },
  cardHeading: { flex: 1, gap: 6 },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  status: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusComplete: { backgroundColor: theme.successSoft },
  statusIncomplete: { backgroundColor: theme.surfaceAlt },
  statusText: { fontSize: 12, fontWeight: "800" },
  statusTextComplete: { color: theme.success },
  statusTextIncomplete: { color: theme.muted },
  cardAction: { minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardActionText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  loadingBox: { alignItems: "center", gap: 10, paddingVertical: 44 },
  muted: { color: theme.muted, fontSize: 13, fontWeight: "600" },
  error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  upgradeArea: { gap: 10, marginTop: 2 },
  emailHint: { color: theme.muted, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  upgradeButton: { minHeight: 52, borderRadius: 14, backgroundColor: theme.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  upgradeText: { color: theme.onBrand, fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
