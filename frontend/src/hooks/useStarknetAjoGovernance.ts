/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import {
  CairoCustomEnum,
  Contract,
  RpcProvider,
  cairo,
  shortString,
} from "starknet";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { ajoGovernanceAbi } from "@/abi/placeholders";

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4";

export type ProposalTypeName =
  | "AddMember"
  | "RemoveMember"
  | "ChangeConfig"
  | "HandleDefault"
  | "Emergency";

const proposalTypeFromValue = (
  value: number | ProposalTypeName,
): ProposalTypeName => {
  if (typeof value === "string") return value;
  switch (value) {
    case 0:
      return "AddMember";
    case 1:
      return "RemoveMember";
    case 2:
      return "ChangeConfig";
    case 3:
      return "HandleDefault";
    case 4:
      return "Emergency";
    default:
      return "Emergency";
  }
};

const buildProposalTypeEnum = (proposalType: number | ProposalTypeName) => {
  const name = proposalTypeFromValue(proposalType);
  return new CairoCustomEnum({ [name]: {} });
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

const toBool = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value === "true";
  if (typeof value === "object" && value !== null) {
    if ("True" in value || "true" in value) return true;
    if ("False" in value || "false" in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const toAddress = (value: any): string => {
  if (typeof value === "string") {
    if (value.startsWith("0x")) return value.toLowerCase();
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }
  return `0x${toBigIntValue(value).toString(16)}`;
};

/**
 * Hook for interacting with Ajo Governance Cairo contract
 */
const useStarknetAjoGovernance = (ajoGovernanceAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () =>
    new RpcProvider({
      nodeUrl: RPC_URL,
    });

  const getAuthorizedCore = useCallback(async (): Promise<string> => {
    if (!ajoGovernanceAddress) {
      throw new Error("Contract address not available");
    }

    const provider = getProvider();
    const governanceContract = new Contract(
      ajoGovernanceAbi as any,
      ajoGovernanceAddress,
      provider,
    );

    const coreAddress = await governanceContract.get_authorized_core();
    return toAddress(coreAddress);
  }, [ajoGovernanceAddress]);

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider,
        );
        governanceContract.connect(account as any);

        const result = await governanceContract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error setting authorized core:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress],
  );

  /**
   * Create a new proposal
   */
  const createProposal = useCallback(
    async (
      proposalType: number | ProposalTypeName,
      description: string,
      target: string,
      calldata: string[] = [],
    ) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      const trimmedDescription = description.trim();
      if (!trimmedDescription) {
        throw new Error("Proposal description is required");
      }
      if (trimmedDescription.length > 31) {
        throw new Error("Description must be 31 characters or less");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider,
        );
        governanceContract.connect(account as any);

        const proposalTypeEnum = buildProposalTypeEnum(proposalType);
        const descriptionFelt =
          shortString.encodeShortString(trimmedDescription);

        const result = await governanceContract.create_proposal(
          proposalTypeEnum,
          descriptionFelt,
          target,
          calldata,
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error creating proposal:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress],
  );

  /**
   * Cast a vote on a proposal
   */
  const castVote = useCallback(
    async (proposalId: number, support: boolean) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider,
        );
        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);
        const result = await governanceContract.cast_vote(proposalIdU256, support);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error casting vote:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress],
  );

  /**
   * Execute a proposal
   */
  const executeProposal = useCallback(
    async (proposalId: number) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider,
        );
        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);
        const result = await governanceContract.execute_proposal(proposalIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error executing proposal:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress],
  );

  /**
   * Cancel a proposal
   */
  const cancelProposal = useCallback(
    async (proposalId: number) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider,
        );
        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);
        const result = await governanceContract.cancel_proposal(proposalIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error cancelling proposal:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress],
  );

  /**
   * Get proposal details
   */
  const getProposal = useCallback(
    async (proposalId: number) => {
      if (!ajoGovernanceAddress) {
        throw new Error("Contract address not available");
      }

      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider,
      );

      const proposalIdU256 = cairo.uint256(proposalId);
      return governanceContract.get_proposal(proposalIdU256);
    },
    [ajoGovernanceAddress],
  );

  /**
   * Get proposal status
   */
  const getProposalStatus = useCallback(
    async (proposalId: number) => {
      if (!ajoGovernanceAddress) {
        throw new Error("Contract address not available");
      }

      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider,
      );

      const proposalIdU256 = cairo.uint256(proposalId);
      return governanceContract.get_proposal_status(proposalIdU256);
    },
    [ajoGovernanceAddress],
  );

  /**
   * Check whether voter has voted for proposal
   */
  const hasVoted = useCallback(
    async (proposalId: number, voterAddress: string) => {
      if (!ajoGovernanceAddress) {
        throw new Error("Contract address not available");
      }

      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider,
      );

      const proposalIdU256 = cairo.uint256(proposalId);
      const result = await governanceContract.has_voted(
        proposalIdU256,
        voterAddress,
      );
      return toBool(result);
    },
    [ajoGovernanceAddress],
  );

  /**
   * Get voting power of an address
   */
  const getVotingPower = useCallback(
    async (voterAddress: string) => {
      if (!ajoGovernanceAddress) {
        throw new Error("Contract address not available");
      }

      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider,
      );

      const power = await governanceContract.get_voting_power(voterAddress);
      return toBigIntValue(power);
    },
    [ajoGovernanceAddress],
  );

  /**
   * Get total number of proposals
   */
  const getTotalProposals = useCallback(async () => {
    if (!ajoGovernanceAddress) {
      throw new Error("Contract address not available");
    }

    const provider = getProvider();
    const governanceContract = new Contract(
      ajoGovernanceAbi as any,
      ajoGovernanceAddress,
      provider,
    );

    const total = await governanceContract.get_total_proposals();
    return Number(toBigIntValue(total));
  }, [ajoGovernanceAddress]);

  /**
   * Get quorum requirement
   */
  const getQuorum = useCallback(async () => {
    if (!ajoGovernanceAddress) {
      throw new Error("Contract address not available");
    }

    const provider = getProvider();
    const governanceContract = new Contract(
      ajoGovernanceAbi as any,
      ajoGovernanceAddress,
      provider,
    );

    const quorum = await governanceContract.get_quorum();
    return Number(toBigIntValue(quorum));
  }, [ajoGovernanceAddress]);

  /**
   * Get voting period in seconds
   */
  const getVotingPeriod = useCallback(async () => {
    if (!ajoGovernanceAddress) {
      throw new Error("Contract address not available");
    }

    const provider = getProvider();
    const governanceContract = new Contract(
      ajoGovernanceAbi as any,
      ajoGovernanceAddress,
      provider,
    );

    const period = await governanceContract.get_voting_period();
    return Number(period);
  }, [ajoGovernanceAddress]);

  return {
    // View functions
    getAuthorizedCore,
    getProposal,
    getProposalStatus,
    hasVoted,
    getVotingPower,
    getTotalProposals,
    getQuorum,
    getVotingPeriod,

    // Write functions
    setAuthorizedCore,
    createProposal,
    castVote,
    executeProposal,
    cancelProposal,

    // State
    loading,
  };
};

export default useStarknetAjoGovernance;
