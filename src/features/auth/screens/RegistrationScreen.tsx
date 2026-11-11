import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { AuthButton, AuthField, AuthNotice } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { register } from "../services/authService";
import { registerOwnerOnboarding } from "@/features/owner/services/ownerService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateAuth, type AuthFields } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "Register" | "OwnerRegister">;

export default function RegistrationScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isOwner = route.name === "OwnerRegister";
  const [fields, setFields] = useState<AuthFields>({ email: "", password: "", confirmPassword: "", fullName: "", phone: "", otp: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof AuthFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    const errors = validateAuth(isOwner ? "owner" : "register", fields, accepted);
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? t("mobile:auth.invalidData")); return; }
    setBusy(true); setError("");
    const payload = { email: fields.email.trim(), fullName: fields.fullName.trim(), phone: fields.phone.trim(), password: fields.password, confirmPassword: fields.confirmPassword };
    try {
      if (isOwner) await registerOwnerOnboarding(payload); else await register({ ...payload, role: "Customer" });
      navigation.replace("VerifyEmail", { email: payload.email, purpose: "Register" });
    } catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.registerFailed")); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}>
    <AuthScreenHeader description={isOwner ? t("mobile:auth.copy.ownerDescription") : t("mobile:auth.copy.registerDescription")} onBack={() => navigation.goBack()} title={isOwner ? t("auth:ownerRegister.title") : t("mobile:auth.copy.registerTitle")} />
    {error ? <AuthNotice error message={error} /> : null}
    <AuthField editable={!busy} icon={<UserRound color={theme.muted} size={19} />} label={t("auth:fields.fullName")} maxLength={200} onChangeText={(value) => update("fullName", value)} placeholder={t("auth:placeholders.fullName")} value={fields.fullName} />
    <AuthField editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label={t("auth:fields.email")} onChangeText={(value) => update("email", value)} placeholder={t("auth:placeholders.email")} value={fields.email} />
    <AuthField editable={!busy} icon={<Phone color={theme.muted} size={19} />} keyboardType="phone-pad" label={t("auth:fields.phone")} maxLength={10} onChangeText={(value) => update("phone", value)} placeholder={t("auth:placeholders.phone")} value={fields.phone} />
    <AuthField editable={!busy} icon={<LockKeyhole color={theme.muted} size={19} />} label={t("auth:fields.password")} onChangeText={(value) => update("password", value)} password value={fields.password} />
    <AuthField editable={!busy} icon={<ShieldCheck color={theme.muted} size={19} />} label={t("auth:fields.confirmPassword")} onChangeText={(value) => update("confirmPassword", value)} password value={fields.confirmPassword} />
    {!isOwner ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)} style={styles.terms}><View style={[styles.box, accepted && styles.boxSelected]}><AppText style={styles.check}>{accepted ? "✓" : ""}</AppText></View><AppText style={styles.termsText}>{t("mobile:auth.terms.agree")}</AppText></Pressable> : null}
    {!isOwner ? <View style={styles.policyLinks}><Pressable onPress={() => navigation.navigate("Policies", { slug: "privacy-policy" })}><AppText style={styles.link}>{t("auth:register.privacyPolicy")}</AppText></Pressable><AppText style={styles.policyDot}>•</AppText><Pressable onPress={() => navigation.navigate("Policies", { slug: "terms-of-service" })}><AppText style={styles.link}>{t("auth:register.termsOfService")}</AppText></Pressable></View> : null}
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={isOwner ? t("mobile:auth.copy.ownerAction") : t("mobile:auth.copy.registerAction")} />
    <Pressable onPress={() => navigation.navigate("Login")}><AppText style={styles.login}>{t("auth:register.hasAccount")} <AppText style={styles.link}>{t("auth:verify.login")}</AppText></AppText></Pressable>
  </View></AuthScreenLayout>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ stack: { gap: 16 }, terms: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, box: { width: 19, height: 19, borderRadius: 5, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }, boxSelected: { borderColor: theme.brand, backgroundColor: theme.brand }, check: { color: theme.surface, fontSize: 13, fontWeight: "800" }, termsText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 20 }, policyLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, policyDot: { color: theme.faint, fontSize: 12 }, login: { color: theme.muted, textAlign: "center", fontSize: 14 }, link: { color: theme.brand, fontWeight: "700" } });
