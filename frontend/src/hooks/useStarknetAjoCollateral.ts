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

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
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
        
        console.log('Required collateral:', required);
        return required;
      } catch (error) {
        console.error('Error calculating required collateral:', error);
        throw error;
      }
    },
    [ajoCollateralAddress]
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
        
        console.log('Member collateral:', collateral);
        return collateral;
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
      
      console.log('Total collateral:', total);
      return total;
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
        
        console.log('Is collateral sufficient:', sufficient);
        return sufficient;
      } catch (error) {
        console.error('Error checking collateral sufficiency:', error);
        throw error;
      }
    },
    [ajoCollateralAddress]
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
    getMemberCollateral,
    getTotalCollateral,
    isCollateralSufficient,
    
    // Write functions
    depositCollateral,
    withdrawCollateral,
    slashCollateral,
    
    // State
    loading,
  };
};

export default useStarknetAjoCollateral;
