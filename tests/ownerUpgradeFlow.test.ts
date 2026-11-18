import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const mocks = vi.hoisted(() => ({
  createApplication: vi.fn(),
  getMyApplication: vi.fn(),
  submitApplication: vi.fn(),
  updateBankInfo: vi.fn(),
  uploadNationalId: vi.fn(),
  refreshAuthSession: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock("@/features/owner/services/ownerService", () => ({ ...mocks }));
vi.mock("@/services/apiClient", () => ({ refreshAuthSession: mocks.refreshAuthSession }));
vi.mock("@/components/AppText", () => ({ default: ({ children }: { children: React.ReactNode }) => React.createElement("Text", null, children) }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: {
  brand: "#126e82", text: "#16252b", muted: "#607078", faint: "#87949a", border: "#d6dfe2",
  success: "#24734f", successSoft: "#e7f4ec", brandSoft: "#e8f3f5", danger: "#b33a3a",
  dangerSoft: "#f9eaea", surfaceAlt: "#f3f6f7", brandBorder: "#a8ccd2", onBrand: "#ffffff",
} }) }));
vi.mock("@/features/driverLicenses/driverLicenseDisplay", () => ({ driverLicenseStatusLabel: {} }));
vi.mock("@/features/pin/components/MaskedDocumentValue", () => ({ default: () => null }));
vi.mock("@/utils/documentImage", () => ({ prepareDocumentImage: vi.fn() }));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(), requestMediaLibraryPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(), launchImageLibraryAsync: vi.fn(), MediaTypeOptions: { Images: "Images" },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.translate }) }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator", Image: "Image", StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("lucide-react-native", () => Object.fromEntries(
  ["AlertTriangle", "ArrowLeft", "Camera", "CheckCircle2", "Clock", "ImagePlus", "RefreshCw"].map((name) => [name, name]),
));

import OwnerVerificationScreen from "@/features/owner/screens/OwnerVerificationScreen";

const application = {
  id: 12,
  status: "WaitingBankInfo",
  nationalIdVerified: true,
  bankInfoCompleted: false,
  isOwner: false,
  nextStep: "BankInfo" as const,
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolderName: "",
  createdAt: "2026-01-01T00:00:00Z",
};
let tree: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyApplication.mockResolvedValue({ ...application });
  mocks.createApplication.mockResolvedValue({ id: 12, status: "WaitingBankInfo", nextStep: "BankInfo" });
  mocks.updateBankInfo.mockResolvedValue({ ...application, status: "ReadyToSubmit", bankInfoCompleted: true });
  mocks.submitApplication.mockResolvedValue({ status: "Approved", isOwner: true, requiresTokenRefresh: true, nextStep: "OwnerDashboard" });
  mocks.refreshAuthSession.mockResolvedValue({});
});

afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});

async function mount(onBack = vi.fn()) {
  await act(async () => { tree = create(React.createElement(OwnerVerificationScreen, { onBack })); });
  return onBack;
}

function pressableWithText(key: string) {
  return tree!.root.findAll((node) => node.type as unknown === "Pressable")
    .find((node) => node.findAll((child) => child.type as unknown === "Text")
      .some((child) => child.children.join("").includes(key)));
}

it("lets an already verified mobile user save bank details and complete the owner upgrade", async () => {
  const onBack = await mount();
  const fields = tree!.root.findAll((node) => node.type as unknown === "TextInput");
  expect(fields).toHaveLength(3);
  await act(async () => {
    fields.find((field) => field.props.accessibilityLabel === "mobile:ownerHome.verification.bankName")!.props.onChangeText("Vietcombank");
    fields.find((field) => field.props.accessibilityLabel === "mobile:ownerHome.verification.bankAccountNumber")!.props.onChangeText("123456789");
    fields.find((field) => field.props.accessibilityLabel === "mobile:ownerHome.verification.bankAccountHolderName")!.props.onChangeText("NGUYEN VAN A");
  });

  await act(async () => { await pressableWithText("saveBankInfo")!.props.onPress(); });
  expect(mocks.updateBankInfo).toHaveBeenCalledWith({
    bankName: "Vietcombank", bankAccountNumber: "123456789", bankAccountHolderName: "NGUYEN VAN A",
  });

  await act(async () => { await pressableWithText("upgradeOwner")!.props.onPress(); });
  expect(mocks.submitApplication).toHaveBeenCalledTimes(1);
  expect(mocks.refreshAuthSession).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
});

it("does not offer the upgrade action before CCCD verification", async () => {
  mocks.getMyApplication.mockResolvedValue({ ...application, nationalIdVerified: false });
  await mount();
  expect(pressableWithText("upgradeOwner")).toBeUndefined();
  expect(mocks.submitApplication).not.toHaveBeenCalled();
});
