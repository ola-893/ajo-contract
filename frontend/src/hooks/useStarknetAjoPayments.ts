/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Contract, CallData } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoPaymentsAbi, erc20Abi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Payments Cairo contract
 */
const useStarknetAjoPayments = (ajoPaymentsAddress: string) => {
  const { account, provider, isConnected } = useStarknetWallet();

  /**
   * Make a payment to the Ajo
   */
  const makePayment = useCallback(
    async (params: {
      amount: string;
      tokenAddress: string;
    }) => {
      if (!account || !isConnected || !ajoPaymentsAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      try {
        // First approve the token
        const tokenContract = new Contract(
          erc20Abi,
          params.tokenAddress,
          provider
        );

        tokenContract.connect(account);

        // Approve payment contract to spend tokens
        const approveResult = await tokenContract.approve(
          ajoPaymentsAddress,
          params.amount
        );
        await provider.waitForTransaction(approveResult.transaction_hash);

        console.log('Token approved:', approveResult);

        // Then make the payment
        const paymentsContract = new Contract(
          ajoPaymentsAbi,
          ajoPaymentsAddress,
          provider
        );

        paymentsContract.connect(account);

        const callData = CallData.compile({
          amount: params.amount,
        });

        const result = await paymentsContract.make_payment(callData);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Payment made successfully:', result);
        return result;
      } catch (error) {
        console.error('Error making payment:', error);
        throw error;
      }
    },
    [account, provider, isConnected, ajoPaymentsAddress]
  );

  /**
   * Get payment history for a member
   */
  const getPaymentHistory = useCallback(
    async (memberAddress: string) => {
      if (!provider || !ajoPaymentsAddress) {
        throw new Error('Provider or contract address not available');
      }

      try {
        const paymentsContract = new Contract(
          ajoPaymentsAbi,
          ajoPaymentsAddress,
          provider
        );

        const history = await paymentsContract.get_payment_history(memberAddress);
        
        console.log('Payment history:', history);
        return history;
      } catch (error) {
        console.error('Error fetching payment history:', error);
        throw error;
      }
    },
    [provider, ajoPaymentsAddress]
  );

  /**
   * Claim payout (when it's your turn)
   */
  const claimPayout = useCallback(async () => {
    if (!account || !isConnected || !ajoPaymentsAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    try {
      const paymentsContract = new Contract(
        ajoPaymentsAbi,
        ajoPaymentsAddress,
        provider
      );

      paymentsContract.connect(account);

      const result = await paymentsContract.claim_payout();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Payout claimed successfully:', result);
      return result;
    } catch (error) {
      console.error('Error claiming payout:', error);
      throw error;
    }
  }, [account, provider, isConnected, ajoPaymentsAddress]);

  /**
   * Get current cycle payout recipient
   */
  const getCurrentPayoutRecipient = useCallback(async () => {
    if (!provider || !ajoPaymentsAddress) {
      throw new Error('Provider or contract address not available');
    }

    try {
      const paymentsContract = new Contract(
        ajoPaymentsAbi,
        ajoPaymentsAddress,
        provider
      );

      const recipient = await paymentsContract.get_current_payout_recipient();
      
      console.log('Current payout recipient:', recipient);
      return recipient;
    } catch (error) {
      console.error('Error fetching current payout recipient:', error);
      throw error;
    }
  }, [provider, ajoPaymentsAddress]);

  return {
    makePayment,
    getPaymentHistory,
    claimPayout,
    getCurrentPayoutRecipient,
  };
};

export default useStarknetAjoPayments;
