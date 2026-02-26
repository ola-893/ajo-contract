/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";
import { ContractId } from "@hashgraph/sdk";
import { ethers } from "ethers";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import { ContractFunctionParameterBuilder } from "@/services/wallets/contractFunctionParameterBuilder";
import AjoGovernanceABI from "@/abi/ajoGovernance.json";
import { toast } from "sonner";

// Types
export interface Proposal {
  id: string;
  proposer: string;
  description: string;
  proposalData: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  startTime: string;
  endTime: string;
  executed: boolean;
  canceled: boolean;
  proposalType: number;
}

export interface ProposalStatus {
  isActive: boolean;
  hasQuorum: boolean;
  isPassing: boolean;
  votesNeeded: string;
}

export interface GovernanceSettings {
  proposalThreshold: string;
  votingPeriod: string;
  quorumPercentage: string;
  currentPenaltyRate: string;
  totalProposals: string;
}

export interface SeasonStatus {
  currentSeason: string;
  isSeasonCompleted: boolean;
  participationDeadline: string;
  declaredParticipants: string;
}

export const VoteSupport = {
  Against: 0,
  For: 1,
  Abstain: 2,
} as const;

export type VoteSupport = (typeof VoteSupport)[keyof typeof VoteSupport];

export const useAjoGovernance = (governanceAddress: string) => {
  const { accountId, walletInterface } = useWalletInterface();
  const [loading, setLoading] = useState(false);

  const isMetaMask = accountId?.startsWith("0x");

  const isHtsToken = (address: string): boolean => {
    if (!address.startsWith("0x")) return false;
    return address.toLowerCase().startsWith("0x" + "0".repeat(30));
  };

  const convertEvmToHederaAddress = useCallback(
    async (evmAddress: string): Promise<string> => {
      if (!evmAddress.startsWith("0x")) return evmAddress;

      if (isHtsToken(evmAddress)) {
        const tokenNum = BigInt(evmAddress);
        const hederaId = `0.0.${tokenNum.toString()}`;
        return hederaId;
      }

      try {
        const mirrorNodeUrl =
          import.meta.env.VITE_HEDERA_MIRROR_NODE_URL ||
          "https://testnet.mirrornode.hedera.com";

        const response = await fetch(
          `${mirrorNodeUrl}/api/v1/accounts/${evmAddress}`
        );

        if (!response.ok) {
          throw new Error(`Mirror node query failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.account;
      } catch (error) {
        console.error("Failed to convert EVM to Hedera address:", error);
        throw error;
      }
    },
    []
  );

  const convertToEvmAddress = (address: string): string => {
    if (address.startsWith("0x")) return address;
    const parts = address.split(".");
    if (parts.length === 3) {
      const accountNum = BigInt(parts[2]);
      return "0x" + accountNum.toString(16).padStart(40, "0");
    }
    return address;
  };

  const getProvider = () => {
    return new ethers.providers.JsonRpcProvider(
      import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
        "https://testnet.hashio.io/api"
    );
  };

  /**
   * Cast a vote on a proposal
   */
  const castVote = useCallback(
    async (proposalId: number, support: VoteSupport) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.castVote(proposalId, support, {
            gasLimit: 2_000_000,
          });
          const receipt = await tx.wait();

          toast.success("Vote cast successfully!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "uint256",
              name: "proposalId",
              value: proposalId,
            })
            .addParam({
              type: "uint8",
              name: "support",
              value: support,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "castVote",
            params,
            2_000_000
          );

          toast.success("Vote cast successfully!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Cast vote failed:", error);
        toast.error("Failed to cast vote");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [walletInterface, accountId, governanceAddress, isMetaMask]
  );

  /**
   * Create a generic proposal
   */
  const createProposal = useCallback(
    async (description: string, proposalData: string) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.createProposal(description, proposalData, {
            gasLimit: 3_000_000,
          });
          const receipt = await tx.wait();

          const event = receipt.events?.find(
            (e: any) => e.event === "ProposalCreated"
          );
          const proposalId = event?.args?.proposalId.toString();

          toast.success("Proposal created successfully!");
          return { txHash: receipt.transactionHash, proposalId };
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "string",
              name: "description",
              value: description,
            })
            .addParam({
              type: "bytes",
              name: "proposalData",
              value: proposalData,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "createProposal",
            params,
            3_000_000
          );

          toast.success("Proposal created successfully!");
          return { txHash: txId?.toString(), proposalId: null };
        }
      } catch (error: any) {
        console.error("Create proposal failed:", error);
        toast.error("Failed to create proposal");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Propose a new member
   */
  const proposeNewMember = useCallback(
    async (newMember: string, description: string) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.proposeNewMember(newMember, description, {
            gasLimit: 3_000_000,
          });
          const receipt = await tx.wait();

          const event = receipt.events?.find(
            (e: any) => e.event === "NewMemberProposed"
          );
          const proposalId = event?.args?.proposalId.toString();

          toast.success("New member proposal created!");
          return { txHash: receipt.transactionHash, proposalId };
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({ type: "address", name: "newMember", value: newMember })
            .addParam({
              type: "string",
              name: "description",
              value: description,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "proposeNewMember",
            params,
            3_000_000
          );

          toast.success("New member proposal created!");
          return { txHash: txId?.toString(), proposalId: null };
        }
      } catch (error: any) {
        console.error("Propose new member failed:", error);
        toast.error("Failed to propose new member");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Propose season completion
   */
  const proposeSeasonCompletion = useCallback(
    async (description: string) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.proposeSeasonCompletion(description, {
            gasLimit: 3_000_000,
          });
          const receipt = await tx.wait();

          toast.success("Season completion proposal created!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder().addParam({
            type: "string",
            name: "description",
            value: description,
          });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "proposeSeasonCompletion",
            params,
            3_000_000
          );

          toast.success("Season completion proposal created!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Propose season completion failed:", error);
        toast.error("Failed to propose season completion");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Propose new season restart
   */
  const proposeNewSeasonRestart = useCallback(
    async (
      description: string,
      newDuration: number,
      newMonthlyContribution: string,
      newMembers: string[]
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const contributionAmount = ethers.utils.parseUnits(
            newMonthlyContribution,
            6
          );

          const tx = await contract.proposeNewSeasonRestart(
            description,
            newDuration,
            contributionAmount,
            newMembers,
            { gasLimit: 3_000_000 }
          );
          const receipt = await tx.wait();

          toast.success("New season restart proposal created!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const contributionAmount = ethers.utils.parseUnits(
            newMonthlyContribution,
            6
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "string",
              name: "description",
              value: description,
            })
            .addParam({
              type: "uint256",
              name: "newDuration",
              value: newDuration,
            })
            .addParam({
              type: "uint256",
              name: "newMonthlyContribution",
              value: contributionAmount.toString(),
            })
            .addParam({
              type: "address[]",
              name: "newMembers",
              value: newMembers,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "proposeNewSeasonRestart",
            params,
            3_000_000
          );

          toast.success("New season restart proposal created!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Propose new season restart failed:", error);
        toast.error("Failed to propose new season restart");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Propose update to season parameters
   */
  const proposeUpdateSeasonParameters = useCallback(
    async (
      description: string,
      newDuration: number,
      newMonthlyPayment: string
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const paymentAmount = ethers.utils.parseUnits(newMonthlyPayment, 6);

        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.proposeUpdateSeasonParameters(
            description,
            newDuration,
            paymentAmount,
            { gasLimit: 3_000_000 }
          );
          const receipt = await tx.wait();

          toast.success("Season parameters update proposal created!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "string",
              name: "description",
              value: description,
            })
            .addParam({
              type: "uint256",
              name: "newDuration",
              value: newDuration,
            })
            .addParam({
              type: "uint256",
              name: "newMonthlyPayment",
              value: paymentAmount.toString(),
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "proposeUpdateSeasonParameters",
            params,
            3_000_000
          );

          toast.success("Season parameters update proposal created!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Propose update season parameters failed:", error);
        toast.error("Failed to propose season parameter update");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Propose carry over rules
   */
  const proposeCarryOverRules = useCallback(
    async (
      description: string,
      carryReputation: boolean,
      carryPenalties: boolean
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.proposeCarryOverRules(
            description,
            carryReputation,
            carryPenalties,
            { gasLimit: 3_000_000 }
          );
          const receipt = await tx.wait();

          toast.success("Carry over rules proposal created!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "string",
              name: "description",
              value: description,
            })
            .addParam({
              type: "bool",
              name: "_carryReputation",
              value: carryReputation,
            })
            .addParam({
              type: "bool",
              name: "_carryPenalties",
              value: carryPenalties,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "proposeCarryOverRules",
            params,
            3_000_000
          );

          toast.success("Carry over rules proposal created!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Propose carry over rules failed:", error);
        toast.error("Failed to propose carry over rules");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  const cancelProposal = useCallback(
    async (proposalId: number) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.cancelProposal(proposalId, {
            gasLimit: 2_000_000,
          });
          const receipt = await tx.wait();

          toast.success("Proposal canceled!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder().addParam({
            type: "uint256",
            name: "proposalId",
            value: proposalId,
          });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "cancelProposal",
            params,
            2_000_000
          );

          toast.success("Proposal canceled!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Cancel proposal failed:", error);
        toast.error("Failed to cancel proposal");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  const executeProposal = useCallback(
    async (proposalId: number) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.executeProposal(proposalId, {
            gasLimit: 3_000_000,
          });
          const receipt = await tx.wait();

          toast.success("Proposal executed successfully!");
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder().addParam({
            type: "uint256",
            name: "proposalId",
            value: proposalId,
          });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "executeProposal",
            params,
            3_000_000
          );

          toast.success("Proposal executed successfully!");
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Execute proposal failed:", error);
        toast.error("Failed to execute proposal");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Declare participation in next season
   */
  const declareNextSeasonParticipation = useCallback(
    async (participate: boolean) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            governanceAddress,
            AjoGovernanceABI.abi,
            signer
          );

          const tx = await contract.declareNextSeasonParticipation(
            participate,
            {
              gasLimit: 1_000_000,
            }
          );
          const receipt = await tx.wait();

          toast.success(
            `Successfully ${
              participate ? "opted in" : "opted out"
            } of next season!`
          );
          return receipt.transactionHash;
        } else {
          const hederaAddress = await convertEvmToHederaAddress(
            governanceAddress
          );

          const params = new ContractFunctionParameterBuilder().addParam({
            type: "bool",
            name: "participate",
            value: participate,
          });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaAddress),
            "declareNextSeasonParticipation",
            params,
            1_000_000
          );

          toast.success(
            `Successfully ${
              participate ? "opted in" : "opted out"
            } of next season!`
          );
          return txId?.toString();
        }
      } catch (error: any) {
        console.error("Declare participation failed:", error);
        toast.error("Failed to declare participation");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      governanceAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  const getProposal = useCallback(
    async (proposalId: number): Promise<Proposal> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getProposal(proposalId);

        return {
          id: proposalId.toString(),
          proposer: "",
          description: result[0],
          proposalData: result[8],
          forVotes: result[1].toString(),
          againstVotes: result[2].toString(),
          abstainVotes: result[3].toString(),
          startTime: result[4].toString(),
          endTime: result[5].toString(),
          executed: result[6],
          canceled: result[7],
          proposalType: 0,
        };
      } catch (error: any) {
        console.error("Get proposal failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const getProposalStatus = useCallback(
    async (proposalId: number): Promise<ProposalStatus> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getProposalStatus(proposalId);

        return {
          isActive: result[0],
          hasQuorum: result[1],
          isPassing: result[2],
          votesNeeded: result[3].toString(),
        };
      } catch (error: any) {
        console.error("Get proposal status failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const getAllProposals = useCallback(
    async (
      offset: number = 0,
      limit: number = 10
    ): Promise<{ proposalIds: string[]; hasMore: boolean }> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getAllProposals(offset, limit);

        return {
          proposalIds: result[0].map((id: any) => id.toString()),
          hasMore: result[1],
        };
      } catch (error: any) {
        console.error("Get all proposals failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const getActiveProposals = useCallback(async (): Promise<string[]> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getActiveProposals();
      return result.map((id: any) => id.toString());
    } catch (error: any) {
      console.error("Get active proposals failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getGovernanceSettings =
    useCallback(async (): Promise<GovernanceSettings> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getGovernanceSettings();

        return {
          proposalThreshold: result[0].toString(),
          votingPeriod: result[1].toString(),
          quorumPercentage: result[2].toString(),
          currentPenaltyRate: result[3].toString(),
          totalProposals: result[4].toString(),
        };
      } catch (error: any) {
        console.error("Get governance settings failed:", error);
        throw error;
      }
    }, [governanceAddress]);

  const getSeasonStatus = useCallback(async (): Promise<SeasonStatus> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getSeasonStatus();

      return {
        currentSeason: result[0].toString(),
        isSeasonCompleted: result[1],
        participationDeadline: result[2].toString(),
        declaredParticipants: result[3].toString(),
      };
    } catch (error: any) {
      console.error("Get season status failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getCarryOverRules = useCallback(async (): Promise<{
    carryReputation: boolean;
    carryPenalties: boolean;
  }> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getCarryOverRules();

      return {
        carryReputation: result[0],
        carryPenalties: result[1],
      };
    } catch (error: any) {
      console.error("Get carry over rules failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getMemberParticipationStatus = useCallback(
    async (memberAddress: string): Promise<boolean> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getMemberParticipationStatus(
          convertToEvmAddress(memberAddress)
        );
        return result;
      } catch (error: any) {
        console.error("Get member participation status failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const getContinuingMembersList = useCallback(async (): Promise<string[]> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getContinuingMembersList();
      return result;
    } catch (error: any) {
      console.error("Get continuing members list failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getOptOutMembersList = useCallback(async (): Promise<string[]> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getOptOutMembersList();
      return result;
    } catch (error: any) {
      console.error("Get opt out members list failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getContinuingMembersCount = useCallback(async (): Promise<number> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getContinuingMembersCount();
      return result.toNumber();
    } catch (error: any) {
      console.error("Get continuing members count failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const getVotingPower = useCallback(
    async (memberAddress: string): Promise<string> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.getVotingPower(
          convertToEvmAddress(memberAddress)
        );
        return result.toString();
      } catch (error: any) {
        console.error("Get voting power failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const hasVoted = useCallback(
    async (proposalId: number, voterAddress: string): Promise<boolean> => {
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          convertToEvmAddress(governanceAddress),
          AjoGovernanceABI.abi,
          provider
        );

        const result = await contract.hasVoted(
          proposalId,
          convertToEvmAddress(voterAddress)
        );
        return result;
      } catch (error: any) {
        console.error("Has voted check failed:", error);
        throw error;
      }
    },
    [governanceAddress]
  );

  const getHcsTopicId = useCallback(async (): Promise<string> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.getHcsTopicId();
      return result;
    } catch (error: any) {
      console.error("Get HCS topic ID failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  const verifySetup = useCallback(async (): Promise<{
    isValid: boolean;
    reason: string;
  }> => {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(
        convertToEvmAddress(governanceAddress),
        AjoGovernanceABI.abi,
        provider
      );

      const result = await contract.verifySetup();

      return {
        isValid: result[0],
        reason: result[1],
      };
    } catch (error: any) {
      console.error("Verify setup failed:", error);
      throw error;
    }
  }, [governanceAddress]);

  // Return all functions and state
  return {
    loading,
    isConnected: !!accountId,
    accountId,

    // Voting Functions
    castVote,

    // Proposal Creation
    createProposal,
    proposeNewMember,
    proposeSeasonCompletion,
    proposeNewSeasonRestart,
    proposeUpdateSeasonParameters,
    proposeCarryOverRules,

    // Proposal Management
    cancelProposal,
    executeProposal,

    // Season Participation
    declareNextSeasonParticipation,

    // View Functions
    getProposal,
    getProposalStatus,
    getAllProposals,
    getActiveProposals,
    getGovernanceSettings,
    getSeasonStatus,
    getCarryOverRules,
    getMemberParticipationStatus,
    getContinuingMembersList,
    getOptOutMembersList,
    getContinuingMembersCount,
    getVotingPower,
    hasVoted,
    getHcsTopicId,
    verifySetup,
  };
};

export default useAjoGovernance;
