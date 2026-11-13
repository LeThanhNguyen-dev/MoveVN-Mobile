import i18n from "@/i18n";

export type AuthScreen = "login" | "register" | "owner" | "forgot" | "reset" | "verify";
export type AuthFields = { email: string; password: string; confirmPassword: string; fullName: string; phone: string; otp: string };
export type FieldErrors = Partial<Record<keyof AuthFields | "terms", string>>;

export function validateEmail(email: string) {
  if (!email.trim()) return i18n.t("common:validation.emailRequired");
  if (email.trim().length > 256) return i18n.t("common:validation.emailTooLong");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : i18n.t("common:validation.emailInvalid");
}

export function validateAuth(screen: AuthScreen, fields: AuthFields, terms: boolean): FieldErrors {
  const errors: FieldErrors = { email: validateEmail(fields.email) };
  const registration = screen === "register" || screen === "owner";
  if (screen === "login" && !fields.password) errors.password = i18n.t("auth:login.passwordRequired");
  if (registration || screen === "reset") {
    if (!fields.password.trim() || fields.password.length < 8) errors.password = i18n.t("common:validation.passwordMinLength", { label: i18n.t("auth:fields.password") });
    if (!fields.confirmPassword.trim() || fields.password !== fields.confirmPassword) errors.confirmPassword = i18n.t("common:validation.confirmPasswordMismatch");
  }
  if (registration) {
    if (!fields.fullName.trim() || fields.fullName.trim().length > 200) errors.fullName = i18n.t("mobile:auth.validation.fullNameInvalid");
    if (!/^0\d{9}$/.test(fields.phone.trim())) errors.phone = i18n.t("mobile:auth.validation.phoneInvalid");
    if (screen === "register" && !terms) errors.terms = i18n.t("mobile:auth.validation.termsRequired");
  }
  if ((screen === "verify" || screen === "reset") && !/^\d{6}$/.test(fields.otp)) errors.otp = i18n.t("common:validation.otpLength");
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => Boolean(value)));
}
