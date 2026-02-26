import { useState, useEffect } from "react";
import { Contract, RpcProvider, ProviderInterface } from "starknet";
import { TOKEN_ADDRESSES } from "@/config/constants";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [
      {
        name: "account",
        type: "felt",
      },
    ],
    outputs: [
      {
        name: "balance",
        type: "Uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [
      {
        name: "decimals",
        type: "felt",
      },
    ],
    stateMutability: "view",
  },
];

interface TokenBalance {
  raw: string;
  formatted: string;
  decimals: number;
}

export const useTokenBalance = (tokenSymbol: "STRK" | "USDC" | "ETH") => {
  const { account, address } = useStarknetWallet();

  const [balance, setBalance] = useState<TokenBalance>({
    raw: "0",
    formatted: "0.00",
    decimals: 18,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!address || !account) {
      setBalance({ raw: "0", formatted: "0.00", decimals: 18 });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new RpcProvider({
        nodeUrl:
          "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4",
      });

      // Get token address
      const tokenAddress = TOKEN_ADDRESSES.sepolia[tokenSymbol];

      console.log(
        `Fetching ${tokenSymbol} balance for ${address} from ${tokenAddress}`,
      );

      if (!tokenAddress) {
        throw new Error(`Token address not found for ${tokenSymbol}`);
      }

      // Create contract instance
      const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

      console.log(`${tokenSymbol} - Calling contract methods...`);

      // Fetch balance and decimals with timeout
      const balancePromise = tokenContract.balanceOf(address);
      const decimalsPromise = tokenContract.decimals();

      const [balanceResult, decimalsResult] = (await Promise.race([
        Promise.all([balancePromise, decimalsPromise]),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timeout after 10s")),
            10000,
          ),
        ),
      ])) as any;

      console.log(`${tokenSymbol} - Balance result:`, balanceResult);
      console.log(`${tokenSymbol} - Decimals result:`, decimalsResult);

      // Parse balance - handle different return formats
      let rawBalance: bigint;
      if (typeof balanceResult === "bigint") {
        rawBalance = balanceResult;
      } else if (balanceResult.balance !== undefined) {
        rawBalance = BigInt(balanceResult.balance);
      } else if (balanceResult.low !== undefined) {
        // Old Uint256 format: { low, high }
        const balanceLow = BigInt(balanceResult.low || 0);
        const balanceHigh = BigInt(balanceResult.high || 0);
        rawBalance = balanceLow + (balanceHigh << 128n);
      } else {
        rawBalance = BigInt(balanceResult[0] || 0);
      }

      // Get decimals - handle different return formats
      let decimals: number;
      if (typeof decimalsResult === "bigint") {
        decimals = Number(decimalsResult);
      } else if (decimalsResult.decimals !== undefined) {
        decimals = Number(decimalsResult.decimals);
      } else {
        decimals = Number(decimalsResult);
      }

      console.log(`${tokenSymbol} - Raw balance:`, rawBalance.toString());
      console.log(`${tokenSymbol} - Decimals:`, decimals);

      // Format balance
      const divisor = BigInt(10 ** decimals);
      const formattedBalance = (Number(rawBalance) / Number(divisor)).toFixed(
        2,
      );

      console.log(`${tokenSymbol} - Formatted balance:`, formattedBalance);

      setBalance({
        raw: rawBalance.toString(),
        formatted: formattedBalance,
        decimals,
      });
    } catch (err) {
      console.error(`Error fetching ${tokenSymbol} balance:`, err);
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
      setBalance({ raw: "0", formatted: "0.00", decimals: 18 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [address, tokenSymbol]);

  return {
    balance,
    loading,
    error,
    refetch: fetchBalance,
  };
};
