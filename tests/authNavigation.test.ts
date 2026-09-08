import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  login: vi.fn(), register: vi.fn(), verifyOtp: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), resendOtp: vi.fn(),
  restore: vi.fn(async (): Promise<void> => undefined),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView", Pressable: "Pressable",
  ScrollView: "ScrollView", Switch: "Switch", Text: "Text", TextInput: "TextInput", View: "View",
  Platform: { OS: "android" }, StyleSheet: { create: (styles: unknown) => styles },
  Linking: { openURL: vi.fn() }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("lucide-react-native", () => Object.fromEntries(["ArrowLeft", "ArrowRight", "Check", "Eye", "EyeOff", "KeyRound", "LogOut"].map((name) => [name, name])));
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(async () => null), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));
vi.mock("@/features/auth/services/googleAuth", () => ({ googleAvailable: false, signInWithGoogle: vi.fn() }));
vi.mock("@/features/owner/services/ownerService", () => ({ registerOwnerOnboarding: vi.fn() }));
vi.mock("@/features/auth/utils/authErrors", () => ({ getFriendlyAuthError: () => "Email hoặc mật khẩu không đúng." }));
vi.mock("@/features/auth/services/authService", () => mocks);
vi.mock("@/features/auth/services/authSession", async () => {
  const { useAuthStore } = await import("@/features/auth/hooks/useAuth");
  return {
    restoreSession: () => mocks.restore(),
    completeSignIn: async (result: unknown) => useAuthStore.setState(result as object),
    signOut: async () => useAuthStore.setState({ token: null, user: null }),
  };
});

import AuthFlow from "@/features/auth/components/AuthFlow";
import { useAuthStore } from "@/features/auth/hooks/useAuth";

let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });
const textOf = () => JSON.stringify(tree!.toJSON());
async function mount() {
  useAuthStore.setState({ token: null, user: null, isHydrated: true, storageError: null });
  await act(async () => { tree = create(React.createElement(AuthFlow)); });
}
async function press(title: string) {
  const button = tree!.root.findAll((node) => typeof node.type === "function" && node.props.title === title)[0];
  expect(button).toBeDefined();
  await act(async () => button!.props.onPress());
}
async function enter(label: string, value: string) {
  const input = tree!.root.findAll((node) => (node.type as unknown) === "TextInput" && node.props.accessibilityLabel === label)[0];
  await act(async () => input!.props.onChangeText(value));
}

it("keeps login hidden while restoring, then replaces auth with success and clears it on logout", async () => {
  let release!: () => void;
  mocks.restore.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  await mount();
  expect(textOf()).toContain("Đang kiểm tra phiên đăng nhập");
  expect(textOf()).not.toContain("Chào mừng bạn quay lại");
  await act(async () => release());
  await enter("Email", "test@example.com"); await enter("Mật khẩu", "password");
  mocks.login.mockResolvedValueOnce({ token: { accessToken: "test", refreshToken: "refresh" }, user: { userId: 1, roles: ["Customer"] } });
  await press("Đăng nhập");
  expect(textOf()).toContain("Đăng nhập thành công");
  expect(textOf()).not.toContain("Quên mật khẩu?");
  const logout = tree!.root.findAll((node) => (node.type as unknown) === "Pressable" && node.findAll((child) => (child.type as unknown) === "Text" && child.children.includes("Đăng xuất")).length > 0)[0];
  await act(async () => logout!.props.onPress());
  expect(textOf()).toContain("Chào mừng bạn quay lại");
  expect(textOf()).not.toContain("Đăng nhập thành công");
});

it("validates login and disables inputs during a request, displaying API errors", async () => {
  await mount(); await press("Đăng nhập");
  expect(mocks.login).not.toHaveBeenCalled();
  await enter("Email", "test@example.com"); await enter("Mật khẩu", "wrong");
  let reject!: (error: Error) => void;
  mocks.login.mockImplementationOnce(() => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
  await press("Đăng nhập");
  const inputs = tree!.root.findAll((node) => (node.type as unknown) === "TextInput");
  expect(inputs.every((input) => input.props.editable === false)).toBe(true);
  await act(async () => reject(new Error("Invalid credentials")));
  expect(textOf()).toContain("Email hoặc mật khẩu không đúng.");
});

it("registers a customer, verifies the Register OTP and returns to login without saving tokens", async () => {
  await mount(); await press("Tạo tài khoản");
  await enter("Họ và tên", "Test User"); await enter("Email", "test@example.com");
  await enter("Số điện thoại", "0912345678"); await enter("Mật khẩu", "password"); await enter("Xác nhận mật khẩu", "password");
  const toggle = tree!.root.findAll((node) => (node.type as unknown) === "Switch")[0];
  await act(async () => toggle!.props.onValueChange(true));
  await press("Tạo tài khoản");
  expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer", email: "test@example.com" }));
  expect(textOf()).toContain("Mã OTP");
  await enter("Mã OTP", "123456"); await press("Xác thực");
  expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "test@example.com", otp: "123456", purpose: "Register" });
  expect(textOf()).toContain("Email đã được xác thực");
  expect(useAuthStore.getState().token).toBeNull();
});

it("routes forgotten password through OTP reset and returns to login", async () => {
  await mount(); await press("Quên mật khẩu?"); await enter("Email", "test@example.com"); await press("Gửi OTP");
  expect(mocks.forgotPassword).toHaveBeenCalledWith({ email: "test@example.com" });
  await enter("Mã OTP", "123456"); await enter("Mật khẩu mới", "password"); await enter("Xác nhận mật khẩu", "password");
  await press("Đặt lại mật khẩu");
  expect(mocks.resetPassword).toHaveBeenCalledWith({ email: "test@example.com", otp: "123456", newPassword: "password", confirmPassword: "password" });
  expect(textOf()).toContain("Đã đặt lại mật khẩu");
});
