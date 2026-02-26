/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Contract } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoCoreAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with a specific Ajo Core Cairo contract
 * This handles the main Ajo logic for a specific group
 */
const useStarknetAjoCore = (ajoCoreAddress: string) => {
  const { account, provider, isConnected } = useStarknetWallet();

  /**
   * Get Ajo details
   */
  const getAjoDetails = useCallback(async () => {
    if (!provider || !ajoCoreAddress) {
      throw new Error('Provider or contract address not available');
    }

    try {
      const ajoCoreContract = new Contract(
        ajoCoreAbi,
        ajoCoreAddress,
        provider
      );

      const details = await ajoCoreContract.get_ajo_details();
      
      console.log('Ajo details:', details);
      return details;
    } catch (error) {
      console.error('Error fetching Ajo details:', error);
      throw error;
    }
  }, [provider, ajoCoreAddress]);

  /**
   * Get Ajo operational status
   */
  const getOperationalStatus = useCallback(async () => {
    if (!provider || !ajoCoreAddress) {
      throw new Error('Provider or contract address not available');
    }

    try {
      const ajoCoreContract = new Contract(
        ajoCoreAbi,
        ajoCoreAddress,
        provider
      );

      const status = await ajoCoreContract.get_operational_status();
      
      console.log('Operational status:', status);
      return status;
    } catch (error) {
      console.error('Error fetching operational status:', error);
      throw error;
    }
  }, [provider, ajoCoreAddress]);

  /**
   * Initialize Ajo (only by creator)
   */
  const initializeAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    try {
      const ajoCoreContract = new Contract(
        ajoCoreAbi,
        ajoCoreAddress,
        provider
      );

      ajoCoreContract.connect(account);

      const result = await ajoCoreContract.initialize();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Ajo initialized successfully:', result);
      return result;
    } catch (error) {
      console.error('Error initializing Ajo:', error);
      throw error;
    }
  }, [account, provider, isConnected, ajoCoreAddress]);

  /**
   * Start Ajo cycle
   */
  const startCycle = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    try {
      const ajoCoreContract = new Contract(
        ajoCoreAbi,
        ajoCoreAddress,
        provider
      );

      ajoCoreContract.connect(account);

      const result = await ajoCoreContract.start_cycle();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Cycle started successfully:', result);
      return result;
    } catch (error) {
      console.error('Error starting cycle:', error);
      throw error;
    }
  }, [account, provider, isConnected, ajoCoreAddress]);

  return {
    getAjoDetails,
    getOperationalStatus,
    initializeAjo,
    startCycle,
  };
};

export default useStarknetAjoCore;
