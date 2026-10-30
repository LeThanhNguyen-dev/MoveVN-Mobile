export function getAssistantReplies(content: string, serverReplies?: string[]) {
  if (serverReplies) return serverReplies;
  const lower = content.toLowerCase();
  if (/ngày|date|thời gian|lịch/.test(lower)) return ["Cuối tuần này", "Thuê 2 ngày", "Tôi chưa chốt ngày"];
  if (/tổng hay|ngân sách|bao nhiêu|triệu/.test(lower)) return ["3tr tổng chuyến", "3tr/ngày", "Rẻ nhất trước"];
  if (/loại xe|xe máy|ô tô|tô/.test(lower)) return ["Xe máy", "Ô tô 4 chỗ", "Ô tô 7 chỗ"];
  if (/ở đâu|nhận xe|khu vực|đà nẵng|hồ chí minh|hà nội/.test(lower)) return ["Ngũ Hành Sơn, Đà Nẵng", "Hải Châu, Đà Nẵng", "Sơn Trà, Đà Nẵng"];
  return ["Tìm xe máy dưới 500k/ngày", "Có mã giảm giá nào không?", "Tôi muốn xem booking của mình"];
}
