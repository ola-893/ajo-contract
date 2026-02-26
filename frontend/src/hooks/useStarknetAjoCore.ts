/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoCoreAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with a specific Ajo Core Cairo contract
 * This handles the main Ajo logic for a specific group
 */
const useStarknetAjoCore = (ajoCoreAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
    });
  };

  /**
   * Get Ajo configuration
   */
  const getConfig = useCallback(async () => {
    if (!ajoCoreAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      const config = await ajoCoreContract.get_config();
      
      console.log('Ajo config:', config);
      return config;
    } catch (error) {
      console.error('Error fetching Ajo config:', error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Get current cycle number
   */
  const getCurrentCycle = useCallback(async () => {
    if (!ajoCoreAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      const cycle = await ajoCoreContract.get_current_cycle();
      
      console.log('Current cycle:', cycle);
      return cycle;
    } catch (error) {
      console.error('Error fetching current cycle:', error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Get Ajo status
   */
  const getAjoStatus = useCallback(async () => {
    if (!ajoCoreAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      const status = await ajoCoreContract.get_ajo_status();
      
      console.log('Ajo status:', status);
      return status;
    } catch (error) {
      console.error('Error fetching Ajo status:', error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Check if Ajo is active
   */
  const isActive = useCallback(async () => {
    if (!ajoCoreAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const ajoCoreContract = new Contract(
        ajoCoreAbi as any,
        ajoCoreAddress,
        provider
      );

      const active = await ajoCoreContract.is_active();
      
      console.log('Is active:', active);
      return active;
    } catch (error) {
      console.error('Error checking if active:', error);
      throw error;
    }
  }, [ajoCoreAddress]);

  /**
   * Start Ajo (begins the first cycle)
   */
  const startAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error('Wallet not connected or contract address not available');
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

      const result = await ajoCoreContract.start_ajo();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Ajo started successfully:', result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error starting Ajo:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoCoreAddress]);

  /**
   * Process payment for current cycle
   */
  const processPayment = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error('Wallet not connected or contract address not available');
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

      console.log('Payment processed successfully:', result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [account, isConnected, ajoCoreAddress]);

  /**
   * Exit from the Ajo
   */
  const exitAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoCoreAddress) {
      throw new Error('Wallet not connected or contract address not available');
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

      console.log('Exited Ajo successfully:', result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error exiting Ajo:', error);
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
      throw new Error('Wallet not connected or contract address not available');
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

      console.log('Ajo finalized successfully:', result);
      return {
        transactionHash: result.transaction_hash,
        success: true,
      };
    } catch (error) {
      console.error('Error finalizing Ajo:', error);
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
    isActive,
    
    // Write functions
    startAjo,
    processPayment,
    exitAjo,
    finalizeAjo,
    
    // State
    loading,
  };
};

export default useStarknetAjoCore;
