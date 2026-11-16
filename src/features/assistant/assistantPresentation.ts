import { assistantText, getAssistantLocale, type AssistantLocale } from "./assistantLanguage";
/** Suggestions come from server intent/slots. The fallback never guesses from response prose. */
export function getAssistantReplies(_content: string, serverReplies?: string[], locale: AssistantLocale = getAssistantLocale()) {
  return serverReplies ?? ["Tìm ô tô dưới 1 triệu/ngày", "Có mã giảm giá nào không?", "Tôi muốn xem booking của mình"].map(text => assistantText(text, locale));
}
