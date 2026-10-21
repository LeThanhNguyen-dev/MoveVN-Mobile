import { useEffect, useState } from "react";

import CreateDisputeScreen, { type DisputeCreatePrefill } from "@/features/disputes/screens/CreateDisputeScreen";
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import DisputeListScreen from "@/features/disputes/screens/DisputeListScreen";

export type { DisputeCreatePrefill };

type View = { name: "list" } | { name: "detail"; id: number } | { name: "create" };

// Cụm tranh chấp dùng chung cho Customer/Owner (mở từ tab Tài khoản,
// có thể điền sẵn từ màn chi tiết booking).
// Khi mở từ chi tiết booking (deep-link, initialCreate != null), caller có thể
// truyền onExit để nút back quay về đúng trang gốc thay vì rớt vào danh sách.
export default function DisputesScreen({
  role,
  initialCreate,
  onConsumedInitial,
  onBack,
  onRouteChange,
  onExit,
}: {
  role: "Customer" | "Owner";
  initialCreate?: DisputeCreatePrefill | null;
  onConsumedInitial?: () => void;
  onBack: () => void;
  onRouteChange?: (view: View["name"]) => void;
  onExit?: () => void;
}) {
  const [view, setView] = useState<View>(() =>
    initialCreate ? { name: "create" } : { name: "list" },
  );
  const [prefill, setPrefill] = useState<DisputeCreatePrefill | null>(initialCreate ?? null);
  // Chốt chế độ deep-link lúc mount — tránh đổi luồng giữa chừng khi prefill được consume.
  const [isDeepLink] = useState(() => initialCreate != null);

  function exitToOrigin() {
    setPrefill(null);
    onConsumedInitial?.();
    if (onExit) onExit();
    else onBack();
  }

  useEffect(() => {
    onRouteChange?.(view.name);
  }, [view.name, onRouteChange]);

  function openCreate(next?: DisputeCreatePrefill) {
    setPrefill(next ?? null);
    onConsumedInitial?.();
    setView({ name: "create" });
  }

  if (view.name === "detail") {
    return (
      <DisputeDetailScreen
        disputeId={view.id}
        onBack={() => {
          // Vừa tạo từ chi tiết booking xong mà back thì về lại booking đó.
          if (isDeepLink && onExit) exitToOrigin();
          else setView({ name: "list" });
        }}
      />
    );
  }

  if (view.name === "create") {
    return (
      <CreateDisputeScreen
        role={role}
        initial={prefill}
        onBack={() => {
          // Vào từ booking nào thì Hủy/back về đúng trang đó.
          if (isDeepLink && onExit) exitToOrigin();
          else {
            setPrefill(null);
            setView({ name: "list" });
          }
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
