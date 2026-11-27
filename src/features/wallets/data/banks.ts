// Keep bank identities and optical logo sizing in sync with the web client.
// Optical scales compensate for whitespace in the VietQR provider PNGs.
const BANK_BRANDING: Record<string, { shortName: string; logo: string; logoScale: number }> = {
  "970436": { shortName: "Vietcombank", logo: "https://cdn.vietqr.io/img/VCB.png", logoScale: 1.3 },
  "970418": { shortName: "BIDV", logo: "https://cdn.vietqr.io/img/BIDV.png", logoScale: 1.5 },
  "970415": { shortName: "VietinBank", logo: "https://cdn.vietqr.io/img/ICB.png", logoScale: 1.3 },
  "970405": { shortName: "Agribank", logo: "https://cdn.vietqr.io/img/VBA.png", logoScale: 1.13 },
  "970422": { shortName: "MB Bank", logo: "https://cdn.vietqr.io/img/MB.png", logoScale: 1.5 },
  "970407": { shortName: "Techcombank", logo: "https://cdn.vietqr.io/img/TCB.png", logoScale: 1.15 },
  "970416": { shortName: "ACB", logo: "https://cdn.vietqr.io/img/ACB.png", logoScale: 1.65 },
  "970432": { shortName: "VPBank", logo: "https://cdn.vietqr.io/img/VPB.png", logoScale: 1.35 },
  "970423": { shortName: "TPBank", logo: "https://cdn.vietqr.io/img/TPB.png", logoScale: 1.35 },
  "970403": { shortName: "Sacombank", logo: "https://cdn.vietqr.io/img/SACOMBANK.png", logoScale: 1.3 },
  "970437": { shortName: "HDBank", logo: "https://cdn.vietqr.io/img/HDB.png", logoScale: 1.4 },
  "970443": { shortName: "SHB", logo: "https://cdn.vietqr.io/img/SHB.png", logoScale: 1.6 },
  "970441": { shortName: "VIB", logo: "https://cdn.vietqr.io/img/VIB.png", logoScale: 1.7 },
  "970449": { shortName: "LPBank", logo: "https://cdn.vietqr.io/img/LPBANK.png", logoScale: 1.4 },
  "970426": { shortName: "MSB", logo: "https://cdn.vietqr.io/img/MSB.png", logoScale: 1.35 },
  "970429": { shortName: "SCB", logo: "https://cdn.vietqr.io/img/SCB.png", logoScale: 1.7 },
  "970448": { shortName: "OCB", logo: "https://cdn.vietqr.io/img/OCB.png", logoScale: 1.45 },
  "970440": { shortName: "SeABank", logo: "https://cdn.vietqr.io/img/SEAB.png", logoScale: 1.45 },
  "970452": { shortName: "KienlongBank", logo: "https://cdn.vietqr.io/img/KLB.png", logoScale: 1.02 },
  "970425": { shortName: "ABBANK", logo: "https://cdn.vietqr.io/img/ABB.png", logoScale: 1.5 },
  "970427": { shortName: "VietABank", logo: "https://cdn.vietqr.io/img/VAB.png", logoScale: 1.15 },
  "970428": { shortName: "Nam A Bank", logo: "https://cdn.vietqr.io/img/NAB.png", logoScale: 1.2 },
  "970412": { shortName: "PVcomBank", logo: "https://cdn.vietqr.io/img/PVCB.png", logoScale: 1.65 },
  "970431": { shortName: "Eximbank", logo: "https://cdn.vietqr.io/img/EIB.png", logoScale: 1.2 },
  "970409": { shortName: "BAC A BANK", logo: "https://cdn.vietqr.io/img/BAB.png", logoScale: 1.35 },
  "970421": { shortName: "VRB", logo: "https://cdn.vietqr.io/img/VRB.png", logoScale: 1.8 },
  "422589": { shortName: "CIMB", logo: "https://cdn.vietqr.io/img/CIMB.png", logoScale: 1.3 },
  "458761": { shortName: "HSBC", logo: "https://cdn.vietqr.io/img/HSBC.png", logoScale: 1.35 },
  "970438": { shortName: "BaoVietBank", logo: "https://cdn.vietqr.io/img/BVB.png", logoScale: 1.3 },
  "970419": { shortName: "NCB", logo: "https://cdn.vietqr.io/img/NCB.png", logoScale: 1.35 },
  "970400": { shortName: "SaigonBank", logo: "https://cdn.vietqr.io/img/SGICB.png", logoScale: 1.7 },
};

export const VIETNAM_BANKS = [
  { code: "VCB", bin: "970436", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)" },
  { code: "BIDV", bin: "970418", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)" },
  { code: "ICB", bin: "970415", name: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)" },
  { code: "VBA", bin: "970405", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)" },
  { code: "MB", bin: "970422", name: "Ngân hàng TMCP Quân đội (MB Bank)" },
  { code: "TCB", bin: "970407", name: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)" },
  { code: "ACB", bin: "970416", name: "Ngân hàng TMCP Á Châu (ACB)" },
  { code: "VPB", bin: "970432", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)" },
  { code: "TPB", bin: "970423", name: "Ngân hàng TMCP Tiên Phong (TPBank)" },
  { code: "STB", bin: "970403", name: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)" },
  { code: "HDB", bin: "970437", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh (HDBank)" },
  { code: "SHB", bin: "970443", name: "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)" },
  { code: "VIB", bin: "970441", name: "Ngân hàng TMCP Quốc tế Việt Nam (VIB)" },
  { code: "LPB", bin: "970449", name: "Ngân hàng TMCP Bưu điện Liên Việt (LPBank)" },
  { code: "MSB", bin: "970426", name: "Ngân hàng TMCP Hàng Hải Việt Nam (MSB)" },
  { code: "SCB", bin: "970429", name: "Ngân hàng TMCP Sài Gòn (SCB)" },
  { code: "OCB", bin: "970448", name: "Ngân hàng TMCP Phương Đông (OCB)" },
  { code: "SEAB", bin: "970440", name: "Ngân hàng TMCP Đông Nam Á (SeABank)" },
  { code: "KLB", bin: "970452", name: "Ngân hàng TMCP Kiên Long (KienlongBank)" },
  { code: "ABB", bin: "970425", name: "Ngân hàng TMCP An Bình (ABBANK)" },
  { code: "VAB", bin: "970427", name: "Ngân hàng TMCP Việt Á (VietABank)" },
  { code: "NAB", bin: "970428", name: "Ngân hàng TMCP Nam Á (Nam A Bank)" },
  { code: "PVCB", bin: "970412", name: "Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)" },
  { code: "EIB", bin: "970431", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)" },
  { code: "BAB", bin: "970409", name: "Ngân hàng TMCP Bắc Á (BAC A BANK)" },
  { code: "VRB", bin: "970421", name: "Ngân hàng Liên doanh Việt - Nga (VRB)" },
  { code: "CIMB", bin: "422589", name: "Ngân hàng TNHH MTV CIMB Việt Nam" },
  { code: "HSBC", bin: "458761", name: "Ngân hàng HSBC Việt Nam" },
  { code: "BVB", bin: "970438", name: "Ngân hàng TMCP Bảo Việt (BaoVietBank)" },
  { code: "NCB", bin: "970419", name: "Ngân hàng TMCP Quốc Dân (NCB)" },
  { code: "SGB", bin: "970400", name: "Ngân hàng TMCP Sài Gòn Công Thương (SaigonBank)" },
].map((bank) => ({ ...bank, ...BANK_BRANDING[bank.bin] }));

export type BankOption = (typeof VIETNAM_BANKS)[number];

export function normalizeBankSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findVietnamBank(bin?: string | null, name?: string | null): BankOption | undefined {
  if (bin?.trim()) return VIETNAM_BANKS.find((bank) => bank.bin === bin.trim());
  const normalized = normalizeBankSearch(name ?? "");
  if (!normalized) return undefined;
  return VIETNAM_BANKS.find((bank) => [
    bank.name, bank.shortName, bank.code, bank.name.replace(/\s*\([^)]*\)\s*$/, ""),
  ].some((alias) => typeof alias === "string" && normalizeBankSearch(alias) === normalized));
}
