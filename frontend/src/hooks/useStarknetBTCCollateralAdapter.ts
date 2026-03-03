/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { cairo, Contract, RpcProvider, shortString } from "starknet";
import { btcCollateralAdapterAbi } from "@/abi/placeholders";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4";

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

const parseEnum = (value: any, fallback: string): string => {
  if (!value || typeof value !== "object") return fallback;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : fallback;
};

const parseFeltInput = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "0x0";
  if (trimmed.startsWith("0x")) return trimmed;
  if (trimmed.length > 31) {
    throw new Error("felt252 string input must be <= 31 chars");
  }
  return shortString.encodeShortString(trimmed);
};

export interface BTCCommitmentView {
  commitmentId: number;
  member: string;
  ajoId: number;
  amount: bigint;
  btcScriptHash: string;
  proofReference: string;
  status: string;
  registeredAt: number;
  enforcementTxHash: string;
}

const useStarknetBTCCollateralAdapter = (adapterAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const readContract = () => {
    if (!adapterAddress) {
      throw new Error("BTC collateral adapter address not available");
    }
    const provider = getProvider();
    return new Contract(btcCollateralAdapterAbi as any, adapterAddress, provider);
  };

  const writeContract = () => {
    if (!account || !isConnected || !adapterAddress) {
      throw new Error(
        "Wallet not connected or BTC collateral adapter address not available",
      );
    }
    const provider = getProvider();
    const contract = new Contract(btcCollateralAdapterAbi as any, adapterAddress, provider);
    contract.connect(account as any);
    return { contract, provider };
  };

  const getAuthorizedCore = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_authorized_core();
    return toAddress(result);
  }, [adapterAddress]);

  const getOpCatVerifier = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_op_cat_verifier();
    return toAddress(result);
  }, [adapterAddress]);

  const getMemberCommitment = useCallback(
    async (member: string): Promise<number> => {
      const contract = readContract();
      const result = await contract.get_member_commitment(member);
      return Number(toBigIntValue(result));
    },
    [adapterAddress],
  );

  const getCommitmentStatus = useCallback(
    async (commitmentId: number): Promise<string> => {
      const contract = readContract();
      const result = await contract.get_commitment_status(cairo.uint256(commitmentId));
      return parseEnum(result, "Registered");
    },
    [adapterAddress],
  );

  const getCommitment = useCallback(
    async (commitmentId: number): Promise<BTCCommitmentView> => {
      const contract = readContract();
      const result = await contract.get_commitment(cairo.uint256(commitmentId));
      return {
        commitmentId: Number(toBigIntValue(result?.commitment_id)),
        member: toAddress(result?.member),
        ajoId: Number(toBigIntValue(result?.ajo_id)),
        amount: toBigIntValue(result?.amount),
        btcScriptHash: String(result?.btc_script_hash ?? "0x0"),
        proofReference: String(result?.proof_reference ?? "0x0"),
        status: parseEnum(result?.status, "Registered"),
        registeredAt: Number(result?.registered_at ?? 0),
        enforcementTxHash: String(result?.enforcement_tx_hash ?? "0x0"),
      };
    },
    [adapterAddress],
  );

  const withWrite = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  const registerCommitment = useCallback(
    async (params: {
      ajoId: number;
      member: string;
      amount: bigint;
      btcScriptHash: string;
      proof?: string[];
    }) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.register_commitment(
          cairo.uint256(params.ajoId),
          params.member,
          cairo.uint256(params.amount.toString()),
          parseFeltInput(params.btcScriptHash),
          params.proof ?? [],
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const verifyCommitment = useCallback(
    async (commitmentId: number, verificationProof: string[] = []) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.verify_commitment(
          cairo.uint256(commitmentId),
          verificationProof,
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const startEnforcement = useCallback(
    async (commitmentId: number, defaultProof: string[] = []) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.start_enforcement(
          cairo.uint256(commitmentId),
          defaultProof,
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const confirmEnforcement = useCallback(
    async (commitmentId: number, btcTxHash: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.confirm_enforcement(
          cairo.uint256(commitmentId),
          parseFeltInput(btcTxHash),
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const releaseCommitment = useCallback(
    async (commitmentId: number) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.release_commitment(cairo.uint256(commitmentId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const setOpCatVerifier = useCallback(
    async (verifier: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_op_cat_verifier(verifier);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const emergencyPause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.emergency_pause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  const unpause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.unpause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, adapterAddress],
  );

  return {
    loading,
    getAuthorizedCore,
    getOpCatVerifier,
    getMemberCommitment,
    getCommitmentStatus,
    getCommitment,
    setAuthorizedCore,
    registerCommitment,
    verifyCommitment,
    startEnforcement,
    confirmEnforcement,
    releaseCommitment,
    setOpCatVerifier,
    emergencyPause,
    unpause,
  };
};

export default useStarknetBTCCollateralAdapter;
