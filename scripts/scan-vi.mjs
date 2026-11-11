// Quét chuỗi tiếng Việt (có dấu) còn sót trong source mobile.
// Dùng để đo tiến độ i18n: sau mỗi đợt dịch, danh sách này phải chỉ còn
// các file trong EXCLUSIONS hoặc comment/defaultValue.
// Chạy: node scripts/scan-vi.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const VI =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

// Ngoài phạm vi song ngữ theo quyết định dự án:
// - chatbot/assistant + chat realtime giữ tiếng Việt (bắt trước web)
// - văn bản hợp đồng pháp lý, dữ liệu ngân hàng, HTML bản đồ trong WebView
// - file locale
const EXCLUSIONS = [
  "i18n/locales",
  "features/assistant",
  "features/chat",
  "features/contracts/components/ContractDocument.tsx",
  "features/owner/data/banks.ts",
  "features/vehicles/components/vehicleSearchMapHtml.ts",
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const excluded = (f) => EXCLUSIONS.some((x) => f.replace(/\\/g, "/").includes(x));
const results = [];
for (const file of walk(ROOT)) {
  if (excluded(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let count = 0;
  for (const line of lines) {
    if (VI.test(line)) count++;
  }
  if (count > 0) results.push([count, file.replace(/\\/g, "/")]);
}
results.sort((a, b) => b[0] - a[0]);
const total = results.reduce((s, [c]) => s + c, 0);
console.log(`Files with Vietnamese diacritics: ${results.length} (total ${total} lines)`);
for (const [count, file] of results) console.log(`${String(count).padStart(4)}  ${file}`);
