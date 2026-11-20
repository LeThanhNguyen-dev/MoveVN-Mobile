// BIN ngân hàng Việt Nam phổ biến trả về từ PayOS (trường bin của link thanh toán).
const BANK_LABEL_BY_BIN: Record<string, string> = {
  "970418": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)",
  "970422": "Ngân hàng TMCP Quân đội (MB)",
  "970436": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
  "970415": "Ngân hàng TMCP Công Thương Việt Nam (VietinBank)",
  "970407": "Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)",
  "970432": "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)",
  "970416": "Ngân hàng TMCP Á Châu (ACB)",
  "970403": "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)",
  "970437": "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh (HDBank)",
  "970442": "Ngân hàng TMCP Tiên Phong (TPBank)",
  "970424": "Ngân hàng TMCP Sài Gòn – Hà Nội (SHB)",
  "970441": "Ngân hàng TMCP Quốc tế Việt Nam (VIB)",
  "970425": "Ngân hàng TMCP An Bình (ABBANK)",
  "970438": "Ngân hàng TMCP Bảo Việt (BaoViet Bank)",
  "970414": "Ngân hàng TM TNHH MTV Đại Dương (OceanBank)",
  "970431": "Ngân hàng TMCP Đại chúng Việt Nam (PVcomBank)",
};

export function payosBankLabel(bin?: string | null): string {
  if (!bin) return "PayOS";
  return BANK_LABEL_BY_BIN[bin] ?? "PayOS";
}
