/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { CairoCustomEnum, Contract, RpcProvider, cairo } from "starknet";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { ajoCoreAbi } from "@/abi/placeholders";

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

const parseEnum = (value: any, fallback: string): string => {
  if (!value || typeof value !== "object") return fallback;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : fallback;
};

/**
 * Hook for interacting with a specific Ajo Core Cairo contract
 * This handles the main Ajo logic for a specific group
 */
const useStarknetAjoCore = (ajoCoreAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const RPC_URL =
    import.meta.env.VITE_STARKNET_RPC_URL ||
    "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4";

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: RPC_URL
    });
  };

  const getReadContract = () => {
    if (!ajoCoreAddress) {
      throw new Error("Contract address not available");
    }

    const provider = getProvider();
    return new Contract(ajoCoreAbi as any, ajoCoreAddress, provider);
  };

  const getWriteContract = () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error("Wallet not connected or contract address not available");
    }

    const provider = getProvider();
    const contract = new Contract(ajoCoreAbi as any, ajoCoreAddress, provider);
    contract.connect(account as any);
    return { contract, provider };
  };

  /**
   * Get Ajo configuration
   */
  const getConfig = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();
      const config = await ajoCoreContract.get_config();

      console.log("Ajo config:", config);
      return config;
    } catch (error) {
      console.error("Error fetching Ajo config:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Get current cycle number
   */
  const getCurrentCycle = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();
      const cycle = await ajoCoreContract.get_current_cycle();

      console.log("Current cycle:", cycle);
      return cycle;
    } catch (error) {
      console.error("Error fetching current cycle:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Get Ajo status
   */
  const getAjoStatus = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();
      const status = await ajoCoreContract.get_ajo_status();

      console.log("Ajo status:", status);
      return status;
    } catch (error) {
      console.error("Error fetching Ajo status:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Get member info from core contract
   */
  const getMemberInfo = useCallback(
    async (memberAddress: string) => {
      try {
        const ajoCoreContract = getReadContract();
        const memberInfo = await ajoCoreContract.get_member_info(memberAddress);
        console.log("Member info:", memberInfo);
        return memberInfo;
      } catch (error) {
        console.error("Error fetching member info:", error);
        throw error;
      }
    },
    [ajoCoreAddress],
  );

  /**
   * Check if Ajo is active
   */
  const isActive = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();
      const active = await ajoCoreContract.is_active();

      console.log("Is active:", active);
      return active;
    } catch (error) {
      console.error("Error checking if active:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  const getCycleInfo = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();
      const cycleInfo = await ajoCoreContract.get_cycle_info();
      return cycleInfo;
    } catch (error) {
      console.error("Error fetching cycle info:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  const getAdvancedFeatures = useCallback(async () => {
    try {
      const ajoCoreContract = getReadContract();

      const [
        bridgeAdapter,
        bridgeEnabled,
        swapRouter,
        swapEnabled,
        btcCollateralAdapter,
        btcCommitmentEnabled,
        collateralMode,
      ] = await Promise.all([
        ajoCoreContract.get_bridge_adapter(),
        ajoCoreContract.is_bridge_enabled(),
        ajoCoreContract.get_swap_router(),
        ajoCoreContract.is_swap_enabled(),
        ajoCoreContract.get_btc_collateral_adapter(),
        ajoCoreContract.is_btc_commitment_enabled(),
        ajoCoreContract.get_collateral_mode(),
      ]);

      return {
        bridgeAdapter: toAddress(bridgeAdapter),
        bridgeEnabled: toBool(bridgeEnabled),
        swapRouter: toAddress(swapRouter),
        swapEnabled: toBool(swapEnabled),
        btcCollateralAdapter: toAddress(btcCollateralAdapter),
        btcCommitmentEnabled: toBool(btcCommitmentEnabled),
        collateralMode: parseEnum(collateralMode, "L2Escrow"),
      };
    } catch (error) {
      console.error("Error fetching advanced feature status:", error);
      throw error;
    }
  }, [ajoCoreAddress]);

  const getModuleAddresses = useCallback(async () => {
    const ajoCoreContract = getReadContract();
    const [membersAddress, collateralAddress, paymentsAddress, governanceAddress, scheduleAddress] =
      await Promise.all([
        ajoCoreContract.get_members_address(),
        ajoCoreContract.get_collateral_address(),
        ajoCoreContract.get_payments_address(),
        ajoCoreContract.get_governance_address(),
        ajoCoreContract.get_schedule_address(),
      ]);

    return {
      membersAddress: toAddress(membersAddress),
      collateralAddress: toAddress(collateralAddress),
      paymentsAddress: toAddress(paymentsAddress),
      governanceAddress: toAddress(governanceAddress),
      scheduleAddress: toAddress(scheduleAddress),
    };
  }, [ajoCoreAddress]);

  const getPaymentTokenConfig = useCallback(async () => {
    const ajoCoreContract = getReadContract();
    const [tokenAddress, tokenDecimals] = await Promise.all([
      ajoCoreContract.get_payment_token_address(),
      ajoCoreContract.get_payment_token_decimals(),
    ]);

    return {
      tokenAddress: toAddress(tokenAddress),
      tokenDecimals: Number(tokenDecimals ?? 0),
    };
  }, [ajoCoreAddress]);

  const withWrite = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  const setPaymentTokenAddress = useCallback(
    async (tokenAddress: string, decimals: number) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.set_payment_token_address(tokenAddress, decimals);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const setBridgeAdapter = useCallback(
    async (bridgeAdapter: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.set_bridge_adapter(bridgeAdapter);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const enableBridge = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.enable_bridge();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const disableBridge = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.disable_bridge();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const setSwapRouter = useCallback(
    async (swapRouter: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.set_swap_router(swapRouter);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const enableSwap = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.enable_swap();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const disableSwap = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.disable_swap();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const setBtcCollateralAdapter = useCallback(
    async (adapter: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.set_btc_collateral_adapter(adapter);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const enableBtcCommitment = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.enable_btc_commitment();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const disableBtcCommitment = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.disable_btc_commitment();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const setCollateralMode = useCallback(
    async (mode: "L2Escrow" | "BTCCommitment") =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const modeEnum =
          mode === "BTCCommitment"
            ? new CairoCustomEnum({ BTCCommitment: {} })
            : new CairoCustomEnum({ L2Escrow: {} });
        const tx = await contract.set_collateral_mode(modeEnum);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const emergencyDisableBridge = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.emergency_disable_bridge();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const emergencyDisableSwap = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.emergency_disable_swap();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const emergencyDisableBtcCollateral = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.emergency_disable_btc_collateral();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const pause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.pause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const unpause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.unpause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  /**
   * Join Ajo group
   */
  const joinAjo = useCallback(
    async (tokenIndex: number) => {
      if (!account || !isConnected || !ajoCoreAddress) {
        throw new Error("Wallet not connected or contract address not available");
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const ajoCoreContract = new Contract(
          ajoCoreAbi as any,
          ajoCoreAddress,
          provider,
        );

        ajoCoreContract.connect(account as any);

        const tokenIndexU256 = cairo.uint256(tokenIndex);
        const result = await ajoCoreContract.join_ajo(tokenIndexU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log("Joined Ajo successfully:", result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error("Error joining Ajo:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCoreAddress],
  );

  /**
   * Manual start is disabled.
   * Ajo now starts automatically when membership is full.
   */
  const startAjo = useCallback(async () => {
    throw new Error("Ajo starts automatically when full; manual start is disabled");
  }, []);

  /**
   * Process payment for current cycle
   */
  const processPayment = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error("Wallet not connected or contract address not available");
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      ajoCoreContract.connect(account as any);

      const result = await ajoCoreContract.process_payment();
      await provider.waitForTransaction(result.transaction_hash);

      console.log("Payment processed successfully:", result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error("Error processing payment:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoCoreAddress]);

  const processCycle = useCallback(
    async (cycleNumber: number) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.process_cycle(cairo.uint256(cycleNumber));
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  const handleDefault = useCallback(
    async (defaulterAddress: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteContract();
        const tx = await contract.handle_default(defaulterAddress);
        await provider.waitForTransaction(tx.transaction_hash);
        return { transactionHash: tx.transaction_hash, success: true };
      }),
    [account, isConnected, ajoCoreAddress],
  );

  /**
   * Exit from the Ajo
   */
  const exitAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error("Wallet not connected or contract address not available");
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      ajoCoreContract.connect(account as any);

      const result = await ajoCoreContract.exit_ajo();
      await provider.waitForTransaction(result.transaction_hash);

      console.log("Exited Ajo successfully:", result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error("Error exiting Ajo:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoCoreAddress]);

  /**
   * Finalize Ajo (complete all cycles)
   */
  const finalizeAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error("Wallet not connected or contract address not available");
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      ajoCoreContract.connect(account as any);

      const result = await ajoCoreContract.finalize_ajo();
      await provider.waitForTransaction(result.transaction_hash);

      console.log("Ajo finalized successfully:", result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error("Error finalizing Ajo:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoCoreAddress]);

  return {
    // View functions
    getConfig,
    getCurrentCycle,
    getAjoStatus,
    getMemberInfo,
    getCycleInfo,
    getAdvancedFeatures,
    isActive,
    
    // Advanced view functions
    getModuleAddresses,
    getPaymentTokenConfig,

    // Write functions
    joinAjo,
    startAjo,
    processPayment,
    processCycle,
    handleDefault,
    exitAjo,
    finalizeAjo,
    setPaymentTokenAddress,
    setBridgeAdapter,
    enableBridge,
    disableBridge,
    setSwapRouter,
    enableSwap,
    disableSwap,
    setBtcCollateralAdapter,
    enableBtcCommitment,
    disableBtcCommitment,
    setCollateralMode,
    emergencyDisableBridge,
    emergencyDisableSwap,
    emergencyDisableBtcCollateral,
    pause,
    unpause,
    
    // State
    loading,
  };
};

export default useStarknetAjoCore;
