// Port từ web MoveVN-FrontEnd/src/features/admin/auditLogLabels.ts.
// Nhãn nằm trong namespace "admin" (sync từ web) — chỉ đổi hiển thị,
// mã nhật ký gốc vẫn dùng để truy vấn API.
import i18n from "@/i18n";
import { getFormatLocale } from "@/i18n/formatLocale";

/** Mã hành động chứa dấu chấm nên lưu dạng "__" để i18next không hiểu là key lồng nhau. */
function actionKey(code: string) {
  return code.replace(/\./g, "__");
}

function translate(key: string, fallback: string) {
  const value = i18n.t(key, { ns: "admin" });
  return typeof value === "string" && value !== key ? value : fallback;
}

function translateAction(code: string) {
  return translate(`auditLabels.action.${actionKey(code)}`, code);
}

function translateField(field: string) {
  return translate(`auditLabels.field.${field.toLowerCase()}`, field);
}

function hasRoleLabel(value: string) {
  return i18n.exists(`auditLabels.role.${value}`, { ns: "admin" });
}

export function formatAuditRole(value?: string | null) {
  if (!value) return translate("auditLabels.role.System", "Hệ thống");
  return translate(`auditLabels.role.${value}`, value);
}

export function formatAuditEntity(value: string) {
  return translate(`auditLabels.entity.${value}`, value);
}

export function formatAuditAction(value: string) {
  return translateAction(value);
}

/** Dịch trạng thái rút tiền/duyệt (Pending, Approved, NeedsManualReview...) theo ngôn ngữ hiện tại. */
export function formatAuditStatus(value?: string | null) {
  if (!value) return "—";
  return translate(`auditLabels.status.${value}`, value);
}

/** Dịch loại giao dịch ví; giữ nguyên mã lạ để dễ tra cứu. */
export function formatTransactionType(value?: string | null) {
  if (!value) return "—";
  return translate(`auditLabels.transaction.${value}`, value);
}

export function formatAuditDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(getFormatLocale(), {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatStatus(value: string, entityType: string) {
  if (entityType === "Contract" && value === "Active") return translate("auditLabels.special.contractActive", "Đang hiệu lực");
  if (entityType === "Payment" && value === "Pending") return translate("auditLabels.special.paymentPending", "Chờ thanh toán");
  return translate(`auditLabels.status.${value}`, value);
}

function formatValue(value: unknown, entityType: string, key = ""): string {
  if (value == null) return "—";
  if (typeof value === "boolean") {
    return value
      ? translate("auditLabels.special.booleanTrue", "Có")
      : translate("auditLabels.special.booleanFalse", "Không");
  }
  if (typeof value === "number" && (key.includes("amount") || ["balance", "oldbalance", "newbalance", "balanceafter", "balancebefore", "totalearned", "totalspent", "platformfee"].includes(key))) {
    return `${value.toLocaleString(getFormatLocale())}đ`;
  }
  if (Array.isArray(value)) return value.map((item) => formatValue(item, entityType, key)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value).map(([field, item]) =>
      `${translateField(field)}: ${formatValue(item, entityType, field.toLowerCase())}`,
    ).join(" · ");
  }
  if (typeof value === "string") {
    if (key === "note") {
      const structured = parseStructuredNote(value);
      if (structured) return formatValue(structured, entityType);
    }
    if (key === "paymentmode") {
      if (value === "ReimburseOwner") return translate("auditLabels.special.paymentModeReimburseOwner", "Hoàn trả khoản chủ xe đã ứng");
      if (value === "CustomerPaysAuthority") return translate("auditLabels.special.paymentModeCustomerPaysAuthority", "Khách tự nộp phạt");
      return value;
    }
    if (key === "compensationdirection") return translate(`auditLabels.compensation.${value}`, value);
    if (key === "settlementmethod") return translate(`auditLabels.settlement.${value}`, value);
    if (key === "reporttype") return translate(`auditLabels.disputeProblem.${value}`, value);
    if (!key || key.includes("status")) return formatStatus(value, entityType);
    if (key === "role" || key === "roles") return formatAuditRole(value);
    if (["transactiontype", "type", "feetype"].includes(key)) return translate(`auditLabels.transaction.${value}`, value);
    if (key.endsWith("at") && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatAuditDateTime(value);
  }
  return String(value);
}

// Ghi chú hợp đồng cũ lưu object C# dạng text. Chỉ parse các trường scalar đã biết,
// không eval code và không đổi ghi chú tự do không khớp hoàn toàn.
function parseStructuredNote(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Ghi chú lịch sử có thể không phải JSON. */ }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return;
  const result: Record<string, string> = {};
  for (const part of trimmed.slice(1, -1).split(",")) {
    const match = /^\s*(ContractNumber|Version|BookingId)\s*=\s*([^{}=,]+?)\s*$/.exec(part);
    const field = match?.[1];
    const value = match?.[2];
    if (!field || value === undefined || Object.prototype.hasOwnProperty.call(result, field)) return;
    result[field] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

export function formatAuditDetail(value: string | null | undefined, entityType: string) {
  if (!value) return "—";
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch { /* Một số nhật ký lưu trạng thái dạng văn bản. */ }
  if (typeof parsed === "string" && entityType === "User" && hasRoleLabel(parsed)) {
    return formatAuditRole(parsed);
  }
  return formatValue(parsed, entityType);
}

export interface AuditDetailEntry {
  /** Nhãn trường (rỗng với giá trị vô danh như chuỗi trạng thái đơn lẻ). */
  label: string;
  value: string;
}

function toDetailEntries(obj: Record<string, unknown>, entityType: string): AuditDetailEntry[] {
  const entries: AuditDetailEntry[] = [];
  for (const [field, item] of Object.entries(obj)) {
    const key = field.toLowerCase();
    // Ghi chú cũ có thể chứa object lồng dạng "{ ContractNumber = ..., Version = ... }".
    // Tách thành từng hàng riêng để dễ đọc thay vì 1 đoạn văn dài.
    if (key === "note" && typeof item === "string") {
      const structured = parseStructuredNote(item);
      if (structured) {
        for (const [subField, subItem] of Object.entries(structured)) {
          entries.push({
            label: translateField(subField),
            value: formatValue(subItem, entityType, subField.toLowerCase()),
          });
        }
        continue;
      }
    }
    entries.push({ label: translateField(field), value: formatValue(item, entityType, key) });
  }
  return entries;
}

/** Tách chi tiết nhật ký thành từng hàng label/value để render dạng danh sách thay vì đoạn văn. */
export function parseAuditDetailEntries(value: string | null | undefined, entityType: string): AuditDetailEntry[] {
  if (!value) return [];
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch { /* Một số nhật ký lưu trạng thái dạng văn bản. */ }
  if (typeof parsed === "string") {
    if (entityType === "User" && hasRoleLabel(parsed)) {
      return [{ label: translateField("role"), value: formatAuditRole(parsed) }];
    }
    return [{ label: "", value: formatValue(parsed, entityType) }];
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return toDetailEntries(parsed as Record<string, unknown>, entityType);
  }
  return [{ label: "", value: formatValue(parsed, entityType) }];
}
