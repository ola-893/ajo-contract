/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoPaymentsAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Payments Cairo contract
 */
const useStarknetAjoPayments = (ajoPaymentsAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
    });
  };

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
          provider
        );

        paymentsContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);
        const amountU256 = cairo.uint256(amount);

        const result = await paymentsContract.make_payment(cycleU256, amountU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Payment made successfully:', result);
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
    [account, isConnected, ajoPaymentsAddress]
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
          provider
        );

        paymentsContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);

        const result = await paymentsContract.distribute_payout(cycleU256, recipient);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Payout distributed successfully:', result);
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
    [account, isConnected, ajoPaymentsAddress]
  );

  /**
   * Get current cycle
   */
  const getCurrentCycle = useCallback(async () => {
    if (!ajoPaymentsAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const paymentsContract = new Contract(
        ajoPaymentsAbi as any,
        ajoPaymentsAddress,
        provider
      );

      const cycle = await paymentsContract.get_current_cycle();
      
      console.log('Current cycle:', cycle);
      return cycle;
    } catch (error) {
      console.error('Error fetching current cycle:', error);
      throw error;
    }
  }, [ajoPaymentsAddress]);

  /**
   * Check if member has paid for a cycle
   */
  const hasPaidForCycle = useCallback(
    async (memberAddress: string, cycle: number) => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider
        );

        const cycleU256 = cairo.uint256(cycle);

        const hasPaid = await paymentsContract.has_paid_for_cycle(memberAddress, cycleU256);
        
        console.log('Has paid for cycle:', hasPaid);
        return hasPaid;
      } catch (error) {
        console.error('Error checking payment status:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress]
  );

  /**
   * Get total amount paid by member
   */
  const getTotalPaid = useCallback(
    async (memberAddress: string) => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider
        );

        const total = await paymentsContract.get_total_paid(memberAddress);
        
        console.log('Total paid:', total);
        return total;
      } catch (error) {
        console.error('Error fetching total paid:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress]
  );

  /**
   * Get cycle contributions
   */
  const getCycleContributions = useCallback(
    async (cycle: number) => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider
        );

        const cycleU256 = cairo.uint256(cycle);

        const contributions = await paymentsContract.get_cycle_contributions(cycleU256);
        
        console.log('Cycle contributions:', contributions);
        return contributions;
      } catch (error) {
        console.error('Error fetching cycle contributions:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress]
  );

  /**
   * Get payout recipient for a cycle
   */
  const getPayoutRecipient = useCallback(
    async (cycle: number) => {
      if (!ajoPaymentsAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const paymentsContract = new Contract(
          ajoPaymentsAbi as any,
          ajoPaymentsAddress,
          provider
        );

        const cycleU256 = cairo.uint256(cycle);

        const recipient = await paymentsContract.get_payout_recipient(cycleU256);
        
        console.log('Payout recipient:', recipient);
        return recipient;
      } catch (error) {
        console.error('Error fetching payout recipient:', error);
        throw error;
      }
    },
    [ajoPaymentsAddress]
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
        provider
      );

      paymentsContract.connect(account as any);

      const result = await paymentsContract.advance_cycle();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Cycle advanced successfully:', result);
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
    hasPaidForCycle,
    getTotalPaid,
    getCycleContributions,
    getPayoutRecipient,
    
    // Write functions
    makePayment,
    distributePayout,
    advanceCycle,
    
    // State
    loading,
  };
};

export default useStarknetAjoPayments;
