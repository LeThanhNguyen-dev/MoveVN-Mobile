import i18n from "@/i18n";
import { translatedLabels } from "@/i18n/liveLabels";
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
  if (!signed) return i18n.t("contract:section.unsigned");
  return at
    ? i18n.t("mobile:contract.audit.signedWithDate", { date: formatDate(at) })
    : i18n.t("contract:section.signed");
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

// Nhãn audit hiển thị trên timeline; getters resolve bản dịch ở mỗi lần đọc.
const AUDIT_ACTION_LABELS: Record<string, string> = translatedLabels("mobile", {
  "Contract.Create": "contract.audit.actionCreate",
  "Contract.SendForSigning": "contract.audit.actionSendForSigning",
  "Contract.Sign": "contract.audit.actionSign",
  "Contract.Extend": "contract.audit.actionExtend",
  "Contract.Complete": "contract.audit.actionComplete",
  "Contract.Cancel": "contract.audit.actionCancel",
  "Contract.Terminate": "contract.audit.actionTerminate",
});

const AUDIT_ROLE_LABELS: Record<string, string> = translatedLabels("mobile", {
  Owner: "contract.audit.roleOwner",
  Customer: "contract.audit.roleCustomer",
  System: "contract.audit.roleSystem",
});

const SIGN_STATUS_LABELS: Record<string, string> = translatedLabels("mobile", {
  Signed: "contract.audit.signStatusSigned",
  Unsigned: "contract.audit.signStatusUnsigned",
});

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
    return (
      i18n.t("mobile:contract.audit.versionFromTo", { from: from || "?", to: to || "?" }) +
      (days ? i18n.t("mobile:contract.audit.versionDaysSuffix", { days }) : "")
    );
  }
  if (action === "Contract.Sign") {
    const owner = text(pick(note, "ownerSignStatus"));
    const customer = text(pick(note, "customerSignStatus"));
    if (owner || customer) {
      return i18n.t("mobile:contract.audit.signSummary", {
        owner: SIGN_STATUS_LABELS[owner] ?? (owner || "?"),
        customer: SIGN_STATUS_LABELS[customer] ?? (customer || "?"),
      });
    }
    return pick(note, "signedByOwner") === true ? i18n.t("mobile:contract.audit.ownerSigned") : null;
  }
  if (action === "Contract.Cancel" || action === "Contract.Terminate") {
    const reason = text(pick(note, "cancelReason"));
    return reason ? `${i18n.t("contract:extensionRequest.reason")} ${reason}` : null;
  }
  const number = text(pick(note, "contractNumber"));
  const version = text(pick(note, "version"));
  if (!number) return null;
  return (
    i18n.t("mobile:contract.audit.contractRef", { number }) +
    (version ? i18n.t("mobile:contract.audit.contractRefVersionSuffix", { version }) : "")
  );
}

/** Chuyển audit thô (action PascalCase + note JSON) thành nội dung hiển thị theo ngôn ngữ hiện tại. */
export function auditEntryView(entry: ContractAuditLogItem): {
  action: string;
  actor: string;
  note: string | null;
} {
  const parsed = readNote(entry.note);
  return {
    action: AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
    actor: entry.actorName?.trim() || AUDIT_ROLE_LABELS[entry.actorRole ?? ""] || i18n.t("mobile:contract.audit.roleSystem"),
    note: parsed ? describeNote(entry.action, parsed) : entry.note?.trim() || null,
  };
}
