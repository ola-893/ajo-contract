/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoPaymentsAbi } from '@/abi/placeholders';

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4';

const toBigIntValue = (value: any): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    if (!value.trim()) return 0n;
    return BigInt(value);
  }
  if (typeof value === 'object' && 'low' in value) {
    const low = BigInt((value as any).low ?? 0);
    const high = BigInt((value as any).high ?? 0);
    return low + (high << 128n);
  }
  if (typeof value?.toString === 'function') {
    const text = value.toString();
    if (!text || text === '[object Object]') return 0n;
    return BigInt(text);
  }
  return 0n;
};

const toBool = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value === 'true';
  if (typeof value === 'object' && value !== null) {
    if ('True' in value || 'true' in value) return true;
    if ('False' in value || 'false' in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const toAddress = (value: any): string => {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value.toLowerCase();
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }
  return `0x${toBigIntValue(value).toString(16)}`;
};

/**
 * Hook for interacting with Ajo Payments Cairo contract
 */
const useStarknetAjoPayments = (ajoPaymentsAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () =>
    new RpcProvider({
      nodeUrl: RPC_URL,
    });

  const getAuthorizedCore = useCallback(async (): Promise<string> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const result = await paymentsContract.get_authorized_core();
    return toAddress(result);
  }, [ajoPaymentsAddress]);

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting authorized core:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  /**
   * Make a payment for a cycle
   */
  const makePayment = useCallback(
    async (cycle: number, amount: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);
        const amountU256 = cairo.uint256(amount);

        const result = await paymentsContract.make_payment(cycleU256, amountU256);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error making payment:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  /**
   * Distribute payout to recipient for a cycle
   */
  const distributePayout = useCallback(
    async (cycle: number, recipient: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);

        const result = await paymentsContract.distribute_payout(cycleU256, recipient);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error distributing payout:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  /**
   * Get current cycle
   */
  const getCurrentCycle = useCallback(async (): Promise<number> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      const cycle = await paymentsContract.get_current_cycle();
      return Number(toBigIntValue(cycle));
    } catch (error) {
      console.error('Error fetching current cycle:', error);
      throw error;
    }
  }, [ajoPaymentsAddress]);

  /**
   * Check if member has paid for a cycle
   */
  const hasPaidForCycle = useCallback(
    async (memberAddress: string, cycle: number): Promise<boolean> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        const cycleU256 = cairo.uint256(cycle);

        const hasPaid = await paymentsContract.has_paid_for_cycle(memberAddress, cycleU256);
        return toBool(hasPaid);
      } catch (error) {
        console.error('Error checking payment status:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress],
  );

  /**
   * Get total amount paid by member
   */
  const getTotalPaid = useCallback(
    async (memberAddress: string): Promise<bigint> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        const total = await paymentsContract.get_total_paid(memberAddress);
        return toBigIntValue(total);
      } catch (error) {
        console.error('Error fetching total paid:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress],
  );

  /**
   * Get cycle contributions
   */
  const getCycleContributions = useCallback(
    async (cycle: number): Promise<bigint> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        const cycleU256 = cairo.uint256(cycle);
        const contributions = await paymentsContract.get_cycle_contributions(cycleU256);
        return toBigIntValue(contributions);
      } catch (error) {
        console.error('Error fetching cycle contributions:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress],
  );

  /**
   * Get payout recipient for a cycle
   */
  const getPayoutRecipient = useCallback(
    async (cycle: number): Promise<string> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        const cycleU256 = cairo.uint256(cycle);
        const recipient = await paymentsContract.get_payout_recipient(cycleU256);
        return toAddress(recipient);
      } catch (error) {
        console.error('Error fetching payout recipient:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress],
  );

  const getCycleStartTime = useCallback(async (): Promise<number> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const time = await paymentsContract.get_cycle_start_time();
    return Number(time ?? 0);
  }, [ajoPaymentsAddress]);

  const getNextPayoutPosition = useCallback(async (): Promise<number> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const position = await paymentsContract.get_next_payout_position();
    return Number(toBigIntValue(position));
  }, [ajoPaymentsAddress]);

  const calculatePayoutAmount = useCallback(
    async (cycle: number): Promise<bigint> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      const cycleU256 = cairo.uint256(cycle);
      const amount = await paymentsContract.calculate_payout_amount(cycleU256);
      return toBigIntValue(amount);
    },
    [ajoPaymentsAddress],
  );

  const isDefaulted = useCallback(
    async (memberAddress: string): Promise<boolean> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      const result = await paymentsContract.is_defaulted(memberAddress);
      return toBool(result);
    },
    [ajoPaymentsAddress],
  );

  const getPaymentToken = useCallback(async (): Promise<string> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const token = await paymentsContract.get_payment_token();
    return toAddress(token);
  }, [ajoPaymentsAddress]);

  const getSwapRouter = useCallback(async (): Promise<string> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const router = await paymentsContract.get_swap_router();
    return toAddress(router);
  }, [ajoPaymentsAddress]);

  const isSwapEnabled = useCallback(async (): Promise<boolean> => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const paymentsContract = new Contract(
      ajoPaymentsAbi as any,
      ajoPaymentsAddress,
      provider,
    );

    const enabled = await paymentsContract.is_swap_enabled();
    return toBool(enabled);
  }, [ajoPaymentsAddress]);

  const getTokenPreference = useCallback(
    async (memberAddress: string): Promise<string> => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      const token = await paymentsContract.get_token_preference(memberAddress);
      return toAddress(token);
    },
    [ajoPaymentsAddress],
  );

  const makePaymentFor = useCallback(
    async (memberAddress: string, cycle: number, amount: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.make_payment_for(
          memberAddress,
          cairo.uint256(cycle),
          cairo.uint256(amount),
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error making payment for member:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const startCycle = useCallback(
    async (cycleNumber: number) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.start_cycle(cairo.uint256(cycleNumber));
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error starting cycle:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const endCycle = useCallback(
    async (cycleNumber: number) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.end_cycle(cairo.uint256(cycleNumber));
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error ending cycle:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const markDefault = useCallback(
    async (memberAddress: string, cycle: number) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.mark_default(
          memberAddress,
          cairo.uint256(cycle),
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error marking member default:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const seizePastPayments = useCallback(
    async (memberAddress: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.seize_past_payments(memberAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error seizing past payments:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const setSwapRouter = useCallback(
    async (routerAddress: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.set_swap_router(routerAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting swap router:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  const enableSwap = useCallback(async () => {
    if (!account || !isConnected || !ajoPaymentsAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      paymentsContract.connect(account as any);

      const result = await paymentsContract.enable_swap();
      await provider.waitForTransaction(result.transaction_hash);

      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error enabling swap:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoPaymentsAddress]);

  const disableSwap = useCallback(async () => {
    if (!account || !isConnected || !ajoPaymentsAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      paymentsContract.connect(account as any);

      const result = await paymentsContract.disable_swap();
      await provider.waitForTransaction(result.transaction_hash);

      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error disabling swap:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoPaymentsAddress]);

  const setTokenPreference = useCallback(
    async (tokenAddress: string) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider,
        );

        paymentsContract.connect(account as any);

        const result = await paymentsContract.set_token_preference(tokenAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting token preference:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoPaymentsAddress],
  );

  /**
   * Advance to next cycle
   */
  const advanceCycle = useCallback(async () => {
    if (!account || !isConnected || !ajoPaymentsAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    setLoading(true);
    try {
      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider,
      );

      paymentsContract.connect(account as any);

      const result = await paymentsContract.advance_cycle();
      await provider.waitForTransaction(result.transaction_hash);

      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error advancing cycle:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoPaymentsAddress]);

  return {
    // View functions
    getCurrentCycle,
    getAuthorizedCore,
    getCycleStartTime,
    getNextPayoutPosition,
    hasPaidForCycle,
    getTotalPaid,
    getCycleContributions,
    getPayoutRecipient,
    calculatePayoutAmount,
    isDefaulted,
    getPaymentToken,
    getSwapRouter,
    isSwapEnabled,
    getTokenPreference,

    // Write functions
    makePayment,
    setAuthorizedCore,
    makePaymentFor,
    distributePayout,
    advanceCycle,
    startCycle,
    endCycle,
    markDefault,
    seizePastPayments,
    setSwapRouter,
    enableSwap,
    disableSwap,
    setTokenPreference,

    // State
    loading,
  };
};

export default useStarknetAjoPayments;
