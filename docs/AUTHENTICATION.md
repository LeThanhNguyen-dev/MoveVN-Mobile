# Authentication - MoveVN Mobile

## 1. Web reference (read-only)

Scanned `src/services`, `src/features`, `src/hooks`, `src/lib`, `src/utils`,
`src/constants`, `src/pages`, `src/components`, and `src/routes` for auth,
tokens, interceptors, roles, OTP, OAuth, and browser storage usage.

Read the relevant implementation in:

- `src/features/auth/services/authService.ts`, `types.ts`, `hooks/useAuth.ts`,
  `utils/authErrors.ts`, `utils/roleRedirect.ts`.
- `src/pages/auth/LoginPage.tsx`, `RegisterPage.tsx`, `OwnerRegisterPage.tsx`,
  `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx`.
- `src/pages/account/LogoutPage.tsx`.
- `src/services/apiClient.ts`, `src/services/endpoints.ts`.
- `src/routes/AppRoutes.tsx`, `ProtectedRoute.tsx`, `GuestRoute.tsx`, `RoleRoute.tsx`.
- `src/features/owner/services/ownerService.ts` (owner registration).
- `src/utils/validation.ts`, `src/components/common/OtpInput.tsx`,
  `src/constants/appConstants.ts`, `src/App.tsx`, `src/main.tsx`,
  `package.json`, `.env.example`.

No actual Web `.env` file or Google client ID was found. No Web files were changed.

## 2. Observed Web behavior

Email/password login and Google login return `{ token, user }` inside the existing
`ApiResponse<T>` envelope. Google sends a Google **access token**, not an ID token.
Registration does not establish a session: it sends the user to Register-purpose
OTP verification, then back to login. Owner registration uses its separate
onboarding registration endpoint; further owner onboarding is outside this task.
Forgot-password requests an OTP; reset submits that OTP and both password fields.
Email verification and resend share endpoints and distinguish purposes by payload.

Web stores sessions in localStorage, attaches a Bearer token, shares an in-flight
refresh on 401, and retries once. Logout calls the backend with the refresh token.
Guest/protected/role routes control access; role priority is Admin, Staff, Owner,
Customer. Mobile retains the role data and only permits an active role owned by
the current user; its only authenticated destination is a success placeholder.

## 3. Endpoints Used

All paths below exist in the Web source. UI calls the migrated services.

| Method | Path | Payload / purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | `email`, `password` |
| POST | `/api/auth/register` | `fullName`, `email`, `phone`, `password`, `confirmPassword`, `role: Customer` |
| POST | `/api/owner-onboarding/register` | Same registration fields, without `role` |
| POST | `/api/auth/google-login` | `accessToken` obtained from Google |
| POST | `/api/auth/verify-otp` | `email`, `otp`, `purpose` |
| POST | `/api/auth/resend-otp` | `email`, `purpose` |
| POST | `/api/auth/forgot-password` | `email` |
| POST | `/api/auth/reset-password` | `email`, `otp`, `newPassword`, `confirmPassword` |
| POST | `/api/auth/refresh-token` | `refreshToken` |
| GET | `/api/auth/me` | Bearer access token |
| POST | `/api/auth/logout` | `refreshToken`, captured Bearer access token |

OTP purposes used: `Register`, `VerifyEmail`, `ForgotPassword`. OTP has six digits.
Passwords for registration/reset require at least eight characters; login only
requires a nonempty password, matching Web behavior. Vietnamese phone validation
requires ten digits starting with zero. Customer registration requires terms consent.

## 4. New Mobile Files In This Task

- `app.config.ts`: optional native Google identifiers/plugin and SecureStore plugin.
- `src/features/auth/components/AuthFlow.tsx`: auth screens and session gate.
- `src/features/auth/services/authSession.ts`: restore, complete login, logout.
- `src/features/auth/services/googleAuth.ts`: native Google access-token exchange.
- `src/features/auth/utils/validation.ts`: validation matching Web rules.
- `tests/auth.test.ts`, `tests/authNavigation.test.ts`: mocked lifecycle/UI tests.
- `vitest.config.mts`: isolated Node test configuration.
- `docs/AUTHENTICATION.md`: this report.

## 5. Existing Mobile Files Modified In This Task

- `App.tsx`: mounts safe-area provider and auth flow.
- `src/features/auth/hooks/useAuth.ts`: awaited, ordered SecureStore writes;
  hydration, storage errors, allowed role selection, logout generation guard.
- `src/features/auth/types.ts`: async persistence action signatures.
- `src/features/auth/services/authService.ts`: public calls use existing bare
  client; logout captures authorization; normalize numeric HTTP error codes.
- `src/services/apiClient.ts`: request timeouts, shared refresh via existing
  `refreshSession`, stale-response guards, one retry, terminal 401 cleanup.
- `src/features/owner/services/ownerService.ts`: only registration uses the bare client.
- `.env.example`: API/Web/OAuth/native app configuration placeholders.
- `.gitignore`: includes the public `.env.example` template in version control.
- `package.json`, `package-lock.json`: dependencies and test command.

`tsconfig.json` and other migrated modules were already present/modified before
this task; they were not changed by this auth implementation.

## 6. Token Storage

The existing Expo SecureStore abstraction remains the single persisted auth store.
`movevn.auth.session` stores the access token, refresh token, expiry/session
metadata, and cached user as JSON. `movevn.auth.activeRole` stores the selected
role. Zustand contains the in-memory session used by the shared axios client.
There is no localStorage, sessionStorage, cookie storage, or plaintext fallback.

Login waits for storage before publishing an authenticated session. Writes are
serialized. Storage errors display a retry gate; the app does not silently claim
that a failed write/delete succeeded. Native SecureStore behavior still needs
device testing, including device-lock and storage-failure behavior.

## 7. Refresh, Restore, Logout

Protected requests attach the current Bearer token. Concurrent 401s share one
refresh operation for the current session generation. Rotated tokens are persisted
before retrying. A delayed 401 whose old token has already been replaced retries
with the current token. Each original request retries at most once. Refresh failure
or another 401 clears the session, making the root render Login.

On startup, read SecureStore, refresh if access expiry indicates expiration, then
call `/api/auth/me`. The startup gate remains until verification completes.
Transient current-user lookup errors retain the stored session behind a retry
screen. The user can explicitly clear it and return to Login.

Logout immediately invalidates local auth, queues SecureStore deletion, and calls
the existing logout service with captured tokens. Generation checks prevent an
older refresh from signing the user back in. If revoke fails offline, local logout
still occurs and an error is shown; server revocation is not claimed to succeed.

## 8. Navigation

The project did not contain Expo Router or React Navigation. AuthFlow uses a
small typed screen state and root auth gate. Unauthenticated users see only auth
screens. Authenticated users see only "Dang nhap thanh cong" (rendered in Vietnamese)
and logout. Login is unmounted and form secrets are cleared when auth changes.
Android Back returns auth forms to Login; there is no retained Login back stack
after successful authentication. No Home or Profile UI was added.

## 9. Dependencies Added

Runtime: `@react-native-google-signin/google-signin`,
`react-native-safe-area-context`, `lucide-react-native`, `react-native-svg`.
Native safe-area and SVG versions were aligned using `expo install`.

Development: `vitest`, `react-test-renderer@19.2.3`, `@types/react-test-renderer`.
Existing `axios`, `zustand`, `expo-secure-store`, and `expo-constants` were reused.

## 10. Configuration And Scope Limits

Set `EXPO_PUBLIC_API_BASE_URL` to the actual backend address reachable from the
phone, e.g. your computer's LAN IP on the backend's existing port. The default
`localhost:5171` is only reachable where that hostname points to the backend.
Set `EXPO_PUBLIC_WEB_BASE_URL` to the deployed Web origin to enable links to the
existing `/policies/privacy-policy` and `/policies/terms-of-service` pages.

Google requires `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and on iOS
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Set `MOVEVN_ANDROID_PACKAGE` and
`MOVEVN_IOS_BUNDLE_IDENTIFIER` to identifiers registered for this app. Register
the Android signing certificate SHA-1 in the same Google Cloud project. The iOS
URL scheme is derived from the configured iOS client ID. No credentials or app
identifiers are invented. Google is hidden when configuration/native support is
unavailable; email authentication remains available in Expo Go.

Google requires a native development/release build, not Expo Go:
https://react-native-google-signin.github.io/docs/setting-up/expo

No working Facebook/Apple login, SMS authentication, passwordless login, or MFA
contract was found, so none was added. Web change-password and login-session
management services do exist and remain migrated, but those account-security
screens are outside the requested login/registration/recovery flow. Further owner
onboarding and all non-auth feature UIs are outside scope.

## 11. Verification And Device Checks

Automated checks: `npm run typecheck`, `npm test` (16 tests),
`npx expo install --check`, and Android/iOS production bundle export.
Tests use mocked SecureStore, native views, and HTTP adapters. They verify login,
registration/OTP, recovery, auth navigation, startup gating, refresh concurrency,
retry termination, logout races, corrupted storage, storage failure, and role checks.
These do not constitute successful authentication against the real backend.

Expo Metro was also started on port 19001 and returned `packager-status:running`.
For this machine's current Wi-Fi connection, Expo Go can use
`exp://192.168.2.19:19001`; Metro status is at `http://localhost:19001/status`.
Test on Android/iOS with the actual
backend: correct/incorrect login, duplicate registration, OTP arrival/expiry/resend,
password reset, app kill/reopen, access-token expiry, refresh expiry/revocation,
logout online/offline, and Google success/cancel/errors in a configured native build.
Verify keyboard handling, small screens, large system text, native Back behavior,
and SecureStore persistence/deletion. No device/emulator visual QA was available.
