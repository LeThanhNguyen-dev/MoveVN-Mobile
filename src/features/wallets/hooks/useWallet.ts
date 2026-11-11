import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
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
  checkPaymentStatus,
  createTopUpPaymentLink,
} from "@/features/payments/services/paymentService";
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
  const [paySheet, setPaySheet] = useState<{ checkoutUrl: string; orderCode: number } | null>(null);
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
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
      Alert.alert(
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
        Alert.alert(
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

  const pollTopUp = useCallback(
    (orderCode: number, attempt = 1) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = setTimeout(async () => {
        try {
          const res = await checkPaymentStatus(orderCode);
          if (res.isConfirmed) {
            setPendingOrderCode(null);
            Alert.alert(
              i18n.t("accountWallet:toasts.successTitle"),
              i18n.t("mobile:wallet.alerts.topUpDone"),
            );
            await reload();
            return;
          }
          if (["Cancelled", "Expired", "Failed"].includes(res.status)) {
            setPendingOrderCode(null);
            Alert.alert(
              i18n.t("mobile:wallet.alerts.noticeTitle"),
              res.message || i18n.t("mobile:wallet.alerts.paymentEnded"),
            );
            await reload();
            return;
          }
        } catch {
          // Thử lại.
        }
        if (attempt < 10) {
          pollTopUp(orderCode, attempt + 1);
        } else {
          setPendingOrderCode(null);
          Alert.alert(
            i18n.t("mobile:wallet.alerts.timeoutTitle"),
            i18n.t("mobile:wallet.alerts.checkBalanceHint"),
          );
          await reload();
        }
      }, 3000);
    },
    [reload]
  );

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
      Alert.alert(
        i18n.t("mobile:wallet.alerts.invalidAmountTitle"),
        i18n.t("mobile:wallet.alerts.topUpAmountRequired"),
      );
      return;
    }
    if (amount < TOPUP_MIN_AMOUNT) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.amountTooSmallTitle"),
        i18n.t("mobile:wallet.alerts.topUpMin", {
          amount: TOPUP_MIN_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return;
    }
    if (amount > TOPUP_MAX_AMOUNT) {
      Alert.alert(
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
      setPaySheet({ checkoutUrl: link.checkoutUrl, orderCode: link.orderCode });
      setPendingOrderCode(link.orderCode);
      pollTopUp(link.orderCode);
      onSuccess?.();
    } catch (err) {
      Alert.alert(
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
      Alert.alert(
        i18n.t("mobile:wallet.alerts.invalidAmountTitle"),
        i18n.t("mobile:wallet.alerts.withdrawAmountRequired"),
      );
      return false;
    }
    if (amount < WITHDRAW_MIN_AMOUNT) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.amountTooSmallTitle"),
        i18n.t("mobile:wallet.alerts.withdrawMin", {
          amount: WITHDRAW_MIN_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (amount > WITHDRAW_MAX_AMOUNT) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.amountTooLargeTitle"),
        i18n.t("mobile:wallet.alerts.withdrawMax", {
          amount: WITHDRAW_MAX_AMOUNT.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (!bank?.bankAccountNumber) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.noPayoutAccountTitle"),
        i18n.t("mobile:wallet.alerts.noPayoutAccountMessage"),
      );
      return false;
    }
    if (wallet && amount > wallet.balance) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.insufficientTitle"),
        i18n.t("mobile:wallet.alerts.insufficientMessage", {
          balance: wallet.balance.toLocaleString("vi-VN"),
        }),
      );
      return false;
    }
    if (activeWithdrawal) {
      Alert.alert(
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
      Alert.alert(
        i18n.t("accountWallet:toasts.successTitle"),
        i18n.t("mobile:wallet.alerts.withdrawCreated"),
      );
      await reload();
      return true;
    } catch (err) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.withdrawCreateFailed")),
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelWithdrawal(id: number) {
    Alert.alert(
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
                Alert.alert(
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
      Alert.alert(
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
      Alert.alert(
        i18n.t("mobile:wallet.alerts.otpSentTitle"),
        i18n.t("mobile:wallet.alerts.otpSentMessage"),
      );
      onSent?.();
    } catch (err) {
      Alert.alert(
        i18n.t("mobile:wallet.alerts.failedTitle"),
        getApiErrorMessage(err, i18n.t("mobile:wallet.alerts.otpSendFailed")),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveBank() {
    if (bankOtp.trim().length < 6) {
      Alert.alert(
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
      Alert.alert(
        i18n.t("accountWallet:toasts.successTitle"),
        i18n.t("mobile:wallet.alerts.bankSaved"),
      );
      await reload();
      return true;
    } catch (err) {
      Alert.alert(
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
    setPaySheet,
    pendingOrderCode,
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
