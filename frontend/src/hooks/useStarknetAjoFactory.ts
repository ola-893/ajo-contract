/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Contract, CallData } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoFactoryAbi, CONTRACT_ADDRESSES } from '@/abi/placeholders';
import { STARKNET_CONFIG } from '@/config/constants';

/**
 * Hook for interacting with the Ajo Factory Cairo contract
 * This will create new Ajo groups on Starknet
 */
const useStarknetAjoFactory = () => {
  const { account, provider, isConnected } = useStarknetWallet();

  /**
   * Create a new Ajo group
   * @param params - Parameters for creating the Ajo group
   */
  const createAjo = useCallback(
    async (params: {
      name: string;
      contributionAmount: string;
      cycleLength: number;
      maxMembers: number;
      collateralPercentage: number;
      paymentToken: number; // 0 for USDC, 1 for ETH, etc.
    }) => {
      if (!account || !isConnected) {
        throw new Error('Wallet not connected');
      }

      try {
        // Get factory contract address based on network
        const factoryAddress = CONTRACT_ADDRESSES[STARKNET_CONFIG.network].ajoFactory;
        
        if (!factoryAddress) {
          throw new Error('Factory contract not deployed yet. Please update CONTRACT_ADDRESSES in src/abi/placeholders.ts');
        }

        // Create contract instance
        const factoryContract = new Contract(
          ajoFactoryAbi,
          factoryAddress,
          provider
        );

        // Connect with account for write operations
        factoryContract.connect(account);

        // Prepare call data (adjust based on actual Cairo contract structure)
        const callData = CallData.compile({
          name: params.name,
          contribution_amount: params.contributionAmount,
          cycle_length: params.cycleLength,
          max_members: params.maxMembers,
          collateral_percentage: params.collateralPercentage,
          payment_token: params.paymentToken,
        });

        // Execute transaction
        // Note: Method name will match your Cairo contract
        const result = await factoryContract.create_ajo(callData);
        
        // Wait for transaction confirmation
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Ajo created successfully:', result);
        return result;
      } catch (error) {
        console.error('Error creating Ajo:', error);
        throw error;
      }
    },
    [account, provider, isConnected]
  );

  /**
   * Get all Ajo groups created by a user
   */
  const getUserAjos = useCallback(
    async (userAddress: string) => {
      if (!provider) {
        throw new Error('Provider not available');
      }

      try {
        const factoryAddress = CONTRACT_ADDRESSES[STARKNET_CONFIG.network].ajoFactory;
        
        if (!factoryAddress) {
          throw new Error('Factory contract not deployed yet');
        }

        const factoryContract = new Contract(
          ajoFactoryAbi,
          factoryAddress,
          provider
        );

        // Call view function (adjust method name based on Cairo contract)
        const ajos = await factoryContract.get_user_ajos(userAddress);
        
        console.log('User Ajos:', ajos);
        return ajos;
      } catch (error) {
        console.error('Error fetching user Ajos:', error);
        throw error;
      }
    },
    [provider]
  );

  /**
   * Get all active Ajo groups
   */
  const getAllActiveAjos = useCallback(async () => {
    if (!provider) {
      throw new Error('Provider not available');
    }

    try {
      const factoryAddress = CONTRACT_ADDRESSES[STARKNET_CONFIG.network].ajoFactory;
      
      if (!factoryAddress) {
        throw new Error('Factory contract not deployed yet');
      }

      const factoryContract = new Contract(
        ajoFactoryAbi,
        factoryAddress,
        provider
      );

      // Call view function
      const ajos = await factoryContract.get_all_active_ajos();
      
      console.log('All active Ajos:', ajos);
      return ajos;
    } catch (error) {
      console.error('Error fetching active Ajos:', error);
      throw error;
    }
  }, [provider]);

  return {
    createAjo,
    getUserAjos,
    getAllActiveAjos,
  };
};

export default useStarknetAjoFactory;
