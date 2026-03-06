/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Shield, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoMembers, {
  type StarknetMember,
} from "@/hooks/useStarknetAjoMembers";
import useStarknetAjoPayments from "@/hooks/useStarknetAjoPayments";
import { formatAddress } from "@/utils/utils";

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

const statusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "Defaulted":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "Completed":
      return "bg-primary/15 text-primary border-primary/30";
    case "Removed":
      return "bg-muted/25 text-muted-foreground border-border";
    default:
      return "bg-muted/25 text-muted-foreground border-border";
  }
};

const AjoMembers = ({
  ajo,
  currentCycle = 1,
}: {
  ajo: any;
  currentCycle?: number;
}) => {
  const { address } = useStarknetWallet();
  const membersAddress = ajo?.membersAddress || "";
  const paymentsAddress = ajo?.paymentsAddress || "";
  const tokenDecimals = ajo?.config?.paymentToken === "BTC" ? 8 : 6;

  const {
    getAllMembers,
    getTotalMembers,
    isMember,
    getGuarantor,
    loading: membersLoading,
  } = useStarknetAjoMembers(membersAddress);

  const { hasPaidForCycle } = useStarknetAjoPayments(paymentsAddress);

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<StarknetMember[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isCurrentUserMember, setIsCurrentUserMember] = useState(false);
  const [currentUserGuarantor, setCurrentUserGuarantor] = useState("0x0");
  const [paymentStatusByAddress, setPaymentStatusByAddress] = useState<
    Record<string, boolean>
  >({});

  const refreshMembers = useCallback(async () => {
    if (!membersAddress || /^0x0+$/i.test(membersAddress)) {
      return;
    }

    setLoadingMembers(true);
    try {
      const [total, memberList] = await Promise.all([
        getTotalMembers(),
        getAllMembers(),
      ]);

      setTotalMembers(total);
      setMembers(memberList);

      if (address) {
        const memberFlag = await isMember(address);
        setIsCurrentUserMember(memberFlag);

        if (memberFlag) {
          try {
            const guarantor = await getGuarantor(address);
            setCurrentUserGuarantor(guarantor);
          } catch {
            setCurrentUserGuarantor("0x0");
          }
        } else {
          setCurrentUserGuarantor("0x0");
        }
      }

      if (currentCycle > 0 && memberList.length > 0 && paymentsAddress) {
        const statuses = await Promise.all(
          memberList.map(async (member) => {
            try {
              const paid = await hasPaidForCycle(member.address, currentCycle);
              return [member.address.toLowerCase(), paid] as const;
            } catch {
              return [member.address.toLowerCase(), false] as const;
            }
          }),
        );

        setPaymentStatusByAddress(Object.fromEntries(statuses));
      }
    } catch (error) {
      console.error("Failed to load members:", error);
      toast.error("Failed to load members data");
    } finally {
      setLoadingMembers(false);
    }
  }, [
    membersAddress,
    getTotalMembers,
    getAllMembers,
    address,
    isMember,
    getGuarantor,
    currentCycle,
    paymentsAddress,
    hasPaidForCycle,
  ]);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  const memberRows = useMemo(() => {
    return members
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((member) => ({
        ...member,
        hasPaidCurrentCycle:
          paymentStatusByAddress[member.address.toLowerCase()] ?? false,
      }));
  }, [members, paymentStatusByAddress]);

  if (!membersAddress || /^0x0+$/i.test(membersAddress)) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Members contract not initialized yet.</p>
      </div>
    );
  }

  if (loadingMembers || membersLoading)
    return (
      <div className=" bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <RefreshCw className="w-12 h-12 mx-auto mb-2 opacity-50 animate-spin" />
        <p>Loading Members data...</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-4 sm:p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-card-foreground flex items-center space-x-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span>Members</span>
          </h3>

          <button
            onClick={refreshMembers}
            className="px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Members</p>
            <p className="text-lg font-semibold text-card-foreground mt-1">
              {totalMembers}
            </p>
          </div>
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Your Membership</p>
            <p className="text-lg font-semibold text-card-foreground mt-1 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              {isCurrentUserMember ? "Active Member" : "Not a member"}
            </p>
          </div>
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Your Guarantor</p>
            <p className="text-sm font-semibold text-card-foreground mt-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              {currentUserGuarantor && !/^0x0+$/i.test(currentUserGuarantor)
                ? formatAddress(currentUserGuarantor)
                : "N/A"}
            </p>
          </div>
        </div>

        {memberRows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No members joined yet</p>
            <p className="text-sm">
              Members will appear once they join this Ajo
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {memberRows.map((member) => (
              <div
                key={member.address}
                className="border border-border rounded-lg p-4 bg-background/20"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-card-foreground">
                      {formatAddress(member.address)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Position #{member.position}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined:{" "}
                      {member.joinTimestamp > 0
                        ? new Date(member.joinTimestamp * 1000).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${statusColor(
                        member.status,
                      )}`}
                    >
                      {member.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                      Collateral:{" "}
                      {formatTokenAmount(
                        member.collateralDeposited,
                        tokenDecimals,
                      )}
                    </span>
                    <span className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                      Payout:{" "}
                      {member.hasReceivedPayout ? "Received" : "Pending"}
                    </span>
                    <span className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                      Cycle {currentCycle}:{" "}
                      {member.hasPaidCurrentCycle ? "Paid" : "Not Paid"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AjoMembers;
