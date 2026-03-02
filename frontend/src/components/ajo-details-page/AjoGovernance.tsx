import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  Gavel,
  Loader2,
  RefreshCw,
  Vote,
  XCircle,
} from "lucide-react";
import { shortString } from "starknet";
import { toast } from "sonner";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoGovernance from "@/hooks/useStarknetAjoGovernance";
import type { ProposalTypeName } from "@/hooks/useStarknetAjoGovernance";
import { formatAddress } from "@/utils/utils";

type ProposalView = {
  id: number;
  proposer: string;
  proposalType: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  status: string;
  createdAt: number;
  votingEndsAt: number;
  hasVoted: boolean;
};

const PROPOSAL_TYPES: ProposalTypeName[] = [
  "AddMember",
  "RemoveMember",
  "ChangeConfig",
  "HandleDefault",
  "Emergency",
];

const AjoGovernance = ({ ajo }: { ajo: any }) => {
  const { address, isConnected } = useStarknetWallet();
  const governanceAddress = ajo?.governanceAddress || "";
  const {
    getProposal,
    hasVoted,
    getVotingPower,
    getTotalProposals,
    getQuorum,
    getVotingPeriod,
    createProposal,
    castVote,
    executeProposal,
    cancelProposal,
    loading,
  } = useStarknetAjoGovernance(governanceAddress);

  const [loadingData, setLoadingData] = useState(false);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [totalProposals, setTotalProposals] = useState(0);
  const [quorum, setQuorum] = useState(0);
  const [votingPower, setVotingPower] = useState(0);
  const [votingPeriod, setVotingPeriod] = useState(0);
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalType, setProposalType] =
    useState<ProposalTypeName>("Emergency");

  const loadGovernanceData = useCallback(async () => {
    if (!governanceAddress) return;
    setLoadingData(true);

    try {
      const [total, quorumValue, period] = await Promise.all([
        getTotalProposals(),
        getQuorum(),
        getVotingPeriod(),
      ]);

      setTotalProposals(total);
      setQuorum(quorumValue);
      setVotingPeriod(period);

      if (address) {
        const power = await getVotingPower(address);
        setVotingPower(Number(power));
      } else {
        setVotingPower(0);
      }

      if (total <= 0) {
        setProposals([]);
        return;
      }

      const startId = Math.max(1, total - 4);
      const ids = Array.from({ length: total - startId + 1 }, (_, idx) => total - idx);

      const proposalItems = await Promise.all(
        ids.map(async (id) => {
          const raw = await getProposal(id);
          const voted = address ? await hasVoted(id, address) : false;
          return normalizeProposal(raw, voted);
        }),
      );

      setProposals(proposalItems);
    } catch (error) {
      console.error("Error loading governance data:", error);
    } finally {
      setLoadingData(false);
    }
  }, [
    governanceAddress,
    getTotalProposals,
    getQuorum,
    getVotingPeriod,
    address,
    getVotingPower,
    getProposal,
    hasVoted,
  ]);

  useEffect(() => {
    loadGovernanceData();
  }, [loadGovernanceData]);

  const handleCreateProposal = async () => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to create proposal");
      return;
    }

    const description = proposalDescription.trim();
    if (!description) {
      toast.error("Enter proposal description");
      return;
    }

    if (description.length > 31) {
      toast.error("Description must be 31 chars or less");
      return;
    }

    try {
      const target = ajo?.coreAddress || address;
      await createProposal(proposalType, description, target, []);
      toast.success("Proposal created successfully");
      setProposalDescription("");
      await loadGovernanceData();
    } catch (error: any) {
      console.error("Create proposal failed:", error);
      toast.error(error?.message || "Failed to create proposal");
    }
  };

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!isConnected || !address) {
      toast.error("Connect wallet to vote");
      return;
    }

    try {
      await castVote(proposalId, support);
      toast.success(support ? "Voted FOR" : "Voted AGAINST");
      await loadGovernanceData();
    } catch (error: any) {
      console.error("Vote failed:", error);
      toast.error(error?.message || "Failed to cast vote");
    }
  };

  const handleExecute = async (proposalId: number) => {
    try {
      await executeProposal(proposalId);
      toast.success("Proposal executed");
      await loadGovernanceData();
    } catch (error: any) {
      console.error("Execute failed:", error);
      toast.error(error?.message || "Failed to execute proposal");
    }
  };

  const handleCancel = async (proposalId: number) => {
    try {
      await cancelProposal(proposalId);
      toast.success("Proposal cancelled");
      await loadGovernanceData();
    } catch (error: any) {
      console.error("Cancel failed:", error);
      toast.error(error?.message || "Failed to cancel proposal");
    }
  };

  const stats = useMemo(
    () => [
      { label: "Total Proposals", value: String(totalProposals) },
      { label: "Quorum", value: String(quorum) },
      { label: "Voting Power", value: String(votingPower) },
      { label: "Voting Period", value: `${Math.floor(votingPeriod / 3600)}h` },
    ],
    [totalProposals, quorum, votingPower, votingPeriod],
  );

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-card-foreground flex items-center space-x-2">
            <Vote className="w-6 h-6 text-primary" />
            <span>Governance & Proposals</span>
          </h3>
          <button
            onClick={loadGovernanceData}
            disabled={loadingData || !governanceAddress}
            className="p-2 rounded-md border border-border hover:bg-primary/10 disabled:opacity-50"
            title="Refresh governance data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {!governanceAddress ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Governance address not available yet</p>
            <p className="text-sm">Deploy/initialize governance module first</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="bg-background/40 border border-border rounded-lg p-3"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold text-card-foreground mt-1">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
              <h4 className="font-semibold text-card-foreground">
                Create Proposal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={proposalType}
                  onChange={(e) =>
                    setProposalType(e.target.value as ProposalTypeName)
                  }
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                >
                  {PROPOSAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  maxLength={31}
                  placeholder="Short proposal description"
                  className="md:col-span-2 bg-background border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleCreateProposal}
                disabled={loading || !isConnected}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Create Proposal"}
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-card-foreground">
                Recent Proposals
              </h4>

              {loadingData ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading proposals...
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  No proposals yet.
                </div>
              ) : (
                proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="border border-border rounded-lg p-4 bg-background/20"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-card-foreground">
                            #{proposal.id} {proposal.proposalType}
                          </p>
                          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                            {proposal.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {proposal.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {formatAddress(proposal.proposer)} •{" "}
                          {new Date(proposal.createdAt * 1000).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          For: {proposal.votesFor} • Against: {proposal.votesAgainst}
                        </p>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleVote(proposal.id, true)}
                          disabled={loading || proposal.hasVoted || !isConnected}
                          className="px-3 py-2 rounded-md text-xs border border-green-600 text-green-500 hover:bg-green-600/10 disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Vote For
                        </button>
                        <button
                          onClick={() => handleVote(proposal.id, false)}
                          disabled={loading || proposal.hasVoted || !isConnected}
                          className="px-3 py-2 rounded-md text-xs border border-red-600 text-red-500 hover:bg-red-600/10 disabled:opacity-40"
                        >
                          <XCircle className="w-3 h-3 inline mr-1" />
                          Vote Against
                        </button>
                        <button
                          onClick={() => handleExecute(proposal.id)}
                          disabled={loading}
                          className="px-3 py-2 rounded-md text-xs border border-primary text-primary hover:bg-primary/10 disabled:opacity-40"
                        >
                          <Gavel className="w-3 h-3 inline mr-1" />
                          Execute
                        </button>
                        <button
                          onClick={() => handleCancel(proposal.id)}
                          disabled={loading}
                          className="px-3 py-2 rounded-md text-xs border border-border text-muted-foreground hover:bg-background disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AjoGovernance;

const normalizeProposal = (raw: any, hasVotedFlag: boolean): ProposalView => {
  return {
    id: Number(toBigIntValue(raw?.id)),
    proposer: toAddress(raw?.proposer),
    proposalType: parseEnum(raw?.proposal_type, "Unknown"),
    description: decodeFelt(raw?.description),
    votesFor: Number(toBigIntValue(raw?.votes_for)),
    votesAgainst: Number(toBigIntValue(raw?.votes_against)),
    status: parseEnum(raw?.status, "Pending"),
    createdAt: Number(raw?.created_at || 0),
    votingEndsAt: Number(raw?.voting_ends_at || 0),
    hasVoted: hasVotedFlag,
  };
};

const toBigIntValue = (value: any): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") {
    if (!value.trim()) return 0n;
    return BigInt(value);
  }
  if (typeof value === "object" && "low" in value) {
    const low = BigInt((value as any).low ?? 0);
    const high = BigInt((value as any).high ?? 0);
    return low + (high << 128n);
  }
  if (typeof value?.toString === "function") {
    const text = value.toString();
    if (!text || text === "[object Object]") return 0n;
    return BigInt(text);
  }
  return 0n;
};

const parseEnum = (value: any, fallback: string): string => {
  if (!value || typeof value !== "object") return fallback;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : fallback;
};

const decodeFelt = (value: any): string => {
  if (typeof value === "string" && !value.startsWith("0x")) return value;
  const hex =
    typeof value === "string" && value.startsWith("0x")
      ? value
      : `0x${toBigIntValue(value).toString(16)}`;
  try {
    return shortString.decodeShortString(hex);
  } catch {
    return hex;
  }
};

const toAddress = (value: any): string => {
  if (typeof value === "string") {
    if (value.startsWith("0x")) return value;
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }
  return `0x${toBigIntValue(value).toString(16)}`;
};
