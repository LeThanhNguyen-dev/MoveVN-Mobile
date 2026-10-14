export interface BankOption {
  code: string;
  bin: string;
  name: string;
}

/** Danh sách ngân hàng phổ biến (tên gọn cho mobile) kèm BIN NAPAS để chi hộ. */
export const VIETNAM_BANKS: BankOption[] = [
  { code: "VCB", bin: "970436", name: "Vietcombank" },
  { code: "BIDV", bin: "970418", name: "BIDV" },
  { code: "ICB", bin: "970415", name: "VietinBank" },
  { code: "VBA", bin: "970405", name: "Agribank" },
  { code: "MB", bin: "970422", name: "MB Bank" },
  { code: "TCB", bin: "970407", name: "Techcombank" },
  { code: "ACB", bin: "970416", name: "ACB" },
  { code: "VPB", bin: "970432", name: "VPBank" },
  { code: "TPB", bin: "970423", name: "TPBank" },
  { code: "STB", bin: "970403", name: "Sacombank" },
  { code: "HDB", bin: "970437", name: "HDBank" },
  { code: "SHB", bin: "970443", name: "SHB" },
  { code: "VIB", bin: "970441", name: "VIB" },
  { code: "LPB", bin: "970449", name: "LPBank" },
  { code: "MSB", bin: "970426", name: "MSB" },
  { code: "SCB", bin: "970429", name: "SCB" },
  { code: "OCB", bin: "970448", name: "OCB" },
  { code: "SEAB", bin: "970440", name: "SeABank" },
  { code: "KLB", bin: "970452", name: "KienlongBank" },
  { code: "ABB", bin: "970425", name: "ABBANK" },
  { code: "VAB", bin: "970427", name: "VietABank" },
  { code: "NAB", bin: "970428", name: "Nam A Bank" },
  { code: "PVCB", bin: "970412", name: "PVcomBank" },
  { code: "EIB", bin: "970431", name: "Eximbank" },
];
