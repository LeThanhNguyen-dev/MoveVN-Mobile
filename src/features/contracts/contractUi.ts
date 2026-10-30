import { formatDate } from "@/features/booking/utils/format";
import type { ContractAuditLogItem } from "@/features/contracts/contractService";
import type { ContractSummary } from "@/features/contracts/types";

export function contractTone(status: string): "brand" | "mint" | "warn" | "danger" | "neutral" {
  if (status === "Active") return "mint";
  if (status === "PendingSigning") return "warn";
  if (status === "Overdue") return "danger";
  return "neutral";
}

export function signLabel(signed: boolean, at?: string | null): string {
  if (!signed) return "Chưa ký";
  return at ? `Đã ký · ${formatDate(at)}` : "Đã ký";
}

export function canSignContract(contract: ContractSummary, userId: number): boolean {
  if (contract.status !== "PendingSigning" && contract.status !== "Draft") return false;
  if (userId === contract.ownerId) return contract.ownerSignStatus !== "Signed";
  if (userId === contract.customerId) return contract.customerSignStatus !== "Signed";
  return false;
}

export function isParty(contract: ContractSummary, userId: number): boolean {
  return userId === contract.ownerId || userId === contract.customerId;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "Contract.Create": "Tạo hợp đồng",
  "Contract.SendForSigning": "Gửi để ký",
  "Contract.Sign": "Ký điện tử",
  "Contract.Extend": "Gia hạn hợp đồng",
  "Contract.Complete": "Hoàn tất hợp đồng",
  "Contract.Cancel": "Hủy hợp đồng",
  "Contract.Terminate": "Chấm dứt hợp đồng",
};

const AUDIT_ROLE_LABELS: Record<string, string> = {
  Owner: "Chủ xe",
  Customer: "Khách thuê",
  System: "Hệ thống",
};

const SIGN_STATUS_LABELS: Record<string, string> = {
  Signed: "đã ký",
  Unsigned: "chưa ký",
};

function readNote(note?: string | null): Record<string, unknown> | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Backend lưu note dạng JSON với key PascalCase, đọc không phân biệt hoa thường.
function pick(note: Record<string, unknown>, key: string): unknown {
  if (key in note) return note[key];
  const lowered = key.toLowerCase();
  const match = Object.keys(note).find((k) => k.toLowerCase() === lowered);
  return match ? note[match] : undefined;
}

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));

function describeNote(action: string, note: Record<string, unknown>): string | null {
  if (action === "Contract.Extend") {
    const from = text(pick(note, "fromVersion"));
    const to = text(pick(note, "toVersion"));
    const days = text(pick(note, "additionalDays"));
    if (!from && !to) return null;
    return `Phiên bản ${from || "?"} → ${to || "?"}${days ? ` · cộng ${days} ngày` : ""}`;
  }
  if (action === "Contract.Sign") {
    const owner = text(pick(note, "ownerSignStatus"));
    const customer = text(pick(note, "customerSignStatus"));
    if (owner || customer) {
      return `Chủ xe: ${SIGN_STATUS_LABELS[owner] ?? (owner || "?")} · Khách thuê: ${SIGN_STATUS_LABELS[customer] ?? (customer || "?")}`;
    }
    return pick(note, "signedByOwner") === true ? "Chủ xe ký điện tử" : null;
  }
  if (action === "Contract.Cancel" || action === "Contract.Terminate") {
    const reason = text(pick(note, "cancelReason"));
    return reason ? `Lý do: ${reason}` : null;
  }
  const number = text(pick(note, "contractNumber"));
  const version = text(pick(note, "version"));
  if (!number) return null;
  return `Hợp đồng ${number}${version ? ` · v${version}` : ""}`;
}

/** Chuyển audit thô (action PascalCase + note JSON) thành nội dung tiếng Việt để hiển thị. */
export function auditEntryView(entry: ContractAuditLogItem): {
  action: string;
  actor: string;
  note: string | null;
} {
  const parsed = readNote(entry.note);
  return {
    action: AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
    actor: entry.actorName?.trim() || AUDIT_ROLE_LABELS[entry.actorRole ?? ""] || "Hệ thống",
    note: parsed ? describeNote(entry.action, parsed) : entry.note?.trim() || null,
  };
}
