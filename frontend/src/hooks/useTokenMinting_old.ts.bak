/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import { useAjoFactory } from "./useAjoFactory";
import { toast } from "sonner";

const USDC_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HBAR_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_WHBAR_ADDRESS;

// ERC20 ABI for balance checking
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export const useTokenMinting = () => {
  const { accountId } = useWalletInterface();
  const [loading, setLoading] = useState(false);
  const { fundUserWithHtsTokens, associateUserWithHtsTokens } = useAjoFactory();

  const isMetaMask = accountId?.startsWith("0x");

  /**
   * Convert Hedera address to EVM format
   */
  const convertToEvmAddress = (address: string): string => {
    if (address.startsWith("0x")) return address.toLowerCase();
    const parts = address.split(".");
    if (parts.length === 3) {
      const accountNum = BigInt(parts[2]);
      return "0x" + accountNum.toString(16).padStart(40, "0").toLowerCase();
    }
    return address;
  };

  /**
   * Convert EVM address to Hedera format
   */
  const convertToHederaAddress = (address: string): string => {
    if (!address.startsWith("0x")) return address;
    try {
      const accountNum = BigInt(address);
      return `0.0.${accountNum.toString()}`;
    } catch {
      return address;
    }
  };

  /**
   * Get token balances for the connected wallet
   */
  const getTokenBalances = useCallback(async () => {
    if (!accountId) {
      throw new Error("Wallet not connected");
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
          "https://testnet.hashio.io/api"
      );

      const usdcContract = new ethers.Contract(
        USDC_TOKEN_ADDRESS,
        ERC20_ABI,
        provider
      );
      const hbarContract = new ethers.Contract(
        HBAR_TOKEN_ADDRESS,
        ERC20_ABI,
        provider
      );

      const userAddress = convertToEvmAddress(accountId);

      const [usdcBalance, hbarBalance] = await Promise.all([
        usdcContract.balanceOf(userAddress),
        hbarContract.balanceOf(userAddress),
      ]);

      return {
        usdc: ethers.utils.formatUnits(usdcBalance, 6),
        hbar: ethers.utils.formatUnits(hbarBalance, 8),
        usdcRaw: usdcBalance,
        hbarRaw: hbarBalance,
      };
    } catch (error: any) {
      console.error("Get token balances failed:", error);
      throw new Error(error.message || "Failed to get token balances");
    }
  }, [accountId]);

  /**
   * Mint tokens for the connected wallet
   * Uses the factory's fundUserWithHtsTokens function
   */
  const mintTokens = useCallback(
    async (usdcAmount: number, hbarAmount: number) => {
      if (!accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const userAddress = accountId;
        // Step 1: Associate user with HTS tokens (if not already associated)
        toast.info("Associating with HTS tokens...");
        try {
          await associateUserWithHtsTokens(userAddress);
          toast.success("Association successful!");
        } catch (assocError: any) {
          // Association might fail if already associated
          console.log(
            "Association skipped (may already be associated):",
            assocError.message
          );
        }

        // Step 2: Fund user with tokens
        toast.info("Minting tokens...");

        // Convert amounts to proper format (int64 for HTS)
        const usdcAmountInt64 = Math.floor(usdcAmount * 1_000_000); // 6 decimals
        const hbarAmountInt64 = Math.floor(hbarAmount * 100_000_000); // 8 decimals

        const txHash = await fundUserWithHtsTokens(
          userAddress,
          usdcAmountInt64,
          hbarAmountInt64
        );

        toast.success(
          `Successfully minted ${usdcAmount} USDC and ${hbarAmount} WHBAR!`
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Return updated balances
        const balances = await getTokenBalances();
        return { txHash, balances };
      } catch (error: any) {
        console.error("Mint tokens failed:", error);
        toast.error(error.message || "Failed to mint tokens");
        throw new Error(error.message || "Failed to mint tokens");
      } finally {
        setLoading(false);
      }
    },
    [
      accountId,
      isMetaMask,
      associateUserWithHtsTokens,
      fundUserWithHtsTokens,
      getTokenBalances,
    ]
  );

  /**
   * Quick mint preset amounts (1000 USDC + 1000 WHBAR)
   */
  const mintPresetTokens = useCallback(async () => {
    return mintTokens(1000, 1000);
  }, [mintTokens]);

  /**
   * Check if user is associated with HTS tokens
   */
  const checkAssociation = useCallback(async () => {
    if (!accountId) {
      throw new Error("Wallet not connected");
    }

    try {
      const balances = await getTokenBalances();
      // If we can get balances without error, user is likely associated
      // Note: A balance of 0 doesn't mean not associated
      return {
        isAssociated: true,
        balances,
      };
    } catch (error: any) {
      // If we get an error, user might not be associated
      return {
        isAssociated: false,
        balances: null,
      };
    }
  }, [accountId, getTokenBalances]);

  return {
    loading,
    mintTokens,
    mintPresetTokens,
    getTokenBalances,
    checkAssociation,
    isConnected: !!accountId,
    accountId,
  };
};
