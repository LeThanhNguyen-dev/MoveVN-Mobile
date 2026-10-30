import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("lucide-react-native", () => ({ Headphones: "Headphones" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: { brand: "#6B19FF" } }) }));
vi.mock("@/features/supportTickets/TicketUi", () => ({ TicketButton: "TicketButton" }));
vi.mock("@/features/supportTickets/ticketNavigation", () => ({ openSupportTickets: mocks.open }));
import BookingAssistance from "@/features/booking/components/BookingAssistance";
let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });
it("opens the shared support workflow filtered to the booking being viewed", async () => {
  await act(async () => { tree = create(React.createElement(BookingAssistance, { bookingId: 42, bookingCode: "BK42" })); });
  const button = tree!.root.find(n => n.type as unknown === "TicketButton");
  await act(async () => button.props.onPress());
  expect(mocks.open).toHaveBeenCalledWith({ bookingId: 42, bookingCode: "BK42" });
});
