export type AuthScreen = "login" | "register" | "owner" | "forgot" | "reset" | "verify";
export type AuthFields = { email: string; password: string; confirmPassword: string; fullName: string; phone: string; otp: string };
export type FieldErrors = Partial<Record<keyof AuthFields | "terms", string>>;

export function validateEmail(email: string) {
  if (!email.trim()) return "Vui lòng nhập email.";
  if (email.trim().length > 256) return "Email không được vượt quá 256 ký tự.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Email không đúng định dạng.";
}

export function validateAuth(screen: AuthScreen, fields: AuthFields, terms: boolean): FieldErrors {
  const errors: FieldErrors = { email: validateEmail(fields.email) };
  const registration = screen === "register" || screen === "owner";
  if (screen === "login" && !fields.password) errors.password = "Vui lòng nhập mật khẩu.";
  if (registration || screen === "reset") {
    if (!fields.password.trim() || fields.password.length < 8) errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    if (!fields.confirmPassword.trim() || fields.password !== fields.confirmPassword) errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  }
  if (registration) {
    if (!fields.fullName.trim() || fields.fullName.trim().length > 200) errors.fullName = "Vui lòng nhập họ tên, tối đa 200 ký tự.";
    if (!/^0\d{9}$/.test(fields.phone.trim())) errors.phone = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.";
    if (screen === "register" && !terms) errors.terms = "Vui lòng đồng ý với điều khoản sử dụng.";
  }
  if ((screen === "verify" || screen === "reset") && !/^\d{6}$/.test(fields.otp)) errors.otp = "Mã OTP phải gồm đúng 6 chữ số.";
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => Boolean(value)));
}
