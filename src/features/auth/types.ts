export type UserRole = "Admin" | "Owner" | "Customer" | "Staff";

export type UserStatus = "Pending" | "Active" | "Suspended" | "Deleted";

export type OtpPurpose = "Register" | "ForgotPassword" | "VerifyEmail";

export type AuthToken = {
  accessToken: string;
  accessTokenJti: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
};

export type AuthUser = {
  userId: number;
  fullName: string;
  email: string;
  status: UserStatus | string;
  isEmailVerified: boolean;
  phone?: string | null;
  avatarUrl?: string | null;
  roles: UserRole[];
};

export type AuthResponse = {
  token: AuthToken;
  user: AuthUser;
};

export type AuthSession = {
  token: AuthToken | null;
  user: AuthUser | null;
};

export type AuthState = AuthSession & {
  isHydrated: boolean;
  activeRole: UserRole | null;
  setSession: (session: AuthSession) => Promise<void>;
  updateUser: (user: AuthUser | null) => Promise<void>;
  setActiveRole: (role: UserRole) => Promise<void>;
  clearSession: () => Promise<void>;
};

export type ApiResponse<T> = {
  status: boolean;
  code: string;
  message: string;
  data: T | null;
  errors?: string[] | null;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  errors?: string[] | null;
};
