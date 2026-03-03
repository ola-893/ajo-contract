/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoCollateralAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Collateral Cairo contract
 */
const useStarknetAjoCollateral = (ajoCollateralAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

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

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: RPC_URL
    });
  };

  /**
   * Calculate required collateral for a position
   */
  const calculateRequiredCollateral = useCallback(
    async (position: number, monthlyPayment: string, totalParticipants: number) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        const positionU256 = cairo.uint256(position);
        const monthlyPaymentU256 = cairo.uint256(monthlyPayment);
        const totalParticipantsU256 = cairo.uint256(totalParticipants);

        const required = await collateralContract.calculate_required_collateral(
          positionU256,
          monthlyPaymentU256,
          totalParticipantsU256
        );

        return toBigIntValue(required);
      } catch (error) {
        console.error('Error calculating required collateral:', error);
        throw error;
      }
    },
    [ajoCollateralAddress]
  );

  const calculateDebt = useCallback(
    async (memberPosition: number, monthlyPayment: string, currentCycle: number) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        const debt = await collateralContract.calculate_debt(
          cairo.uint256(memberPosition),
          cairo.uint256(monthlyPayment),
          cairo.uint256(currentCycle),
        );

        return toBigIntValue(debt);
      } catch (error) {
        console.error('Error calculating debt:', error);
        throw error;
      }
    },
    [ajoCollateralAddress],
  );

  /**
   * Deposit collateral
   */
  const depositCollateral = useCallback(
    async (amount: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        collateralContract.connect(account as any);

        const amountU256 = cairo.uint256(amount);

        const result = await collateralContract.deposit_collateral(amountU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Collateral deposited successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error depositing collateral:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress]
  );

  const depositCollateralFor = useCallback(
    async (memberAddress: string, amount: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.deposit_collateral_for(
          memberAddress,
          cairo.uint256(amount),
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error depositing collateral for member:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress],
  );

  /**
   * Withdraw collateral
   */
  const withdrawCollateral = useCallback(
    async (amount: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        collateralContract.connect(account as any);

        const amountU256 = cairo.uint256(amount);

        const result = await collateralContract.withdraw_collateral(amountU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Collateral withdrawn successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error withdrawing collateral:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress]
  );

  const withdrawCollateralFor = useCallback(
    async (memberAddress: string, amount: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.withdraw_collateral_for(
          memberAddress,
          cairo.uint256(amount),
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error withdrawing collateral for member:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress],
  );

  /**
   * Get member's collateral balance
   */
  const getMemberCollateral = useCallback(
    async (memberAddress: string) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        const collateral = await collateralContract.get_member_collateral(memberAddress);
        return toBigIntValue(collateral);
      } catch (error) {
        console.error('Error fetching member collateral:', error);
        throw error;
      }
    },
    [ajoCollateralAddress]
  );

  /**
   * Get total collateral in the system
   */
  const getTotalCollateral = useCallback(async () => {
    if (!ajoCollateralAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const collateralContract = new Contract(
        ajoCollateralAbi as any,
        ajoCollateralAddress,
        provider
      );

      const total = await collateralContract.get_total_collateral();
      return toBigIntValue(total);
    } catch (error) {
      console.error('Error fetching total collateral:', error);
      throw error;
    }
  }, [ajoCollateralAddress]);

  /**
   * Check if member's collateral is sufficient
   */
  const isCollateralSufficient = useCallback(
    async (memberAddress: string) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        const sufficient = await collateralContract.is_collateral_sufficient(memberAddress);
        return toBool(sufficient);
      } catch (error) {
        console.error('Error checking collateral sufficiency:', error);
        throw error;
      }
    },
    [ajoCollateralAddress]
  );

  const seizeCollateral = useCallback(
    async (memberAddress: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.seize_collateral(memberAddress);
        await provider.waitForTransaction(result.transaction_hash);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error seizing collateral:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress],
  );

  const calculateRecoveryAssets = useCallback(
    async (defaulterPosition: number, monthlyPayment: string, currentCycle: number) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const collateralContract = new Contract(
        ajoCollateralAbi as any,
        ajoCollateralAddress,
        provider,
      );

      const result = await collateralContract.calculate_recovery_assets(
        cairo.uint256(defaulterPosition),
        cairo.uint256(monthlyPayment),
        cairo.uint256(currentCycle),
      );
      return toBigIntValue(result);
    },
    [ajoCollateralAddress],
  );

  const getCoverageRatio = useCallback(
    async (position: number, monthlyPayment: string, totalParticipants: number) => {
      if (!ajoCollateralAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const collateralContract = new Contract(
        ajoCollateralAbi as any,
        ajoCollateralAddress,
        provider,
      );

      const ratio = await collateralContract.get_coverage_ratio(
        cairo.uint256(position),
        cairo.uint256(monthlyPayment),
        cairo.uint256(totalParticipants),
      );
      return toBigIntValue(ratio);
    },
    [ajoCollateralAddress],
  );

  const getAuthorizedCore = useCallback(async () => {
    if (!ajoCollateralAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const collateralContract = new Contract(
      ajoCollateralAbi as any,
      ajoCollateralAddress,
      provider,
    );

    const coreAddress = await collateralContract.get_authorized_core();
    if (typeof coreAddress === 'string') {
      return coreAddress.startsWith('0x')
        ? coreAddress.toLowerCase()
        : `0x${BigInt(coreAddress).toString(16)}`;
    }
    return `0x${toBigIntValue(coreAddress).toString(16)}`;
  }, [ajoCollateralAddress]);

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.set_authorized_core(coreAddress);
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
    [account, isConnected, ajoCollateralAddress],
  );

  const setPaymentsContract = useCallback(
    async (paymentsAddress: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.set_payments_contract(paymentsAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting payments contract:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress],
  );

  const setMembersContract = useCallback(
    async (membersAddress: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider,
        );

        collateralContract.connect(account as any);

        const result = await collateralContract.set_members_contract(membersAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting members contract:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress],
  );

  /**
   * Slash collateral (for defaults)
   */
  const slashCollateral = useCallback(
    async (memberAddress: string, amount: string) => {
      if (!account || !isConnected || !ajoCollateralAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const collateralContract = new Contract(
          ajoCollateralAbi as any,
          ajoCollateralAddress,
          provider
        );

        collateralContract.connect(account as any);

        const amountU256 = cairo.uint256(amount);

        const result = await collateralContract.slash_collateral(memberAddress, amountU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Collateral slashed successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error slashing collateral:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoCollateralAddress]
  );

  return {
    // View functions
    calculateRequiredCollateral,
    calculateDebt,
    getMemberCollateral,
    getTotalCollateral,
    isCollateralSufficient,
    calculateRecoveryAssets,
    getCoverageRatio,
    getAuthorizedCore,
    
    // Write functions
    setAuthorizedCore,
    depositCollateral,
    depositCollateralFor,
    withdrawCollateral,
    withdrawCollateralFor,
    slashCollateral,
    seizeCollateral,
    setPaymentsContract,
    setMembersContract,
    
    // State
    loading,
  };
};

export default useStarknetAjoCollateral;
