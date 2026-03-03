/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { cairo, Contract, RpcProvider } from "starknet";
import { swapRouterAbi } from "@/abi/placeholders";
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

export interface SwapRequestView {
  requestId: number;
  ajoId: number;
  requester: string;
  recipient: string;
  sourceToken: string;
  destToken: string;
  sourceAmount: bigint;
  minDestAmount: bigint;
  deadline: number;
  status: string;
  actualDestAmount: bigint;
  createdAt: number;
}

const useStarknetSwapRouter = (swapRouterAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const readContract = () => {
    if (!swapRouterAddress) {
      throw new Error("Swap router address not available");
    }
    const provider = getProvider();
    return new Contract(swapRouterAbi as any, swapRouterAddress, provider);
  };

  const writeContract = () => {
    if (!account || !isConnected || !swapRouterAddress) {
      throw new Error("Wallet not connected or swap router address not available");
    }
    const provider = getProvider();
    const contract = new Contract(swapRouterAbi as any, swapRouterAddress, provider);
    contract.connect(account as any);
    return { contract, provider };
  };

  const getAuthorizedExecutor = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_authorized_executor();
    return toAddress(result);
  }, [swapRouterAddress]);

  const getDexRouter = useCallback(async () => {
    const contract = readContract();
    const result = await contract.get_dex_router();
    return toAddress(result);
  }, [swapRouterAddress]);

  const getQuote = useCallback(
    async (sourceToken: string, destToken: string, amount: bigint) => {
      const contract = readContract();
      const result = await contract.get_quote(
        sourceToken,
        destToken,
        cairo.uint256(amount.toString()),
      );
      return toBigIntValue(result);
    },
    [swapRouterAddress],
  );

  const getSwapStatus = useCallback(
    async (requestId: number): Promise<string> => {
      const contract = readContract();
      const result = await contract.get_swap_status(cairo.uint256(requestId));
      return parseEnum(result, "Pending");
    },
    [swapRouterAddress],
  );

  const getSwapRequest = useCallback(
    async (requestId: number): Promise<SwapRequestView> => {
      const contract = readContract();
      const result = await contract.get_swap_request(cairo.uint256(requestId));
      return {
        requestId: Number(toBigIntValue(result?.request_id)),
        ajoId: Number(toBigIntValue(result?.ajo_id)),
        requester: toAddress(result?.requester),
        recipient: toAddress(result?.recipient),
        sourceToken: toAddress(result?.source_token),
        destToken: toAddress(result?.dest_token),
        sourceAmount: toBigIntValue(result?.source_amount),
        minDestAmount: toBigIntValue(result?.min_dest_amount),
        deadline: Number(result?.deadline ?? 0),
        status: parseEnum(result?.status, "Pending"),
        actualDestAmount: toBigIntValue(result?.actual_dest_amount),
        createdAt: Number(result?.created_at ?? 0),
      };
    },
    [swapRouterAddress],
  );

  const withWrite = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = useCallback(
    async (params: {
      ajoId: number;
      recipient: string;
      sourceToken: string;
      destToken: string;
      sourceAmount: bigint;
      minDestAmount: bigint;
      deadline: number;
    }) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.execute_swap(
          cairo.uint256(params.ajoId),
          params.recipient,
          params.sourceToken,
          params.destToken,
          cairo.uint256(params.sourceAmount.toString()),
          cairo.uint256(params.minDestAmount.toString()),
          params.deadline,
        );
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, swapRouterAddress],
  );

  const cancelSwap = useCallback(
    async (requestId: number) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.cancel_swap(cairo.uint256(requestId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, swapRouterAddress],
  );

  const setAuthorizedExecutor = useCallback(
    async (executor: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_authorized_executor(executor);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, swapRouterAddress],
  );

  const setDexRouter = useCallback(
    async (router: string) =>
      withWrite(async () => {
        const { contract, provider } = writeContract();
        const tx = await contract.set_dex_router(router);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected, swapRouterAddress],
  );

  return {
    loading,
    getAuthorizedExecutor,
    getDexRouter,
    getQuote,
    getSwapStatus,
    getSwapRequest,
    executeSwap,
    cancelSwap,
    setAuthorizedExecutor,
    setDexRouter,
  };
};

export default useStarknetSwapRouter;
