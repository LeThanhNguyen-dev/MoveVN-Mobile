export type AuthStackParamList = {
  Login: { notice?: string } | undefined;
  Register: undefined;
  OwnerRegister: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  VerifyEmail: { email: string; purpose: "Register" | "VerifyEmail" };
};
