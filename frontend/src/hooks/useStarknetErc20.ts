/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { Contract, RpcProvider, cairo } from "starknet";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { erc20Abi } from "@/abi/placeholders";

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

const useStarknetErc20 = (tokenAddress: string) => {
  const { account, isConnected, address } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const getAllowance = useCallback(
    async (owner: string, spender: string): Promise<bigint> => {
      if (!tokenAddress) throw new Error("Token address not available");
      const provider = getProvider();
      const token = new Contract(erc20Abi as any, tokenAddress, provider);
      const allowance = await token.allowance(owner, spender);
      return toBigIntValue(allowance);
    },
    [tokenAddress],
  );

  const approve = useCallback(
    async (spender: string, amount: bigint) => {
      if (!account || !isConnected || !tokenAddress || !address) {
        throw new Error("Wallet not connected or token address unavailable");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const token = new Contract(erc20Abi as any, tokenAddress, provider);
        token.connect(account as any);

        const amountU256 = cairo.uint256(amount.toString());
        const tx = await token.approve(spender, amountU256);
        await provider.waitForTransaction(tx.transaction_hash);

        return {
          transactionHash: tx.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error approving token allowance:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, tokenAddress, address],
  );

  return {
    getAllowance,
    approve,
    loading,
  };
};

export default useStarknetErc20;
