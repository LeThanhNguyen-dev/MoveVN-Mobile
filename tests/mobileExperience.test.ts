import React from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OwnerOverview } from "@/features/owner/services/ownerOverviewService";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  cms: vi.fn(),
  role: vi.fn(),
}));
vi.mock("@/features/owner/services/ownerOverviewService", () => ({
  getOwnerOverview: mocks.overview,
}));
vi.mock("@/features/cms/services/cmsService", () => ({
  getCmsPageBySlug: mocks.cms,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveRole: mocks.role }),
}));
vi.mock("@/theme/useTheme", async () => {
  const { themes } = await import("@/theme/tokens");
  return { useTheme: () => ({ theme: themes.light }) };
});
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  Image: "Image",
  ScrollView: "ScrollView",
  RefreshControl: "RefreshControl",
  ActivityIndicator: "ActivityIndicator",
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  StyleSheet: {
    create: (value: unknown) => value,
    absoluteFill: {},
    flatten: function flatten(value: unknown): Record<string, unknown> {
      return Array.isArray(value)
        ? Object.assign({}, ...value.map(flatten))
        : value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};
    },
  },
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "ArrowRight",
      "BarChart3",
      "CalendarDays",
      "CarFront",
      "Check",
      "ClipboardCheck",
      "Plus",
      "RotateCcw",
      "ChevronDown",
      "CircleHelp",
    ].map((name) => [name, name]),
  ),
);
vi.mock("@/features/app/components/MobileBrandHeader", () => ({
  default: () => null,
}));
vi.mock("@/features/app/screens/MobilityGuideScreen", () => ({
  default: () => null,
}));
vi.mock("@/features/app/screens/SupportCenterScreen", () => ({
  default: () => null,
}));
vi.mock("@/features/ownerAnalytics/OwnerAnalyticsScreen", () => ({
  default: ({ onBack }: { onBack: () => void }) =>
    React.createElement(
      "Pressable",
      { accessibilityLabel: "Quay lại thống kê", onPress: onBack },
      "Analytics",
    ),
}));
import OwnerOverviewScreen from "@/features/app/screens/OwnerOverviewScreen";
import SupportFaqPreview from "@/features/app/components/SupportFaqPreview";

const seed = (): OwnerOverview => ({
  fleet: {
    generatedAt: "2026-10-27T10:00:00Z",
    summary: {
      vehicles: 9,
      available: 4,
      rented: 3,
      overdue: 1,
      blocked: 1,
      pickupsNext24Hours: 2,
      returnsNext24Hours: 3,
    },
  },
  pending: {
    totalCount: 7,
    items: [
      {
        id: 21,
        bookingCode: "BK21",
        vehicleName: "Honda City",
        customerName: "An",
      } as never,
    ],
  },
  returned: { totalCount: 0, items: [] },
  errors: {},
});
const user = {
  userId: 1,
  fullName: "Chủ xe",
  email: "owner@example.com",
  status: "Active",
  isEmailVerified: true,
  roles: ["Owner", "Customer"] as ("Owner" | "Customer")[],
};
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  mocks.overview.mockResolvedValue(seed());
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  vi.clearAllMocks();
});
const textOf = (node: ReactTestInstance) =>
  node
    .findAll((n) => (n.type as unknown) === "Text")
    .map((n) =>
      n.children
        .filter((c) => typeof c === "string" || typeof c === "number")
        .join(""),
    )
    .join("\n");
async function mount(element: React.ReactElement) {
  await act(async () => {
    tree = create(element);
  });
}
async function press(label: string) {
  const target = tree!.root.findAll(
    (n) =>
      (n.type as unknown) === "Pressable" &&
      (n.props.accessibilityLabel === label || textOf(n) === label),
  )[0];
  expect(target, label).toBeDefined();
  await act(async () => target!.props.onPress());
}
const actions = () => ({
  onAddVehicle: vi.fn(),
  onVehicles: vi.fn(),
  onBookings: vi.fn(),
});

it("shows total counts and opens the correct booking filter, detail, vehicles and analytics", async () => {
  const callbacks = actions();
  await mount(React.createElement(OwnerOverviewScreen, { user, ...callbacks }));
  await press("Chờ duyệt: 7");
  expect(callbacks.onBookings).toHaveBeenLastCalledWith("Pending");
  await press("Chờ nhận lại: 0");
  expect(callbacks.onBookings).toHaveBeenLastCalledWith("Returned");
  const row = tree!.root.findAll(
    (n) =>
      (n.type as unknown) === "Pressable" && textOf(n).includes("Honda City"),
  )[0]!;
  await act(async () => row.props.onPress());
  expect(callbacks.onBookings).toHaveBeenLastCalledWith(undefined, 21);
  await press("Thêm xe");
  expect(callbacks.onAddVehicle).toHaveBeenCalledOnce();
  await press("Xem đội xe");
  expect(callbacks.onVehicles).toHaveBeenCalledOnce();
  await press("Thống kê hiệu quả đội xe");
  expect(tree!.toJSON()).toMatchObject({
    props: { accessibilityLabel: "Quay lại thống kê" },
  });
  await press("Quay lại thống kê");
  expect(textOf(tree!.root)).toContain("Tổng quan chủ xe");
});
it("does not declare all work handled when one worklist failed and retry reloads", async () => {
  mocks.overview.mockResolvedValueOnce({
    ...seed(),
    pending: null,
    errors: { pending: "Không tải được yêu cầu chờ duyệt." },
  });
  await mount(React.createElement(OwnerOverviewScreen, { user, ...actions() }));
  expect(textOf(tree!.root)).toContain("Không tải được yêu cầu chờ duyệt.");
  expect(textOf(tree!.root)).not.toContain("Bạn đã xử lý hết công việc");
  await press("Thử lại");
  expect(mocks.overview).toHaveBeenCalledTimes(2);
  await press("Chờ duyệt: 7");
});
it("shows an empty fleet only for a successful zero response and supports switching role", async () => {
  const value = seed();
  value.fleet!.summary.vehicles = 0;
  value.pending = { totalCount: 0, items: [] };
  mocks.overview.mockResolvedValueOnce(value);
  await mount(React.createElement(OwnerOverviewScreen, { user, ...actions() }));
  expect(textOf(tree!.root)).toContain("Chưa có xe nào");
  expect(textOf(tree!.root)).toContain("Bạn đã xử lý hết công việc");
  await press("Khách thuê");
  expect(mocks.role).toHaveBeenCalledWith("Customer");
});
it("ignores a response from an obsolete dashboard refresh", async () => {
  let resolveOld!: (value: OwnerOverview) => void;
  mocks.overview.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await mount(React.createElement(OwnerOverviewScreen, { user, ...actions() }));
  await act(async () =>
    tree!.root
      .find((n) => (n.type as unknown) === "ScrollView")
      .props.refreshControl.props.onRefresh(),
  );
  expect(mocks.overview.mock.calls[0]![0].aborted).toBe(true);
  const old = seed();
  old.pending!.totalCount = 999;
  await act(async () => resolveOld(old));
  expect(textOf(tree!.root)).not.toContain("999");
});
it("uses published FAQ content for the accordion and drops stale role content", async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.cms.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await mount(
    React.createElement(SupportFaqPreview, {
      slug: "customer",
      onOpen: vi.fn(),
    }),
  );
  const page = (title: string) => ({
    contentType: "FAQ",
    content: JSON.stringify({
      version: 2,
      sections: [
        {
          id: "section",
          type: "accordion",
          title: "Guide",
          items: [{ id: "q1", title, content: "<p>Giấy tờ hợp lệ.</p>" }],
        },
      ],
    }),
  });
  mocks.cms.mockResolvedValueOnce(page("Điều kiện chủ xe?"));
  await act(async () =>
    tree!.update(
      React.createElement(SupportFaqPreview, {
        slug: "owner",
        onOpen: vi.fn(),
      }),
    ),
  );
  await act(async () => resolveOld(page("Điều kiện khách thuê?")));
  expect(textOf(tree!.root)).not.toContain("Điều kiện khách thuê?");
  await press("Điều kiện chủ xe?");
  expect(textOf(tree!.root)).toContain("Giấy tờ hợp lệ.");
});
