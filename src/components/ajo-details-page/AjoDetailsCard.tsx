import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle,
  Clock,
  Clock3Icon,
  CreditCard,
  Database,
  RefreshCw,
  Star,
  Users,
  Zap,
} from "lucide-react";

import { useAjoCore } from "@/hooks/useAjoCore";
import useAjoMembers from "@/hooks/useAjoMembers";
import useAjoPayment from "@/hooks/useAjoPayment";
import { useAjoDetailsStore } from "@/store/ajoDetailsStore";
import type { MemberDetail } from "@/store/ajoMembersStore";
import { useAjoStore, type AjoInfo } from "@/store/ajoStore";
import { useMemberStore } from "@/store/memberInfoStore";
import { useTokenStore } from "@/store/tokenStore";
import {
  convertToEvmAddress,
  formatAddress,
  formatTimestamp,
} from "@/utils/utils";

interface AjoDetailsCardProps {
  ajo: AjoInfo | null | undefined;
  member: MemberDetail | null | undefined;
  memberLoading: boolean;
  isVisible?: boolean;
  lastUpdated: Date;
  monthlyPayment: number | null;
}

// Separate component for action buttons
const ActionButton = ({
  onClick,
  loading,
  loadingText,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  loadingText: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
  >
    {loading ? (
      <>
        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
        <span>{loadingText}</span>
      </>
    ) : (
      <>
        <CreditCard className="w-5 h-5" />
        <span>{children}</span>
      </>
    )}
  </button>
);

// Helper function to get ordinal suffix
const getOrdinalSuffix = (num: string) => {
  const n = Number(num);
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
};

const AjoDetailsCard = ({
  ajo,
  isVisible,
  monthlyPayment,
}: AjoDetailsCardProps) => {
  const {
    memberData,
    loading: loadingMember,
    setLoading: setLoadingMember,
  } = useMemberStore();
  const { address: accountId } = useTokenStore();
  const { totalMembers } = useAjoDetailsStore();
  const { ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();

  // Hooks
  const { getAllMembersDetails } = useAjoMembers(ajo?.ajoMembers || "");
  const { getCyclePaymentStatus } = useAjoPayment(ajo?.ajoPayments || "");
  const {
    joinAjo,
    getMemberInfo,
    getRequiredCollateral,
    processPayment,
    distributePayout,
  } = useAjoCore(ajoCore || "");
  const { getPayOut, getCurrentCycle, getCurrentCycleDashboard } =
    useAjoPayment(ajo?.ajoPayments || "");

  // State
  const [loading, setLoading] = useState(false);
  const [makingPayment, setMakingPayment] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [collateralRequired, setCollateralRequired] = useState(0);
  const [paidAddress, setPaidAddress] = useState("");
  const [cycleCount, setCycleCount] = useState(0);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [paidMembers, setPaidMembers] = useState<string[]>([]);

  const cycle = memberData?.memberInfo.queueNumber;

  // Helper function to check payment status
  const hasPaid = useCallback(
    (memberHederaAddress: string) => {
      if (!memberHederaAddress || !paidMembers || paidMembers.length === 0) {
        return false;
      }
      const evmAddress = convertToEvmAddress(memberHederaAddress);
      return paidMembers.some(
        (address) => address.toLowerCase() === evmAddress.toLowerCase()
      );
    },
    [paidMembers]
  );

  // Computed values using useMemo
  const isAjoFull = totalMembers === "10";
  const isActiveMember = memberData?.memberInfo.isActive === true;
  const userHasPaid = hasPaid(accountId);
  const userCycle = Number(cycle);
  const isUserCycleCurrent = cycleCount === userCycle;
  const isUserCyclePast = cycleCount > userCycle;
  const isUserCycleFuture = cycleCount < userCycle;
  const hasReceivedPayout = memberData?.memberInfo.hasReceivedPayout;

  // Determine what action to show
  const actionState = useMemo(() => {
    // Not a member yet
    if (!isActiveMember) {
      if (isAjoFull) {
        return { type: "none" as const };
      }
      return { type: "join" as const };
    }

    // Ajo not full yet
    if (!isAjoFull) {
      return {
        type: "message" as const,
        message: "Total ajo members incomplete for ajo to start",
      };
    }

    // Already paid
    if (userHasPaid) {
      // Check payout eligibility
      if (isUserCyclePast) {
        return {
          type: "message" as const,
          message: "You have been paid for this cycle",
        };
      }

      if (isUserCycleFuture) {
        return {
          type: "message" as const,
          message: `You will be able to request for payout in the ${cycle}${getOrdinalSuffix(
            cycle || "0"
          )} month of this ajo cycle`,
        };
      }

      if (isUserCycleCurrent) {
        if (hasReceivedPayout) {
          return {
            type: "message" as const,
            message: "You have been paid for this cycle",
          };
        }
        return { type: "requestPayout" as const };
      }
    }

    // Haven't paid yet
    return { type: "processPayment" as const };
  }, [
    isActiveMember,
    isAjoFull,
    userHasPaid,
    isUserCyclePast,
    isUserCycleFuture,
    isUserCycleCurrent,
    hasReceivedPayout,
    cycle,
  ]);

  // Data fetching functions
  const getCollateral = useCallback(async () => {
    try {
      const collateral = await getRequiredCollateral(0);
      setCollateralRequired(Number(collateral?.toString()));
    } catch (err) {
      console.error("Error getting collateral:", err);
    }
  }, [getRequiredCollateral]);

  const loadAjoMemberData = useCallback(async () => {
    if (!accountId) return;
    try {
      const member = await getMemberInfo(accountId);
      if (member) setLoadingMember(false);
    } catch (err) {
      console.error("Error loading Ajo member data:", err);
    }
  }, [accountId, getMemberInfo, setLoadingMember]);

  const getPayOutStatus = useCallback(async () => {
    if (!cycle) return;
    try {
      const queueNumber = Number(cycle);
      const PayCycle = await getPayOut(queueNumber);
      setPaidAddress(PayCycle?.recipient);
      const count = await getCurrentCycle();
      if (count) setCycleCount(count);
    } catch (err) {
      console.error("Error getting payout status:", err);
    }
  }, [cycle, getPayOut, getCurrentCycle]);

  const getAllMembers = useCallback(async () => {
    try {
      await getAllMembersDetails();
    } catch (err) {
      console.error("Error fetching members:", err);
    }
  }, [getAllMembersDetails]);

  const cycleDashboard = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const dashboard = await getCurrentCycleDashboard();
      setPaidMembers(dashboard?.membersPaid || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [getCurrentCycleDashboard]);

  const _getCyclePaymentStatus = useCallback(async () => {
    try {
      await getCyclePaymentStatus(cycleCount);
    } catch (err) {
      console.error("Error getting cycle payment status:", err);
    }
  }, [getCyclePaymentStatus, cycleCount]);

  // Effects
  useEffect(() => {
    setLoadingMember(true);
    getCollateral();
    loadAjoMemberData();
    getPayOutStatus();
    cycleDashboard();
    getAllMembers();
  }, [
    accountId,
    loadAjoMemberData,
    getAllMembers,
    setLoadingMember,
    getCollateral,
    getPayOutStatus,
    cycleDashboard,
  ]);

  useEffect(() => {
    if (cycleCount > 0) {
      getAllMembers();
      _getCyclePaymentStatus();
    }
  }, [cycleCount, _getCyclePaymentStatus, getAllMembers]);

  // Action handlers
  const _joinAjo = async () => {
    if (!accountId) {
      toast.error("Wallet address not found");
      return;
    }
    if (!ajo) return;

    try {
      setLoading(true);
      const join = await joinAjo(ajo.ajoCollateral, ajo.ajoPayments, 0);
      toast.success("Collateral Locked and Ajo joined Successfully");
      await getMemberInfo(accountId);
      window.location.reload();
    } catch (err) {
      console.error("Error joining:", err);
      toast.error("Failed to join");
    } finally {
      setLoading(false);
    }
  };

  const _processPayment = async () => {
    if (!ajo) return;
    try {
      setMakingPayment(true);
      toast.info("Processing monthly fee");
      await processPayment(ajo.ajoPayments, 0);
      window.location.reload();
    } catch (err) {
      console.error("Error making monthly payment:", err);
      toast.error("Failed to process payment");
    } finally {
      setMakingPayment(false);
    }
  };

  const _requestPayout = async () => {
    try {
      setRequesting(true);
      toast.info("Requesting payout");
      await distributePayout();
      toast.success(
        "Your cycle payout has been disbursed to your wallet successfully"
      );
      window.location.reload();
    } catch (err) {
      console.error("Error distributing payment:", err);
      toast.error("Failed to request payout");
    } finally {
      setRequesting(false);
    }
  };

  // Render action button based on state
  const renderActionButton = () => {
    if (loadingMember || loadingMembers) {
      return (
        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
      );
    }

    switch (actionState.type) {
      case "join":
        return (
          <ActionButton
            onClick={_joinAjo}
            loading={loading}
            loadingText="Joining Ajo..."
          >
            Join Ajo
          </ActionButton>
        );
      case "processPayment":
        return (
          <ActionButton
            onClick={_processPayment}
            loading={makingPayment}
            loadingText="Processing payment..."
          >
            Process payment
          </ActionButton>
        );
      case "requestPayout":
        return (
          <ActionButton
            onClick={_requestPayout}
            loading={requesting}
            loadingText="Processing payout..."
          >
            Request payout
          </ActionButton>
        );
      case "message":
        return (
          <div className="text-xs flex text-primary">{actionState.message}</div>
        );
      default:
        return null;
    }
  };

  const ajoStatus = isAjoFull ? "active" : "forming";

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
                  {ajo?.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-sm lg:text-xl font-bold text-card-foreground mb-1">
                    {ajo?.name}
                  </h1>
                  <div className="flex items-center space-x-4">
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(
                        ajoStatus
                      )}`}
                    >
                      {getStatusIcon(ajoStatus)}
                      <span className="capitalize">
                        {isAjoFull ? "Active" : "Forming"}
                      </span>
                    </div>
                    <div className="text-xs mx-2">
                      by {formatAddress(ajo?.creator || "")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Action Button */}
              <div className="hidden sm:flex flex-col sm:flex-row gap-3">
                {renderActionButton()}
              </div>
            </div>

            {/* Info Section */}
            {!loadingMember && !loadingMembers && (
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
                      {collateralRequired
                        ? `${collateralRequired} USDC`
                        : "Loading..."}
                    </span>
                  </div>
                )}

                {!userHasPaid && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary font-medium">
                      Monthly Contribution:
                    </span>
                    <span className="ml-4 font-semibold text-primary text-sm">
                      ${monthlyPayment} USDC
                    </span>
                  </div>
                )}

                {/* Collateral Lock Status */}
                <div
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-2 w-fit ${
                    isActiveMember
                      ? "bg-[#111E18] text-[#3DB569]"
                      : "bg-[#211416] text-[#EA4343]"
                  }`}
                >
                  {memberData?.memberInfo.lockedCollateral !== "0" ? (
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

                {/* Monthly Payment Status */}
                <div
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-2 w-fit ${
                    userHasPaid
                      ? "bg-[#111E18] text-[#3DB569]"
                      : "bg-[#211416] text-[#EA4343]"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {userHasPaid
                      ? "Monthly Payment Paid"
                      : "Monthly payment pending"}
                  </span>
                </div>
              </div>
            )}

            {/* Contract Info */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center space-x-2 text-sm">
              <div className="flex items-center">
                <Database className="w-4 h-4 text-primary mx-1" />
                <span className="text-xs text-muted-foreground">
                  Smart Contract:
                </span>
                <span className="font-mono text-primary mx-1">
                  {formatAddress(ajo?.ajoCore || "")}
                </span>
              </div>
              <div className="flex items-center">
                <Clock3Icon className="w-4 h-4 text-primary sm:ml-2 mr-1" />
                <p className="text-xs text-muted-foreground">
                  Created:{" "}
                  <span className="font-mono text-primary">
                    {formatTimestamp(ajo?.createdAt || "")}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Action Button */}
          <div className="flex sm:hidden flex-col gap-3">
            {renderActionButton()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoDetailsCard;

// Helper functions
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
