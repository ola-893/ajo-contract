import { useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  Clock3Icon,
  CreditCard,
  Database,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatAddress } from "@/utils/utils";
import type { StarknetAjoInfo } from "@/hooks/useStarknetAjoFactory";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetErc20 from "@/hooks/useStarknetErc20";
import { TOKEN_ADDRESSES } from "@/config/constants";

interface AjoDetailsCardProps {
  ajo: StarknetAjoInfo | null | undefined;
  member?: any;
  memberLoading?: boolean;
  monthlyPayment?: number | null;
  isVisible: boolean;
  lastUpdated: Date;
  onRefresh?: () => Promise<void> | void;
}

const AjoDetailsCard = ({
  ajo,
  memberLoading = false,
  monthlyPayment = null,
  isVisible,
  lastUpdated,
  onRefresh,
}: AjoDetailsCardProps) => {
  const { address, isConnected } = useStarknetWallet();
  const { joinAjo } = useStarknetAjoCore(ajo?.coreAddress || "");
  const paymentTokenAddress =
    ajo?.config.paymentToken === "USDC"
      ? TOKEN_ADDRESSES.sepolia.USDC.toLowerCase()
      : "";
  const { getAllowance, approve } = useStarknetErc20(paymentTokenAddress);

  const [isAjoFull, setIsAjoFull] = useState(false);
  const [isActiveMember, setIsActiveMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const userHasPaid = false;

  const handleJoinAjo = async () => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to join this Ajo");
      return;
    }

    if (!ajo) {
      toast.error("Ajo details are not loaded");
      return;
    }

    if (isAjoFull) {
      toast.info("Ajo is already full");
      return;
    }

    if (isActiveMember) {
      toast.info("You are already a member");
      return;
    }

    if (!paymentTokenAddress) {
      toast.error("Payment token not configured for this Ajo");
      return;
    }

    if (!ajo.coreAddress || /^0x0+$/i.test(ajo.coreAddress)) {
      toast.error("Ajo core contract is not deployed yet");
      return;
    }

    setIsJoining(true);
    try {
      // Conservative approval amount (covers max expected collateral at early queue positions)
      const approvalAmount =
        ajo.config.monthlyContribution * BigInt(ajo.config.totalParticipants);

      const currentAllowance = await getAllowance(address, ajo.collateralAddress);
      if (currentAllowance < approvalAmount) {
        toast.info("Approving collateral transfer...");
        await approve(ajo.collateralAddress, approvalAmount);
      }

      toast.info("Joining Ajo...");
      await joinAjo(0);

      toast.success("Collateral locked and Ajo joined successfully");
      setIsActiveMember(true);
      await onRefresh?.();
    } catch (error: any) {
      console.error("Join Ajo failed:", error);
      const message = String(error?.message || "");
      if (message.includes("Ajo is full")) {
        setIsAjoFull(true);
      }
      if (message.includes("Already a member")) {
        setIsActiveMember(true);
      }
      toast.error(error?.message || "Failed to join Ajo");
    } finally {
      setIsJoining(false);
    }
  };

  const ajoStatus = isAjoFull ? "active" : "forming";
  const monthlyContributionDisplay =
    monthlyPayment !== null && monthlyPayment !== undefined
      ? `$${monthlyPayment} ${ajo?.config.paymentToken || "USDC"}`
      : "$1 USDC";
  const collateralDisplay = useMemo(() => {
    if (!ajo) return "5.4 USDC";
    const estimatedRequired = estimateRequiredCollateral(
      ajo.config.monthlyContribution,
      ajo.config.totalParticipants,
    );
    if (estimatedRequired <= 0n) return "0";
    const decimals = ajo?.config.paymentToken === "BTC" ? 8 : 6;
    return `${formatTokenAmount(estimatedRequired, decimals)} ${
      ajo?.config.paymentToken || "USDC"
    }`;
  }, [ajo]);

  return (
    <div
      className={`mb-8 transform transition-all duration-1000 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-6 h-6 lg:w-12 lg:h-12 bg-gradient-to-br p-4 from-primary to-accent rounded-xl flex items-center justify-center text-sm lg:text-xl font-bold text-primary-foreground">
                  {ajo?.config?.name?.charAt(0) || "A"}
                </div>
                <div>
                  <h1 className="text-sm lg:text-xl font-bold text-card-foreground mb-1">
                    {ajo?.config?.name || `Ajo #${ajo?.id || ""}`}
                  </h1>
                  <div className="flex items-center space-x-4">
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(
                        ajoStatus,
                      )}`}
                    >
                      {getStatusIcon(ajoStatus)}
                      <span className="capitalize">
                        {isAjoFull ? "Active" : "Forming"}
                      </span>
                    </div>
                    <div className="text-xs mx-2">
                      by {formatAddress(ajo?.config?.creator || "")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleJoinAjo}
                  disabled={
                    memberLoading ||
                    isAjoFull ||
                    isJoining ||
                    !isConnected
                  }
                  className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>
                    {isJoining
                      ? "Joining..."
                      : isAjoFull
                        ? "Ajo Full"
                        : isActiveMember
                          ? "Joined"
                          : "Join Ajo"}
                  </span>
                </button>
              </div>
            </div>

            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex flex-col space-y-3 sm:w-50%">
              {isAjoFull && (
                <div className="mb-6 p-4 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg">
                  Not taking in members
                </div>
              )}

              {!isActiveMember && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary font-medium">
                    Collateral Required:
                  </span>
                  <span className="ml-4 font-semibold text-primary text-sm">
                    {collateralDisplay}
                  </span>
                </div>
              )}

              {!userHasPaid && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary font-medium">
                    Monthly Contribution:
                  </span>
                  <span className="ml-4 font-semibold text-primary text-sm">
                    {monthlyContributionDisplay}
                  </span>
                </div>
              )}

              <div className="px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-2 w-fit bg-[#211416] text-[#EA4343]">
                {isActiveMember ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Collateral Locked</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Collateral Not Locked</span>
                  </>
                )}
              </div>

              <div className="px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-2 w-fit bg-[#211416] text-[#EA4343]">
                <CreditCard className="w-4 h-4" />
                <span>Monthly payment pending</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center space-x-2 text-sm">
              <div className="flex items-center">
                <Database className="w-4 h-4 text-primary mx-1" />
                <span className="text-xs text-muted-foreground">
                  Smart Contract:
                </span>
                <span className="font-mono text-primary mx-1">
                  {formatAddress(ajo?.coreAddress || "")}
                </span>
              </div>
              <div className="flex items-center">
                <Clock3Icon className="w-4 h-4 text-primary sm:ml-2 mr-1" />
                <p className="text-xs text-muted-foreground">
                  Created:{" "}
                  <span className="font-mono text-primary">
                    {new Date((ajo?.createdAt || 0) * 1000).toLocaleString()}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex sm:hidden flex-col gap-3">
            <button
              onClick={handleJoinAjo}
              disabled={
                memberLoading ||
                isAjoFull ||
                isJoining ||
                !isConnected
              }
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CreditCard className="w-5 h-5" />
              <span>
                {isJoining
                  ? "Joining..."
                  : isAjoFull
                    ? "Ajo Full"
                    : isActiveMember
                      ? "Joined"
                      : "Join Ajo"}
              </span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onRefresh?.()}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <span className="ml-3 text-xs text-muted-foreground self-center">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AjoDetailsCard;

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <Zap className="w-4 h-4" />;
    case "forming":
      return <Users className="w-4 h-4" />;
    case "completed":
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-600 text-white border border-green-500";
    case "forming":
      return "bg-accent/20 text-accent border border-accent/30";
    case "completed":
      return "bg-secondary/20 text-secondary-foreground border border-secondary/30";
    default:
      return "bg-muted/20 text-muted-foreground border border-muted/30";
  }
};

const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "")
    .slice(0, 4);
  return `${whole.toString()}.${fractionText}`;
};

const estimateRequiredCollateral = (
  monthlyContribution: bigint,
  totalParticipants: number,
): bigint => {
  if (totalParticipants <= 1) return 0n;
  const maxDebt = monthlyContribution * BigInt(totalParticipants - 1);
  return (maxDebt * 60n) / 100n;
};
