/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { cairo, Contract, RpcProvider, shortString } from "starknet";
import { bridgeAdapterAbi } from "@/abi/placeholders";
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

export interface BridgeDepositRequestView {
  requestId: number;
  ajoId: number;
  member: string;
  amount: bigint;
  btcTxHash: string;
  status: string;
  timestamp: number;
}

export interface BridgeWithdrawalRequestView {
  requestId: number;
  ajoId: number;
  member: string;
  amount: bigint;
  btcAddress: string;
  nonce: bigint;
  status: string;
  timestamp: number;
  btcTxHash: string;
}

const useStarknetBridgeAdapter = (bridgeAdapterAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const readContract = () => {
    if (!bridgeAdapterAddress) {
      throw new Error("Bridge adapter address not available");
    }
    const provider = getProvider();
    return new Contract(bridgeAdapterAbi as any, bridgeAdapterAddress, provider);
  };

  const writeContract = () => {
    if (!account || !isConnected || !bridgeAdapterAddress) {
      throw new Error("Wallet not connected or bridge adapter address not available");
    }
    const provider = getProvider();
    const contract = new Contract(
      bridgeAdapterAbi as any,
      bridgeAdapterAddress,
      provider,
    );
    contract.connect(account as any);
    return { contract, provider };
  };

  const getAuthorizedCore = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_authorized_core();
    return toAddress(result);
  }, [bridgeAdapterAddress]);

  const getBridgeRelayer = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_bridge_relayer();
    return toAddress(result);
  }, [bridgeAdapterAddress]);

  const getRequestStatus = useCallback(
    async (requestId: number): Promise<string> => {
      const contract = readContract();
      const requestIdU256 = cairo.uint256(requestId);
      const result = await contract.get_request_status(requestIdU256);
      return parseEnum(result, "Pending");
    },
    [bridgeAdapterAddress],
  );

  const getDepositRequest = useCallback(
    async (requestId: number): Promise<BridgeDepositRequestView> => {
      const contract = readContract();
      const requestIdU256 = cairo.uint256(requestId);
      const result = await contract.get_deposit_request(requestIdU256);
      return {
        requestId: Number(toBigIntValue(result?.request_id)),
        ajoId: Number(toBigIntValue(result?.ajo_id)),
        member: toAddress(result?.member),
        amount: toBigIntValue(result?.amount),
        btcTxHash: String(result?.btc_tx_hash ?? "0x0"),
        status: parseEnum(result?.status, "Pending"),
        timestamp: Number(result?.timestamp ?? 0),
      };
    },
    [bridgeAdapterAddress],
  );

  const getWithdrawalRequest = useCallback(
    async (requestId: number): Promise<BridgeWithdrawalRequestView> => {
      const contract = readContract();
      const requestIdU256 = cairo.uint256(requestId);
      const result = await contract.get_withdrawal_request(requestIdU256);
      return {
        requestId: Number(toBigIntValue(result?.request_id)),
        ajoId: Number(toBigIntValue(result?.ajo_id)),
        member: toAddress(result?.member),
        amount: toBigIntValue(result?.amount),
        btcAddress: String(result?.btc_address ?? "0x0"),
        nonce: toBigIntValue(result?.nonce),
        status: parseEnum(result?.status, "Pending"),
        timestamp: Number(result?.timestamp ?? 0),
        btcTxHash: String(result?.btc_tx_hash ?? "0x0"),
      };
    },
    [bridgeAdapterAddress],
  );

  const withWrite = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  const registerDeposit = useCallback(
    async (params: {
      ajoId: number;
      member: string;
      amount: bigint;
      btcTxHash: string;
      proof?: string[];
    }) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.register_deposit(
          cairo.uint256(params.ajoId),
          params.member,
          cairo.uint256(params.amount.toString()),
          parseFeltInput(params.btcTxHash),
          params.proof ?? [],
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const finalizeDeposit = useCallback(
    async (requestId: number) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.finalize_deposit(cairo.uint256(requestId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const requestWithdrawal = useCallback(
    async (params: { ajoId: number; amount: bigint; btcAddress: string }) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.request_withdrawal(
          cairo.uint256(params.ajoId),
          cairo.uint256(params.amount.toString()),
          parseFeltInput(params.btcAddress),
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const finalizeWithdrawal = useCallback(
    async (requestId: number, btcTxHash: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.finalize_withdrawal(
          cairo.uint256(requestId),
          parseFeltInput(btcTxHash),
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const cancelWithdrawal = useCallback(
    async (requestId: number) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.cancel_withdrawal(cairo.uint256(requestId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const setBridgeRelayer = useCallback(
    async (relayer: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_bridge_relayer(relayer);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const emergencyPause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.emergency_pause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  const unpause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.unpause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, bridgeAdapterAddress],
  );

  return {
    loading,
    getAuthorizedCore,
    getBridgeRelayer,
    getRequestStatus,
    getDepositRequest,
    getWithdrawalRequest,
    setAuthorizedCore,
    registerDeposit,
    finalizeDeposit,
    requestWithdrawal,
    finalizeWithdrawal,
    cancelWithdrawal,
    setBridgeRelayer,
    emergencyPause,
    unpause,
  };
};

export default useStarknetBridgeAdapter;
