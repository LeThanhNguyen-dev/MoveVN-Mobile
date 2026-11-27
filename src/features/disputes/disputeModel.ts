export const validDisputeId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0;

// Backend chỉ nhận tranh chấp hư hại trong 48h kể từ khi hoàn tất trả xe
// (DisputeWorkflowRules.IsDamageDisputeWindowOpen): ưu tiên completedAt rồi returnedAt.
// Thiếu cả hai mốc thì để backend quyết định theo biên bản checkout.
export const DAMAGE_DISPUTE_WINDOW_HOURS = 48;
export function isDamageDisputeWindowOpen(completedAt: string | null | undefined, now: number): boolean {
  if (!completedAt) return true;
  const anchor = new Date(completedAt).getTime();
  if (!Number.isFinite(anchor)) return true;
  return now >= anchor && now <= anchor + DAMAGE_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
}

// Thông báo Dispute của backend có cả disputeId và targetPath; push cũ có thể chỉ có một.
// Chỉ nhận deep link của Customer/Owner — Staff/Admin mở trên web.
export function disputeFromNotification(dataJson?: string | null): number | null {
  try {
    const data = JSON.parse(dataJson || "{}");
    const direct = Number(data?.disputeId);
    if (validDisputeId(direct)) return direct;
    const match =
      typeof data?.targetPath === "string" &&
      data.targetPath.match(/^\/(?:customer|owner)\/disputes\?disputeId=(\d+)$/i);
    if (match) {
      const id = Number(match[1]);
      if (validDisputeId(id)) return id;
    }
    return null;
  } catch {
    return null;
  }
}
