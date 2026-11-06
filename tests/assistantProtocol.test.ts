import { describe, expect, it } from "vitest";
import * as mobile from "../src/features/assistant/assistantProtocol";
import * as web from "../../MoveVN-FrontEnd/src/features/assistant/assistantProtocol";

for (const [platform, protocol] of [["mobile", mobile], ["web", web]] as const) {
  describe(`${platform} assistant protocol`, () => {
    it("keeps a legacy answer and ignores additive fields", () => {
      expect(protocol.decodeAnswer({ content: "Xin chào", sources: [], cards: [], actions: [], future: 1 })?.content).toBe("Xin chào");
    });
    it("only offers resend for uncertain or transient failures", () => {
      for (const status of [400, 401, 403, 404, 413, 422]) expect(protocol.assistantSendCanRetry({ response: { status } })).toBe(false);
      for (const status of [408, 409, 429, 500, 503]) expect(protocol.assistantSendCanRetry({ response: { status } })).toBe(true);
      expect(protocol.assistantSendCanRetry(new Error("lost response"))).toBe(true);
    });
    it("makes malformed actions inert without hiding valid text", () => {
      const answer = protocol.decodeAnswer({ content: "Đã tìm được xe", sources: null, cards: [null], actions: [null], blocks: [{ type: "confirmCard", data: { confirmToken: "unsafe" } }, { type: "quoteCard", data: null }] });
      expect(answer).toMatchObject({ content: "Đã tìm được xe", sources: [], cards: [], actions: [], blocks: [] });
    });
    it("does not accept arbitrary action block types or malformed quick replies", () => {
      expect(protocol.decodeAnswer({ content: "Chào", blocks: [{ type: "execute", data: {} }], quickReplies: [1, "Tìm xe", ""] })).toMatchObject({ blocks: [], quickReplies: ["Tìm xe"] });
    });
    it("keeps 202 message metadata and distinguishes deadlines from failure", () => {
      const result = protocol.decodeMessage({ id: "m1", status: "Processing", deadlineAt: "2026-10-27T00:01:30Z", serverNow: "2026-10-27T00:00:00Z", phase: "Projecting", projectionStatus: "Pending", outcome: "Committed", answer: null });
      expect(result.phase).toBe("Projecting");
      expect(protocol.pendingNotice(result, Date.parse("2026-10-27T00:02:00Z"))).toContain("ghi nhận");
      expect(result.status).toBe("Processing");
    });
    it("expires action tokens and prevents old draft versions being actionable", () => {
      expect(protocol.actionIsExpired({ expiresAt: "2000-01-01T00:00:00Z" })).toBe(true);
      expect(protocol.answerActionsAllowed({ status: "Completed", draftVersion: 2 }, 3, false)).toBe(false);
      expect(protocol.answerActionsAllowed({ status: "Stale" }, undefined, false)).toBe(false);
      expect(protocol.answerActionsAllowed({ status: "Completed" }, undefined, true)).toBe(false);
    });
    it("shows a durable completed receipt once before history projection is available", () => {
      const receipt = protocol.decodeMessage({ id: "r1", status: "Completed", projectionStatus: "Pending", completedAt: "2026-10-27T00:00:01Z", answer: { content: "Đã ghi nhận đơn", sources: [], cards: [], actions: [] } });
      const once = protocol.applyMessageResult([], receipt);
      expect(once[0]?.content).toBe("Đã ghi nhận đơn");
      expect(protocol.applyMessageResult(once, receipt)).toHaveLength(1);
    });
    it("places an older reply beside its own question when two messages are queued", () => {
      const rows = ["first", "second"].map(id => ({ id: `user:${id}`, requestId: id, role: "user" as const, content: id, status: "Processing", createdAt: "2026-11-03T00:00:00Z", answer: null }));
      const result = protocol.decodeMessage({ id: "first", status: "Completed", answer: { content: "Trả lời câu đầu", sources: [], cards: [], actions: [] } });
      const next = protocol.applyMessageResult(rows, result);
      expect(next.map(item => `${item.role}:${item.requestId}`)).toEqual(["user:first", "assistant:first", "user:second"]);
    });
    it("a stale queued poll cannot regress a completed message or its answer", () => {
      const result = protocol.decodeMessage({ id: "r1", status: "Completed", answer: { content: "Kết quả đã xác minh", sources: [], cards: [], actions: [] } });
      const user = { id: "user:r1", requestId: "r1", role: "user" as const, content: "Xin chào", status: "Processing", createdAt: "2026-11-03T00:00:00Z", answer: null };
      const completed = protocol.applyMessageResult([user], result);
      const next = protocol.applyMessageResult(completed, protocol.decodeMessage({ id: "r1", status: "Queued", answer: null }));
      expect(next[0]?.status).toBe("Completed");
      expect(next[1]?.content).toBe("Kết quả đã xác minh");
    });
  });
}
