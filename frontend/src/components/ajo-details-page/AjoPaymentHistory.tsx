/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  History,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import useStarknetAjoPayments from "@/hooks/useStarknetAjoPayments";
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetErc20 from "@/hooks/useStarknetErc20";
import { TOKEN_ADDRESSES } from "@/config/constants";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { formatAddress } from "@/utils/utils";

const normalizeAddress = (addr: string) => addr.toLowerCase().trim();

const formatTokenAmount = (value: bigint, decimals: number) => {
  if (value === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}.${fractionStr}`;
};

const AjoPaymentHistory = ({ ajo }: { ajo: any }) => {
  const { address, isConnected } = useStarknetWallet();
  const paymentsAddress = ajo?.paymentsAddress || "";
  const coreAddress = ajo?.coreAddress || "";
  const tokenSymbol = ajo?.config?.paymentToken || "USDC";
  const tokenDecimals = tokenSymbol === "BTC" ? 8 : 6;
  const monthlyContributionRaw = BigInt(ajo?.config?.monthlyContribution ?? 0);
  const totalParticipants = BigInt(
    Math.max(1, Number(ajo?.config?.totalParticipants ?? 1)),
  );
  const expectedCycleAmount = monthlyContributionRaw * totalParticipants;
  const defaultPaymentTokenAddress =
    tokenSymbol === "BTC"
      ? (TOKEN_ADDRESSES.sepolia.BTC || "").toLowerCase()
      : TOKEN_ADDRESSES.sepolia.USDC.toLowerCase();
  const [paymentTokenAddress, setPaymentTokenAddress] = useState(
    defaultPaymentTokenAddress,
  );
  const {
    processPayment,
    getPaymentTokenConfig,
    loading: coreLoading,
  } = useStarknetAjoCore(coreAddress);
  const {
    getAllowance,
    approve,
    loading: approvalLoading,
  } = useStarknetErc20(paymentTokenAddress);

  const {
    getCurrentCycle,
    getCycleStartTime,
    getNextPayoutPosition,
    hasPaidForCycle,
    getTotalPaid,
    getCycleContributions,
    getPayoutRecipient,
    calculatePayoutAmount,
    loading: paymentsLoading,
  } = useStarknetAjoPayments(paymentsAddress);

  const [loadingData, setLoadingData] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [cycleStartTime, setCycleStartTime] = useState(0);
  const [nextPayoutPosition, setNextPayoutPosition] = useState(1);
  const [cycleContributions, setCycleContributions] = useState<bigint>(0n);
  const [payoutAmount, setPayoutAmount] = useState<bigint>(0n);
  const [payoutRecipient, setPayoutRecipient] = useState("0x0");
  const [hasPaidCurrentCycle, setHasPaidCurrentCycle] = useState(false);
  const [hasReceivedCurrentPayout, setHasReceivedCurrentPayout] = useState(false);
  const [totalPaid, setTotalPaid] = useState<bigint>(0n);

  const isZeroAddress = (value?: string | null) =>
    !value || /^0x0+$/i.test(value);

  useEffect(() => {
    let cancelled = false;

    const loadPaymentTokenAddress = async () => {
      if (!coreAddress || isZeroAddress(coreAddress)) {
        if (!cancelled) {
          setPaymentTokenAddress(defaultPaymentTokenAddress);
        }
        return;
      }

      try {
        const tokenConfig = await getPaymentTokenConfig();
        const onchainTokenAddress =
          tokenConfig?.tokenAddress && !isZeroAddress(tokenConfig.tokenAddress)
            ? String(tokenConfig.tokenAddress).toLowerCase()
            : "";

        if (!cancelled) {
          setPaymentTokenAddress(
            onchainTokenAddress || defaultPaymentTokenAddress,
          );
        }
      } catch {
        if (!cancelled) {
          setPaymentTokenAddress(defaultPaymentTokenAddress);
        }
      }
    };

    loadPaymentTokenAddress();

    return () => {
      cancelled = true;
    };
  }, [coreAddress, defaultPaymentTokenAddress, getPaymentTokenConfig]);

  const refreshPayments = useCallback(async () => {
    if (!paymentsAddress || /^0x0+$/i.test(paymentsAddress)) return;

    setLoadingData(true);
    try {
      const cycle = await getCurrentCycle();
      setCurrentCycle(cycle || 1);

      const [startTime, payoutPos, contributions, payout, recipient] =
        await Promise.all([
          getCycleStartTime().catch(() => 0),
          getNextPayoutPosition().catch(() => 1),
          getCycleContributions(cycle || 1).catch(() => 0n),
          calculatePayoutAmount(cycle || 1).catch(() => 0n),
          getPayoutRecipient(cycle || 1).catch(() => "0x0"),
        ]);

      setCycleStartTime(startTime);
      setNextPayoutPosition(payoutPos);
      setCycleContributions(contributions);
      setPayoutAmount(payout);
      setPayoutRecipient(recipient);

      if (address) {
        const [paidThisCycle, total] = await Promise.all([
          hasPaidForCycle(address, cycle || 1).catch(() => false),
          getTotalPaid(address).catch(() => 0n),
        ]);
        setHasPaidCurrentCycle(paidThisCycle);
        setTotalPaid(total);
        // Check if current user is the payout recipient and payout is complete
        setHasReceivedCurrentPayout(
          normalizeAddress(address) === normalizeAddress(recipient) &&
          isPayoutPoolComplete
        );
      } else {
        setHasReceivedCurrentPayout(false);
      }
    } catch (error) {
      console.error("Failed to refresh payments:", error);
      toast.error("Failed to load payment data");
    } finally {
      setLoadingData(false);
    }
  }, [
    paymentsAddress,
    getCurrentCycle,
    getCycleStartTime,
    getNextPayoutPosition,
    getCycleContributions,
    calculatePayoutAmount,
    getPayoutRecipient,
    address,
    hasPaidForCycle,
    getTotalPaid,
  ]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const handlePayCurrentCycle = async () => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to make payment");
      return;
    }
    if (!coreAddress || /^0x0+$/i.test(coreAddress)) {
      toast.error("Ajo core contract not available");
      return;
    }
    if (!paymentsAddress || isZeroAddress(paymentsAddress)) {
      toast.error("Ajo payments contract not available");
      return;
    }
    if (!paymentTokenAddress || isZeroAddress(paymentTokenAddress)) {
      toast.error("Payment token not configured for this Ajo");
      return;
    }

    try {
      const currentAllowance = await getAllowance(address, paymentsAddress);
      if (currentAllowance < monthlyContributionRaw) {
        const totalParticipants = BigInt(
          Math.max(1, Number(ajo?.config?.totalParticipants ?? 1)),
        );
        const approvalAmount = monthlyContributionRaw * totalParticipants;
        toast.info("Approving payment token...");
        await approve(paymentsAddress, approvalAmount);
      }

      await processPayment();
      toast.success("Payment submitted");
      await refreshPayments();
    } catch (error: any) {
      console.error("Payment failed:", error);
      toast.error(error?.message || "Payment failed");
    }
  };

  const isCurrentRecipient =
    !!address &&
    normalizeAddress(address) === normalizeAddress(payoutRecipient) &&
    !isZeroAddress(payoutRecipient);
  const isPayoutPoolComplete =
    expectedCycleAmount > 0n && cycleContributions >= expectedCycleAmount;

  const handleReceivePayoutClick = async () => {
    if (!isCurrentRecipient) return;
    if (hasReceivedCurrentPayout) {
      toast.info('You have already received your payout.');
      return;
    }
    if (!isPayoutPoolComplete) {
      toast.info('Payout unlocks after all members complete this cycle payment.');
      return;
    }

    // Payout is distributed automatically by the protocol when funding is complete.
    toast.success('Payout is ready. Refreshing latest status...');
    await refreshPayments();
  };

  const successRate = useMemo(() => {
    const expected =
      monthlyContributionRaw * BigInt(ajo?.config?.totalParticipants ?? 0);
    if (expected === 0n) return 0;
    return Number((cycleContributions * 100n) / expected);
  }, [
    cycleContributions,
    monthlyContributionRaw,
    ajo?.config?.totalParticipants,
  ]);

  if (!paymentsAddress || /^0x0+$/i.test(paymentsAddress)) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Payments contract not initialized yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-card-foreground flex items-center space-x-2">
            <History className="w-6 h-6 text-accent" />
            <span>Payment History</span>
          </h3>
          <button
            onClick={refreshPayments}
            className="px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm flex items-center gap-2"
            disabled={loadingData}
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border rounded-lg p-4 bg-background/20">
            <p className="text-xs text-muted-foreground">Current Cycle</p>
            <p className="text-lg font-semibold text-card-foreground mt-1">
              {currentCycle}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Started:{" "}
              {cycleStartTime > 0
                ? new Date(cycleStartTime * 1000).toLocaleString()
                : "N/A"}
            </p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-background/20">
            <p className="text-xs text-muted-foreground">Next Payout</p>
            <p className="text-lg font-semibold text-card-foreground mt-1">
              Position #{nextPayoutPosition}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Recipient: {formatAddress(payoutRecipient)}
            </p>
          </div>
        </div>

        <div className="mt-5 border border-border rounded-lg p-4 bg-background/20">
          <h4 className="font-semibold text-card-foreground mb-3">Actions</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePayCurrentCycle}
              disabled={
                coreLoading ||
                paymentsLoading ||
                approvalLoading ||
                loadingData ||
                hasPaidCurrentCycle
              }
              className="px-3 py-2 rounded-md text-xs border border-primary text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              {hasPaidCurrentCycle
                ? "Paid This Cycle"
                : `Pay ${formatTokenAmount(monthlyContributionRaw, tokenDecimals)} ${tokenSymbol}`}
            </button>
            {isCurrentRecipient && (
              <button
                onClick={handleReceivePayoutClick}
                disabled={
                  loadingData ||
                  coreLoading ||
                  paymentsLoading ||
                  hasReceivedCurrentPayout ||
                  !isPayoutPoolComplete
                }
                className='px-3 py-2 rounded-md text-xs border border-accent text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed'
                title={
                  hasReceivedCurrentPayout
                    ? 'Payout already received'
                    : !isPayoutPoolComplete
                      ? 'Waiting for full cycle funding'
                      : 'Receive payout'
                }
              >
                {hasReceivedCurrentPayout
                  ? 'Payout Received'
                  : !isPayoutPoolComplete
                    ? 'Receive Payout (Awaiting Full Funding)'
                    : 'Receive Payout'}
              </button>
            )}
          </div>
          {address && !isCurrentRecipient && !isZeroAddress(payoutRecipient) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Not your turn yet. Current payout recipient: {formatAddress(payoutRecipient)}.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Cycle Contributions
            </h4>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {formatTokenAmount(cycleContributions, tokenDecimals)} {tokenSymbol}
          </div>
          <div className="text-sm text-muted-foreground">
            Current cycle inflow
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Payout Amount
            </h4>
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="text-2xl font-bold text-card-foreground">
            {formatTokenAmount(payoutAmount, tokenDecimals)} {tokenSymbol}
          </div>
          <div className="text-sm text-muted-foreground">
            Expected distribution
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Your Total Paid
            </h4>
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-green-500">
            {formatTokenAmount(totalPaid, tokenDecimals)} {tokenSymbol}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Cycle success rate: {Math.max(0, Math.min(100, successRate))}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoPaymentHistory;
