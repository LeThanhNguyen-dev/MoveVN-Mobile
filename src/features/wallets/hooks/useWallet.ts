import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import { showToast } from "@/features/notifications/toastStore";
import i18n from "@/i18n";
import {
  cancelWithdrawal,
  createWithdrawal,
  getBankAccountDetails,
  getMyTransactions,
  getMyWallet,
  getMyWithdrawals,
  requestBankAccountOtp,
  verifyBankAccountOtp,
} from "@/features/wallets/services/walletService";
import type {
  OwnerBankDetailsDto,
  WalletDto,
  WalletTransactionDto,
  WithdrawalRequestDto,
} from "@/features/wallets/types";
import { VIETNAM_BANKS } from "@/features/wallets/data/banks";
import {
  cancelPaymentLink,
  checkPaymentStatus,
  createTopUpPaymentLink,
} from "@/features/payments/services/paymentService";
import type { PayOsSheetData } from "@/features/payments/components/PayOsQrSheet";
import { getApiErrorMessage } from "@/services/apiClient";

export const TX_PAGE_SIZE = 15;
export const WD_PAGE_SIZE = 10;

// Giữ đồng bộ với backend (không gọi BE, chỉ mirror để validate sớm phía client):
// - PaymentService.CreateTopUpPaymentLinkAsync: nạp 5.000đ–100.000.000đ
// - WithdrawalService.CreateAsync (SystemConfig withdrawal_min/max_amount, default): rút 5.000đ–100.000.000đ
export const TOPUP_MIN_AMOUNT = 5_000;
export const TOPUP_MAX_AMOUNT = 100_000_000;
export const WITHDRAW_MIN_AMOUNT = 5_000;
export const WITHDRAW_MAX_AMOUNT = 100_000_000;

// Trạng thái rút tiền đang giữ tiền (backend WithdrawalService.CreateAsync từ chối tạo mới khi còn các trạng thái này).
export const ACTIVE_WITHDRAWAL_STATUSES = ["Pending", "Approved", "NeedsManualReview"];

export function isActiveWithdrawalStatus(status: string) {
  return ACTIVE_WITHDRAWAL_STATUSES.includes(status);
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txType, setTxType] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestDto[]>([]);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotal, setWdTotal] = useState(0);
  const [bank, setBank] = useState<OwnerBankDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreWd, setLoadingMoreWd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankStep, setBankStep] = useState<"info" | "otp">("info");
  const [bankName, setBankName] = useState("");
  const [bankBin, setBankBin] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [bankOtp, setBankOtp] = useState("");
  const [paySheet, setPaySheet] = useState<PayOsSheetData | null>(null);
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
  const pendingOrderCodeRef = useRef<number | null>(null);
  useEffect(() => {
    pendingOrderCodeRef.current = pendingOrderCode;
  }, [pendingOrderCode]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const [w, tx, wd, bankInfo] = await Promise.all([
        getMyWallet(),
        getMyTransactions({ page: 1, pageSize: TX_PAGE_SIZE, type: txType ?? undefined }),
        getMyWithdrawals({ page: 1, pageSize: WD_PAGE_SIZE }),
        getBankAccountDetails().catch(() => null),
      ]);
      setWallet(w);
      setTransactions(tx.items);
      setTxPage(tx.page);
      setTxTotal(tx.totalCount);
      setWithdrawals(wd.items);
      setWdPage(wd.page);
      setWdTotal(wd.totalCount);
      setBank(bankInfo);
    } catch (err) {
      showAppAlert(
        i18n.t("accountWallet:toasts.errorTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.errors.loadWallet")),
      );
    } finally {
      setLoading(false);
    }
  }, [txType]);

  // Đổi bộ lọc loại giao dịch (lọc server-side qua ?type=): reset về trang 1.
  const setTxTypeFilter = useCallback(
    async (type: string | null) => {
      if (type === txType) return;
      setTxType(type);
      setLoadingMore(true);
      try {
        const tx = await getMyTransactions({ page: 1, pageSize: TX_PAGE_SIZE, type: type ?? undefined });
        setTransactions(tx.items);
        setTxPage(tx.page);
        setTxTotal(tx.totalCount);
      } catch (err) {
        showAppAlert(
          i18n.t("accountWallet:toasts.errorTitle"),
          getApiErrorMessage(err, i18n.t("mobile:wallet.errors.loadHistory")),
        );
      } finally {
        setLoadingMore(false);
      }
    },
    [txType]
  );

  // Yêu cầu rút tiền đang giữ tiền (nếu có) — dùng để chặn tạo mới sớm phía client.
  const activeWithdrawal = withdrawals.find((w) => isActiveWithdrawalStatus(w.status)) ?? null;

  useEffect(() => {
    void reload();
    // Chỉ tải 1 lần khi mở ví; đổi bộ lọc dùng setTxTypeFilter để tránh fetch trùng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // Poll xác nhận nạp ví: PayOS đối soát chuyển khoản VietQR có thể mất vài phút,
  // nên poll liên tục tới khi có kết quả cuối (link tự Expired sau 30 phút).
  const pollTopUp = useCallback(
    (orderCode: number, attempt = 1) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(async () => {
        try {
          const res = await checkPaymentStatus(orderCode);
          if (res.isConfirmed) {
            setPendingOrderCode(null);
            setPaySheet(null);
            showAppAlert(
              i18n.t("accountWallet:toasts.successTitle"),
              i18n.t("mobile:wallet.alerts.topUpDone"),
            );
            await reload();
            return;
          }
          if (["Cancelled", "Expired", "Failed"].includes(res.status)) {
            setPendingOrderCode(null);
            setPaySheet(null);
            showAppAlert(
              i18n.t("mobile:wallet.alerts.noticeTitle"),
              res.message || i18n.t("mobile:wallet.alerts.paymentEnded"),
            );
            await reload();
            return;
          }
        } catch {
          // Thử lại.
        }
        // Đọc ref để không kẹt closure cũ khi sheet đã đóng.
        if (pendingOrderCodeRef.current !== null) {
          pollTopUp(orderCode, attempt + 1);
        }
      }, attempt <= 10 ? 3000 : 10000);
    },
    [reload]
  );

  const dismissPaySheet = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pendingOrderCodeRef.current = null;
    setPendingOrderCode(null);
    setPaySheet(null);
  }, []);

  // Lỗi hủy thì ném ra để sheet hiện chữ ngay trong Modal; thành công mới đóng
  // sheet rồi báo toast (toast/alert nằm ngoài Modal nên phải đóng trước mới thấy).
  const cancelPaySheet = useCallback(async () => {
    const orderCode = paySheet?.orderCode;
    if (!orderCode) {
      dismissPaySheet();
      return;
    }
    const res = await cancelPaymentLink(orderCode);
    dismissPaySheet();
    showToast({
      type: "success",
      title: i18n.t("mobile:wallet.alerts.noticeTitle"),
      message: res.message || i18n.t("mobile:wallet.payment.cancelPaymentDone"),
    });
    void reload();
  }, [paySheet, dismissPaySheet, reload]);

  useEffect(() => {
    if (pendingOrderCode == null) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") pollTopUp(pendingOrderCode);
    });
    return () => sub.remove();
  }, [pendingOrderCode, pollTopUp]);

  async function handleTopUp(onSuccess?: () => void) {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.invalidAmountTitle"),
        i18n.t("mobile:wallet.alerts.topUpAmountRequired"),
      );
      return;
    }
    if (amount < TOPUP_MIN_AMOUNT) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.amountTooSmallTitle"),
        i18n.t("mobile:wallet.alerts.topUpMin", {
          amount: TOPUP_MIN_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return;
    }
    if (amount > TOPUP_MAX_AMOUNT) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.amountTooLargeTitle"),
        i18n.t("mobile:wallet.alerts.topUpMax", {
          amount: TOPUP_MAX_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return;
    }
    if (busy) return;
    setBusy("topup");
    try {
      const link = await createTopUpPaymentLink(Math.round(amount));
      setTopUpAmount("");
      setPendingOrderCode(link.orderCode);
      pollTopUp(link.orderCode);
      if (link.checkoutUrl) {
        setPaySheet({
          checkoutUrl: link.checkoutUrl,
          qrCode: link.qrCode,
          orderCode: link.orderCode,
          amount: link.amount,
          bin: link.bin,
          accountNumber: link.accountNumber,
          accountName: link.accountName,
          expiredAt: link.expiredAt,
          title: i18n.t("mobile:wallet.payment.topUpTitle"),
        });
      }
      onSuccess?.();
    } catch (err) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.topUpCreateFailed")),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.invalidAmountTitle"),
        i18n.t("mobile:wallet.alerts.withdrawAmountRequired"),
      );
      return false;
    }
    if (amount < WITHDRAW_MIN_AMOUNT) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.amountTooSmallTitle"),
        i18n.t("mobile:wallet.alerts.withdrawMin", {
          amount: WITHDRAW_MIN_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (amount > WITHDRAW_MAX_AMOUNT) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.amountTooLargeTitle"),
        i18n.t("mobile:wallet.alerts.withdrawMax", {
          amount: WITHDRAW_MAX_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (!bank?.bankAccountNumber) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.noPayoutAccountTitle"),
        i18n.t("mobile:wallet.alerts.noPayoutAccountMessage"),
      );
      return false;
    }
    if (wallet && amount > wallet.balance) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.insufficientTitle"),
        i18n.t("mobile:wallet.alerts.insufficientMessage", {
          balance: wallet.balance.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (activeWithdrawal) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.pendingRequestTitle"),
        i18n.t("mobile:wallet.alerts.pendingRequestMessage", { id: activeWithdrawal.id }),
      );
      return false;
    }
    if (busy) return false;
    setBusy("withdraw");
    try {
      await createWithdrawal(Math.round(amount));
      setWithdrawAmount("");
      showAppAlert(
        i18n.t("accountWallet:toasts.successTitle"),
        i18n.t("mobile:wallet.alerts.withdrawCreated"),
      );
      await reload();
      return true;
    } catch (err) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.withdrawCreateFailed")),
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelWithdrawal(id: number) {
    showAppAlert(
      i18n.t("mobile:wallet.alerts.cancelRequestTitle"),
      i18n.t("mobile:wallet.alerts.cancelRequestBody"),
      [
        { text: i18n.t("mobile:wallet.alerts.keep"), style: "cancel" },
        {
          text: i18n.t("mobile:wallet.alerts.confirmCancel"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await cancelWithdrawal(id);
                await reload();
              } catch (err) {
                showAppAlert(
                  i18n.t("mobile:wallet.alerts.failedTitle"),
                  getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.cancelRequestFailed")),
                );
              }
            })();
          },
        },
      ],
    );
  }

  function openBankSetup() {
    setBankName(bank?.bankName ?? "");
    setBankBin(bank?.bankBin ?? "");
    setAccountNumber(bank?.bankAccountNumber ?? "");
    setHolderName(bank?.bankAccountHolderName ?? "");
    setBankOtp("");
    setBankStep("info");
  }

  async function handleRequestBankOtp(onSent?: () => void) {
    if (!bankName.trim() || !accountNumber.trim() || !holderName.trim()) {
      showAppAlert(
        i18n.t("accountVerification:bank.toastMissingInfoTitle"),
        i18n.t("mobile:wallet.alerts.bankMissingInfo"),
      );
      return;
    }
    if (busy) return;
    setBusy("bankOtp");
    try {
      await requestBankAccountOtp();
      setBankStep("otp");
      showAppAlert(
        i18n.t("mobile:wallet.alerts.otpSentTitle"),
        i18n.t("mobile:wallet.alerts.otpSentMessage"),
      );
      onSent?.();
    } catch (err) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.otpSendFailed")),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveBank() {
    if (bankOtp.trim().length < 6) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.missingOtpTitle"),
        i18n.t("mobile:wallet.alerts.otpRequired"),
      );
      return false;
    }
    if (busy) return false;
    setBusy("bankSave");
    try {
      const picked = VIETNAM_BANKS.find((b) => b.name === bankName.trim());
      await verifyBankAccountOtp({
        otp: bankOtp.trim(),
        bankAccountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
        bankAccountHolderName: holderName.trim(),
        bankBin: bankBin || picked?.bin,
      });
      showAppAlert(
        i18n.t("accountWallet:toasts.successTitle"),
        i18n.t("mobile:wallet.alerts.bankSaved"),
      );
      await reload();
      return true;
    } catch (err) {
      showAppAlert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.bankSaveFailed")),
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function loadMoreTx() {
    if (loadingMore || transactions.length >= txTotal) return;
    setLoadingMore(true);
    try {
      const res = await getMyTransactions({ page: txPage + 1, pageSize: TX_PAGE_SIZE, type: txType ?? undefined });
      setTransactions((prev) => [...prev, ...res.items.filter((t) => !prev.some((p) => p.id === t.id))]);
      setTxPage(res.page);
      setTxTotal(res.totalCount);
    } catch {
      // Bỏ qua lỗi tải thêm.
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadMoreWd() {
    if (loadingMoreWd || withdrawals.length >= wdTotal) return;
    setLoadingMoreWd(true);
    try {
      const res = await getMyWithdrawals({ page: wdPage + 1, pageSize: WD_PAGE_SIZE });
      setWithdrawals((prev) => [...prev, ...res.items.filter((w) => !prev.some((p) => p.id === w.id))]);
      setWdPage(res.page);
      setWdTotal(res.totalCount);
    } catch {
      // Bỏ qua lỗi tải thêm.
    } finally {
      setLoadingMoreWd(false);
    }
  }

  return {
    wallet,
    transactions,
    txPage,
    txTotal,
    txType,
    setTxTypeFilter,
    withdrawals,
    wdPage,
    wdTotal,
    activeWithdrawal,
    bank,
    loading,
    loadingMore,
    loadingMoreWd,
    busy,
    topUpAmount,
    setTopUpAmount,
    withdrawAmount,
    setWithdrawAmount,
    bankStep,
    setBankStep,
    bankName,
    setBankName,
    bankBin,
    setBankBin,
    accountNumber,
    setAccountNumber,
    holderName,
    setHolderName,
    bankOtp,
    setBankOtp,
    paySheet,
    dismissPaySheet,
    cancelPaySheet,
    pendingOrderCode,
    pollTopUp,
    reload,
    loadMoreTx,
    loadMoreWd,
    handleTopUp,
    handleWithdraw,
    handleCancelWithdrawal,
    openBankSetup,
    handleRequestBankOtp,
    handleSaveBank,
  };
}

export type WalletState = ReturnType<typeof useWallet>;
