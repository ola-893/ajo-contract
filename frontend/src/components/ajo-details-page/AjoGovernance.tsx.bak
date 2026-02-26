/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  Settings,
  Vote,
  Users,
  Calendar,
  AlertCircle,
  X,
  Plus,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Database,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useAjoGovernance, VoteSupport } from "@/hooks/useAjoGovernance";
import { useHcsVoting } from "@/hooks/useHcsVoting";
import type { HcsVote } from "@/hooks/useHcsVoting";
import type { AjoInfo } from "@/store/ajoStore";
import { toast } from "sonner";
import { formatAddress } from "@/utils/utils";

interface AjoGovernanceProps {
  ajo: AjoInfo | null | undefined;
}

const AjoGovernance = ({ ajo }: AjoGovernanceProps) => {
  const governance = useAjoGovernance(ajo?.ajoGovernance || "");
  const hcsVoting = useHcsVoting(ajo?.ajoGovernance || "");

  // State
  const [activeProposals, setActiveProposals] = useState<string[]>([]);
  const [proposalDetails, setProposalDetails] = useState<any[]>([]);
  const [governanceSettings, setGovernanceSettings] = useState<any>(null);
  const [seasonStatus, setSeasonStatus] = useState<any>(null);
  const [votingPower, setVotingPower] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingStates, setVotingStates] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [hcsTopicId, setHcsTopicId] = useState<string | null>(null);
  const [votingMode, setVotingMode] = useState<"onchain" | "hcs">("hcs");
  const [creatingProposal, setCreatingProposal] = useState(false);

  // HCS-specific state
  const [pendingHcsVotes, setPendingHcsVotes] = useState<{
    [proposalId: number]: HcsVote[];
  }>({});
  const [tallyingProposal, setTallyingProposal] = useState<number | null>(null);

  // Modal states
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [participationChoice, setParticipationChoice] = useState<
    boolean | null
  >(null);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Load HCS topic ID
  useEffect(() => {
    const loadHcsTopicId = async () => {
      if (ajo?.hcsTopicId) {
        // console.log("hcsTopicId:::", ajo?.hcsTopicId);
        setHcsTopicId(ajo.hcsTopicId);
      } else {
        const topicId = await hcsVoting.getHcsTopicId();
        setHcsTopicId(topicId);
        console.log("hcsTopicId 2", topicId);
      }
    };
    loadHcsTopicId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajo?.hcsTopicId, hcsVoting]);

  // Setup Hedera client on mount
  useEffect(() => {
    hcsVoting.setupHederaClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load initial data
  const loadGovernanceData = useCallback(async () => {
    if (!ajo?.ajoGovernance) {
      setError("No governance address configured for this Ajo");
      setLoading(false);
      return;
    }

    if (!governance.accountId) {
      setError("Please connect your wallet to view governance data");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const settings = await governance.getGovernanceSettings();
      console.log("Governance settings:", settings);

      const season = await governance.getSeasonStatus();
      console.log("Season status:", season);

      const power = await governance.getVotingPower(governance.accountId);
      console.log("Voting Power:", power);

      const proposals = await governance.getActiveProposals();

      setGovernanceSettings(settings);
      setSeasonStatus(season);
      setVotingPower(power);
      setActiveProposals(proposals);

      // Load proposal details with rate limiting
      if (proposals.length > 0) {
        const details = [];
        for (let i = 0; i < proposals.length; i++) {
          const id = proposals[i];
          try {
            const [proposal, status, hasUserVoted] = await Promise.all([
              governance.getProposal(Number(id)),
              governance.getProposalStatus(Number(id)),
              governance.hasVoted(Number(id), governance.accountId),
            ]);
            details.push({ ...proposal, ...status, id, hasUserVoted });
            if (i < proposals.length - 1) await delay(400);
          } catch (error) {
            console.error(`Failed to load proposal ${id}:`, error);
          }
        }
        console.log("Proposal details:", details);
        setProposalDetails(details);

        // Load HCS votes for each proposal
        console.log("topic id - mirror node:", ajo?.hcsTopicId);
        if (ajo?.hcsTopicId) {
          for (const proposalId of proposals) {
            try {
              const votes = await hcsVoting.fetchVotesFromMirrorNode(
                ajo?.hcsTopicId,
                Number(proposalId)
              );
              console.log("Hsc votes from mirror node:", votes);
              if (votes.length > 0) {
                setPendingHcsVotes((prev) => ({
                  ...prev,
                  [Number(proposalId)]: votes,
                }));
              }
            } catch (error) {
              console.error(
                `Failed to fetch HCS votes for proposal ${proposalId}:`,
                error
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Failed to load governance data:", error);
      let errorMessage = "Failed to load governance data";
      if (error.message?.includes("429")) {
        errorMessage = "Rate limit exceeded. Please wait and refresh.";
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ajo?.ajoGovernance]);

  useEffect(() => {
    loadGovernanceData();
  }, [loadGovernanceData]);

  // HCS Vote handler
  const handleHcsVote = async (proposalId: number, support: VoteSupport) => {
    if (!hcsTopicId) {
      toast.error("HCS Topic ID not found");
      return;
    }

    const key = `${proposalId}-${support}-hcs`;
    setVotingStates((prev) => ({ ...prev, [key]: true }));

    try {
      const vote = await hcsVoting.castHcsVote(proposalId, support, hcsTopicId);

      if (vote) {
        // Add vote to pending votes
        setPendingHcsVotes((prev) => ({
          ...prev,
          [proposalId]: [...(prev[proposalId] || []), vote],
        }));

        toast.success(`Vote submitted to HCS! Cost: ~$0.0001`, {
          description: "Your vote is stored off-chain and ready to be tallied.",
        });
      }
    } catch (error) {
      console.error("Failed to cast HCS vote:", error);
    } finally {
      setVotingStates((prev) => ({ ...prev, [key]: false }));
    }
  };

  // On-chain vote handler (original)
  const handleOnChainVote = async (
    proposalId: number,
    support: VoteSupport
  ) => {
    const key = `${proposalId}-${support}`;
    setVotingStates((prev) => ({ ...prev, [key]: true }));

    try {
      await governance.castVote(proposalId, support);
      toast.success("Vote cast on-chain!");
      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to cast vote:", error);
    } finally {
      setVotingStates((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Tally HCS votes
  const handleTallyHcsVotes = async (proposalId: number) => {
    const votes = pendingHcsVotes[proposalId];
    if (!votes || votes.length === 0) {
      toast.error("No HCS votes to tally for this proposal");
      return;
    }

    setTallyingProposal(proposalId);
    try {
      const result = await hcsVoting.tallyVotesFromHCS(proposalId, votes);

      if (result) {
        toast.success(`Tallied ${votes.length} votes!`, {
          description: `For: ${result.forVotes}, Against: ${result.againstVotes}, Gas: ${result.gasUsed}`,
        });

        // Clear pending votes for this proposal
        setPendingHcsVotes((prev) => {
          const updated = { ...prev };
          delete updated[proposalId];
          return updated;
        });

        await loadGovernanceData();
      }
    } catch (error) {
      console.error("Failed to tally votes:", error);
    } finally {
      setTallyingProposal(null);
    }
  };

  // Proposal handlers (same as before)
  const handleProposeNewMember = async (
    memberAddress: string,
    description: string
  ) => {
    try {
      await governance.proposeNewMember(memberAddress, description);
      setShowCreateProposal(false);
      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to create proposal:", error);
    }
  };

  const handleProposeSeasonCompletion = async () => {
    try {
      setCreatingProposal(true);
      await governance.proposeSeasonCompletion(
        "Complete this season and prepare for next season"
      );
      setShowCreateProposal(false);

      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to create proposal:", error);
    } finally {
      setCreatingProposal(false);
    }
  };

  const handleProposeUpdateSeasonParameters = async (
    description: string,
    duration: number,
    payment: string
  ) => {
    try {
      await governance.proposeUpdateSeasonParameters(
        description,
        duration,
        payment
      );
      setShowCreateProposal(false);
      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to create proposal:", error);
    }
  };

  const handleDeclareParticipation = async (participate: boolean) => {
    try {
      await governance.declareNextSeasonParticipation(participate);
      setParticipationChoice(participate);
      toast.success(
        `Successfully ${participate ? "opted in" : "opted out"} of next season`
      );
    } catch (error) {
      console.error("Failed to declare participation:", error);
    }
  };

  const handleExecuteProposal = async (proposalId: number) => {
    try {
      await governance.executeProposal(proposalId);
      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to execute proposal:", error);
    }
  };

  const handleCancelProposal = async (proposalId: number, proposer: string) => {
    if (governance.accountId?.toLowerCase() !== proposer.toLowerCase()) {
      toast.error("Only the proposer can cancel this proposal");
      return;
    }

    try {
      await governance.cancelProposal(proposalId);
      await loadGovernanceData();
    } catch (error) {
      console.error("Failed to cancel proposal:", error);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <div className="text-center">
          <h3 className="text-xl font-bold text-card-foreground mb-2">
            Unable to Load Governance
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => loadGovernanceData()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-semibold transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <Database className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
        <p>Loading Governance data...</p>
      </div>
    );
  }

  const totalVotes = governanceSettings?.totalProposals || "0";
  const votingPeriodDays = governanceSettings?.votingPeriod
    ? Math.floor(Number(governanceSettings.votingPeriod) / (60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-6">
      {/* HCS Info Banner */}
      {/* <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-card-foreground mb-2 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span>HCS Off-Chain Voting Enabled</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Vote off-chain via Hedera Consensus Service for ~$0.0001 per vote
              (90%+ cost reduction). Anyone can tally votes on-chain with
              signature verification.
            </p>
            {hcsTopicId && (
              <div className="text-xs text-muted-foreground font-mono">
                Topic ID: {hcsTopicId}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setVotingMode("hcs")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                votingMode === "hcs"
                  ? "bg-blue-600 text-white"
                  : "bg-background/50 text-muted-foreground hover:bg-background"
              }`}
            >
              HCS Mode
            </button>
            <button
              onClick={() => setVotingMode("onchain")}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                votingMode === "onchain"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/50 text-muted-foreground hover:bg-background"
              }`}
            >
              On-Chain
            </button>
          </div>
        </div>
      </div> */}

      {/* Season Participation Banner */}
      {/* {seasonStatus && !seasonStatus.isSeasonCompleted && (
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-card-foreground mb-2 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Next Season Participation</span>
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Declare if you'll participate in the next season.
                {seasonStatus.participationDeadline !== "0" && (
                  <>
                    {" "}
                    Deadline:{" "}
                    {new Date(
                      Number(seasonStatus.participationDeadline) * 1000
                    ).toLocaleDateString()}
                  </>
                )}
              </p>
              <div className="text-xs text-muted-foreground">
                {seasonStatus.declaredParticipants} members have declared their
                participation
              </div>
            </div>
            {participationChoice === null && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleDeclareParticipation(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  Opt In
                </button>
                <button
                  onClick={() => handleDeclareParticipation(false)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  Opt Out
                </button>
              </div>
            )}
            {participationChoice !== null && (
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-semibold">
                  {participationChoice ? "Opted In" : "Opted Out"}
                </span>
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Governance Stats */}
      {/* <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h4 className="text-lg font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Vote className="w-5 h-5 text-primary" />
            <span>Your Voting Power</span>
          </h4>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-primary">{votingPower}</div>
            <div className="text-sm text-muted-foreground">
              Based on reputation and participation
            </div>
            {governanceSettings && (
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Quorum Required:
                  </span>
                  <span className="font-semibold text-accent">
                    {governanceSettings.quorumPercentage}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h4 className="text-lg font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-accent" />
            <span>Proposal Stats</span>
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Proposals:</span>
              <span className="font-bold text-accent">{totalVotes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Active:</span>
              <span className="font-semibold text-primary">
                {activeProposals.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Proposals:</span>
              <span className="font-semibold text-card-foreground">
                {
                  proposalDetails.filter(
                    (p) => p.proposer === governance.accountId
                  ).length
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h4 className="text-lg font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Settings className="w-5 h-5 text-secondary-foreground" />
            <span>Governance Settings</span>
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Voting Period:</span>
              <span className="font-semibold text-card-foreground">
                {votingPeriodDays} days
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Proposal Threshold:</span>
              <span className="font-semibold text-secondary-foreground">
                {governanceSettings?.proposalThreshold || "1"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Penalty Rate:</span>
              <span className="font-semibold text-accent">
                {governanceSettings?.currentPenaltyRate || "0"}%
              </span>
            </div>
          </div>
        </div>
      </div> */}

      {/* Active Proposals */}
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-card-foreground flex items-center space-x-2">
            <Vote className="w-6 h-6 text-primary" />
            <span>Active Proposals</span>
          </h3>
          {proposalDetails.length !== 0 && (
            <button
              onClick={() => setShowCreateProposal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Proposal</span>
            </button>
          )}
        </div>

        {proposalDetails.length === 0 ? (
          <div className="flex items-center justify-center flex-col text-center py-12 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />

            <button
              onClick={handleProposeSeasonCompletion}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
            >
              {creatingProposal ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>creating</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Proposal</span>
                </>
              )}
            </button>
            <p className="text-sm mt-2">
              Create a proposal to decide next season participation
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {proposalDetails.map((proposal) => {
              const totalVotes =
                Number(proposal.forVotes) +
                Number(proposal.againstVotes) +
                Number(proposal.abstainVotes);
              const forPercentage =
                totalVotes > 0
                  ? (Number(proposal.forVotes) / totalVotes) * 100
                  : 0;
              const againstPercentage =
                totalVotes > 0
                  ? (Number(proposal.againstVotes) / totalVotes) * 100
                  : 0;
              const abstainPercentage =
                totalVotes > 0
                  ? (Number(proposal.abstainVotes) / totalVotes) * 100
                  : 0;
              const isProposer =
                governance.accountId?.toLowerCase() ===
                proposal.proposer?.toLowerCase();

              const hcsVotes = pendingHcsVotes[Number(proposal.id)] || [];
              const hcsForVotes = hcsVotes.filter(
                (v) => v.support === 1
              ).length;
              const hcsAgainstVotes = hcsVotes.filter(
                (v) => v.support === 0
              ).length;
              const hcsAbstainVotes = hcsVotes.filter(
                (v) => v.support === 2
              ).length;

              return (
                <div
                  key={proposal.id}
                  className="p-6 bg-background/30 rounded-lg border border-border hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2 flex-wrap gap-2">
                        <h4 className="text-lg font-bold text-card-foreground">
                          Proposal #{proposal.id}
                        </h4>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            proposal.isActive
                              ? "bg-accent/20 text-accent"
                              : proposal.executed
                              ? "bg-green-600/20 text-green-400"
                              : proposal.canceled
                              ? "bg-red-600/20 text-red-400"
                              : "bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {proposal.isActive
                            ? "Active"
                            : proposal.executed
                            ? "Executed"
                            : proposal.canceled
                            ? "Canceled"
                            : "Pending"}
                        </div>
                        {proposal.hasQuorum && (
                          <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                            Quorum Reached
                          </div>
                        )}
                        {proposal.isPassing && (
                          <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400">
                            Passing
                          </div>
                        )}
                        {proposal.hasUserVoted && votingMode === "onchain" && (
                          <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400">
                            You Voted
                          </div>
                        )}
                        {hcsVotes.length > 0 && (
                          <div className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-600/20 text-yellow-400">
                            {hcsVotes.length} HCS Votes Pending
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">
                        {proposal.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {proposal.proposer && (
                          <div>
                            Proposer: {formatAddress(proposal.proposer)}
                          </div>
                        )}
                        <div>
                          Ends:{" "}
                          {new Date(
                            Number(proposal.endTime) * 1000
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* On-Chain Voting Results */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        On-Chain Results
                      </span>
                      <span className="text-card-foreground">
                        {totalVotes} votes cast
                      </span>
                    </div>

                    <VotingBar
                      label="For"
                      votes={proposal.forVotes}
                      percentage={forPercentage}
                      color="green"
                    />
                    <VotingBar
                      label="Against"
                      votes={proposal.againstVotes}
                      percentage={againstPercentage}
                      color="red"
                    />
                    <VotingBar
                      label="Abstain"
                      votes={proposal.abstainVotes}
                      percentage={abstainPercentage}
                      color="gray"
                    />
                  </div>

                  {/* HCS Pending Votes */}
                  {hcsVotes.length > 0 && (
                    <div className="space-y-3 mb-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-yellow-400 font-semibold flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Pending HCS Votes (Off-Chain)</span>
                        </span>
                        <span className="text-card-foreground">
                          {hcsVotes.length} votes (~$
                          {(hcsVotes.length * 0.0001).toFixed(4)})
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-green-400">For: </span>
                          <span className="font-semibold">{hcsForVotes}</span>
                        </div>
                        <div>
                          <span className="text-red-400">Against: </span>
                          <span className="font-semibold">
                            {hcsAgainstVotes}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Abstain: </span>
                          <span className="font-semibold">
                            {hcsAbstainVotes}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-3 pt-4 border-t border-border flex-wrap gap-2">
                    {proposal.isActive &&
                      !proposal.executed &&
                      !proposal.canceled && (
                        <>
                          {/* {votingMode === "hcs" ? ( */}
                          {/* // HCS Voting Buttons */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                handleHcsVote(
                                  Number(proposal.id),
                                  VoteSupport.For
                                )
                              }
                              disabled={
                                votingStates[
                                  `${proposal.id}-${VoteSupport.For}-hcs`
                                ]
                              }
                              className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <ThumbsUp className="w-4 h-4" />
                              <span>Vote For (HCS)</span>
                            </button>
                            <button
                              onClick={() =>
                                handleHcsVote(
                                  Number(proposal.id),
                                  VoteSupport.Against
                                )
                              }
                              disabled={
                                votingStates[
                                  `${proposal.id}-${VoteSupport.Against}-hcs`
                                ]
                              }
                              className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <ThumbsDown className="w-4 h-4" />
                              <span>Vote Against (HCS)</span>
                            </button>
                            <button
                              onClick={() =>
                                handleHcsVote(
                                  Number(proposal.id),
                                  VoteSupport.Abstain
                                )
                              }
                              disabled={
                                votingStates[
                                  `${proposal.id}-${VoteSupport.Abstain}-hcs`
                                ]
                              }
                              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <MinusCircle className="w-4 h-4" />
                              <span>Abstain (HCS)</span>
                            </button>
                          </div>
                          {/* ) : (
                            // On-Chain Voting Buttons
                            !proposal.hasUserVoted && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() =>
                                    handleOnChainVote(
                                      Number(proposal.id),
                                      VoteSupport.For
                                    )
                                  }
                                  disabled={
                                    votingStates[
                                      `${proposal.id}-${VoteSupport.For}`
                                    ]
                                  }
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                  <span>Vote For</span>
                                </button>
                                <button
                                  onClick={() =>
                                    handleOnChainVote(
                                      Number(proposal.id),
                                      VoteSupport.Against
                                    )
                                  }
                                  disabled={
                                    votingStates[
                                      `${proposal.id}-${VoteSupport.Against}`
                                    ]
                                  }
                                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                  <span>Vote Against</span>
                                </button>
                                <button
                                  onClick={() =>
                                    handleOnChainVote(
                                      Number(proposal.id),
                                      VoteSupport.Abstain
                                    )
                                  }
                                  disabled={
                                    votingStates[
                                      `${proposal.id}-${VoteSupport.Abstain}`
                                    ]
                                  }
                                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                                >
                                  <MinusCircle className="w-4 h-4" />
                                  <span>Abstain</span>
                                </button>
                              </div>
                            ) */}
                          {/* )} */}
                          {/* Tally HCS Votes Button */}
                          {hcsVotes.length > 0 && (
                            <button
                              onClick={() =>
                                handleTallyHcsVotes(Number(proposal.id))
                              }
                              disabled={
                                tallyingProposal === Number(proposal.id)
                              }
                              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <Zap className="w-4 h-4" />
                              <span>
                                {tallyingProposal === Number(proposal.id)
                                  ? "Tallying..."
                                  : `Tally ${hcsVotes.length} HCS Votes`}
                              </span>
                            </button>
                          )}
                          {proposal.isPassing && proposal.hasQuorum && (
                            <button
                              onClick={() =>
                                handleExecuteProposal(Number(proposal.id))
                              }
                              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Execute</span>
                            </button>
                          )}
                          {isProposer && (
                            <button
                              onClick={() =>
                                handleCancelProposal(
                                  Number(proposal.id),
                                  proposal.proposer
                                )
                              }
                              className="border border-red-500 text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2"
                            >
                              <X className="w-4 h-4" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </>
                      )}
                    {!proposal.isActive && !proposal.executed && (
                      <div className="text-sm text-muted-foreground flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Voting ended</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      {showCreateProposal && (
        <CreateProposalModal
          onClose={() => setShowCreateProposal(false)}
          onSubmitNewMember={handleProposeNewMember}
          // onSubmitSeasonCompletion={handleProposeSeasonCompletion}
          onSubmitSeasonParameters={handleProposeUpdateSeasonParameters}
        />
      )}
    </div>
  );
};

// Voting Bar Component
const VotingBar = ({
  label,
  votes,
  percentage,
  color,
}: {
  label: string;
  votes: string;
  percentage: number;
  color: "green" | "red" | "gray";
}) => {
  const colorClasses = {
    green: { dot: "bg-green-500", bar: "bg-green-500", text: "text-green-400" },
    red: { dot: "bg-red-500", bar: "bg-red-500", text: "text-red-400" },
    gray: {
      dot: "bg-gray-500",
      bar: "bg-gray-500",
      text: "text-muted-foreground",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 ${colors.dot} rounded-full`}></div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${colors.text}`}>
          {votes} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-background/50 rounded-full h-2">
        <div
          className={`${colors.bar} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// Create Proposal Modal Component
const CreateProposalModal = ({
  onClose,
  onSubmitNewMember,
  // onSubmitSeasonCompletion,
  onSubmitSeasonParameters,
}: {
  onClose: () => void;
  onSubmitNewMember: (address: string, description: string) => void;
  // onSubmitSeasonCompletion: (description: string) => void;
  onSubmitSeasonParameters: (
    description: string,
    duration: number,
    payment: string
  ) => void;
}) => {
  const [proposalType, setProposalType] = useState("newMember");
  const [description, setDescription] = useState("");
  const [memberAddress, setMemberAddress] = useState("");
  const [duration, setDuration] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");

  const handleSubmit = () => {
    if (proposalType === "newMember") {
      onSubmitNewMember(memberAddress, description);
      // } else if (proposalType === "seasonCompletion") {
      //   onSubmitSeasonCompletion(description);
      // }
    } else if (proposalType === "seasonParameters") {
      onSubmitSeasonParameters(description, Number(duration), monthlyPayment);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold text-card-foreground">
            Create Proposal
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-3">
              Proposal Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setProposalType("newMember")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  proposalType === "newMember"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/30"
                }`}
              >
                <Users className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-semibold">New Member</div>
              </button>
              <button
                onClick={() => setProposalType("seasonCompletion")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  proposalType === "seasonCompletion"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/30"
                }`}
              >
                <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-semibold">Complete Season</div>
              </button>
              <button
                onClick={() => setProposalType("seasonParameters")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  proposalType === "seasonParameters"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/30"
                }`}
              >
                <Settings className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-semibold">Update Parameters</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background/30 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              placeholder="Describe your proposal..."
            />
          </div>

          {proposalType === "newMember" && (
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Member Address
              </label>
              <input
                type="text"
                value={memberAddress}
                onChange={(e) => setMemberAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background/30 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.0.12345 or 0x..."
              />
            </div>
          )}

          {proposalType === "seasonParameters" && (
            <>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">
                  Duration (months)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background/30 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">
                  Monthly Payment (USDC)
                </label>
                <input
                  type="text"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background/30 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="100"
                />
              </div>
            </>
          )}

          <div className="flex items-center space-x-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={
                !description || (proposalType === "newMember" && !memberAddress)
              }
              className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Create Proposal
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:bg-background/50 font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoGovernance;
