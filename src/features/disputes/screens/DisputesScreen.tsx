import { useState } from "react";

import CreateDisputeScreen, { type DisputeCreatePrefill } from "@/features/disputes/screens/CreateDisputeScreen";
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import DisputeListScreen from "@/features/disputes/screens/DisputeListScreen";

export type { DisputeCreatePrefill };

type View = { name: "list" } | { name: "detail"; id: number } | { name: "create" };

// Cụm tranh chấp dùng chung cho Customer/Owner (mở từ tab Tài khoản,
// có thể điền sẵn từ màn chi tiết booking).
export default function DisputesScreen({
  role,
  initialCreate,
  onConsumedInitial,
  onBack,
}: {
  role: "Customer" | "Owner";
  initialCreate?: DisputeCreatePrefill | null;
  onConsumedInitial?: () => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<View>(() =>
    initialCreate ? { name: "create" } : { name: "list" },
  );
  const [prefill, setPrefill] = useState<DisputeCreatePrefill | null>(initialCreate ?? null);

  function openCreate(next?: DisputeCreatePrefill) {
    setPrefill(next ?? null);
    onConsumedInitial?.();
    setView({ name: "create" });
  }

  if (view.name === "detail") {
    return <DisputeDetailScreen disputeId={view.id} onBack={() => setView({ name: "list" })} />;
  }

  if (view.name === "create") {
    return (
      <CreateDisputeScreen
        role={role}
        initial={prefill}
        onBack={() => {
          setPrefill(null);
          setView({ name: "list" });
        }}
        onCreated={(id) => {
          setPrefill(null);
          setView({ name: "detail", id });
        }}
      />
    );
  }

  return <DisputeListScreen onBack={onBack} onOpenDetail={(id) => setView({ name: "detail", id })} onCreate={() => openCreate()} />;
}
