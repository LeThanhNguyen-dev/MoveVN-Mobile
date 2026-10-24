import { Headphones } from "lucide-react-native";
import { View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { openSupportTickets } from "@/features/supportTickets/ticketNavigation";
import { TicketButton } from "@/features/supportTickets/TicketUi";

export default function BookingAssistance({ bookingId, bookingCode }: { bookingId: number; bookingCode: string }) {
  const { theme } = useTheme();
  return <View style={{ marginVertical: 8 }}><TicketButton secondary title="Hỗ trợ đơn thuê này" icon={<Headphones size={19} color={theme.brand} />} onPress={() => openSupportTickets({ bookingId, bookingCode })} /></View>;
}
