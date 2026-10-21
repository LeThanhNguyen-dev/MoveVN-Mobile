import { useEffect, useState } from "react";
import type { BookingRole } from "../bookingDisplay";
import BookingDetailScreen from "./BookingDetailScreen";
import BookingListScreen from "./BookingListScreen";

export default function BookingsTabScreen({ role, onDetailChange }: { role: BookingRole; onDetailChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { onDetailChange(selected !== null); return () => onDetailChange(false); }, [selected, onDetailChange]);
  return selected !== null ? <BookingDetailScreen bookingId={selected} role={role} onBack={() => setSelected(null)} />
    : <BookingListScreen role={role} onOpen={setSelected} />;
}
