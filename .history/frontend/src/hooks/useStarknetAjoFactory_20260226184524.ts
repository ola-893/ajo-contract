/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, cairo, RpcProvider } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoFactoryAbi } from '@/abi/placeholders';
import { CONTRACT_ADDRESSES } from '@/config/constants';

/**
 * Hook for interacting with the Ajo Factory Cairo contract
 * This will create new Ajo groups on Starknet
 */
const useStarknetAjoFactory = () => {
  const { account, isConnected, address } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
    });
  };

  /**
   * Create a new Ajo group
   * @param params - Parameters for creating the Ajo group
   */
  const createAjo = useCallback(
    async (params: {
      name: string;
      monthlyContribution: string; // In token units (e.g., "100" for 100 USDC)
      totalParticipants: number;
      cycleDuration: number; // In days
      paymentToken: 'USDC' | 'BTC';
    }) => {
      if (!account || !isConnected || !address) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      try {
        // Get factory contract address
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        
        if (!factoryAddress) {
          throw new Error('Factory contract address not configured');
        }

        console.log('Creating Ajo with factory at:', factoryAddress);

        const provider = getProvider();

        // Create contract instance
        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          provider
        );

        // Connect with account for write operations
        factoryContract.connect(account as any);

        // Convert name to felt252 (short string)
        const nameFelt = cairo.felt(params.name);

        // Convert contribution amount to u256 (assuming 6 decimals for USDC)
        const contributionAmount = cairo.uint256(
          parseFloat(params.monthlyContribution) * 1_000_000
        );

        // Convert total participants to u256
        const totalParticipants = cairo.uint256(params.totalParticipants);

        // Convert cycle duration from days to seconds (u64)
        const cycleDurationSeconds = params.cycleDuration * 24 * 60 * 60;

        // Payment token enum: 0 = USDC, 1 = BTC
        const paymentToken = params.paymentToken === 'USDC' ? 0 : 1;

        console.log('Contract call parameters:', {
          name: params.name,
          nameFelt,
          contributionAmount,
          totalParticipants,
          cycleDurationSeconds,
          paymentToken,
        });

        // Execute transaction
        const result = await factoryContract.create_ajo(
          nameFelt,
          contributionAmount,
          totalParticipants,
          cycleDurationSeconds,
          paymentToken
        );

        console.log('Transaction submitted:', result.transaction_hash);
        
        // Wait for transaction confirmation
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Ajo created successfully!');
        
        // The transaction should emit an event with the ajo_id
        // For now, we'll return the transaction result
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error creating Ajo:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, provider, isConnected, address]
  );

  /**
   * Get Ajo info by ID
   */
  const getAjoInfo = useCallback(
    async (ajoId: string) => {
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        
        if (!factoryAddress) {
          throw new Error('Factory contract not deployed yet');
        }

        const provider = getProvider();

        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          provider
        );

        // Call view function
        const ajoIdU256 = cairo.uint256(ajoId);
        const ajoInfo = await factoryContract.get_ajo_info(ajoIdU256);
        
        console.log('Ajo Info:', ajoInfo);
        return ajoInfo;
      } catch (error) {
        console.error('Error fetching Ajo info:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Get all Ajos created by a user
   */
  const getUserAjos = useCallback(
    async (userAddress: string) => {
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        
        if (!factoryAddress) {
          throw new Error('Factory contract not deployed yet');
        }

        const provider = getProvider();

        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          provider
        );

        // Call view function
        const ajos = await factoryContract.get_user_ajos(userAddress);
        
        console.log('User Ajos:', ajos);
        return ajos;
      } catch (error) {
        console.error('Error fetching user Ajos:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Deploy additional contracts for an Ajo
   */
  const deployAjoContracts = useCallback(
    async (ajoId: string) => {
      if (!account || !isConnected) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        if (!factoryAddress) {
          throw new Error('Factory contract not deployed yet');
        }

        const provider = getProvider();

        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          provider
        );
        factoryContract.connect(account as any);

        const ajoIdU256 = cairo.uint256(ajoId);

        // Deploy core contract
        console.log('Deploying core contract...');
        const coreResult = await factoryContract.deploy_core(ajoIdU256);
        await provider.waitForTransaction(coreResult.transaction_hash);

        // Deploy members contract
        console.log('Deploying members contract...');
        const membersResult = await factoryContract.deploy_members(ajoIdU256);
        await provider.waitForTransaction(membersResult.transaction_hash);

        // Deploy collateral and payments
        console.log('Deploying collateral and payments...');
        const collateralPaymentsResult = await factoryContract.deploy_collateral_and_payments(ajoIdU256);
        await provider.waitForTransaction(collateralPaymentsResult.transaction_hash);

        // Deploy governance and schedule
        console.log('Deploying governance and schedule...');
        const govScheduleResult = await factoryContract.deploy_governance_and_schedule(ajoIdU256);
        await provider.waitForTransaction(govScheduleResult.transaction_hash);

        console.log('All contracts deployed successfully!');
        return {
          success: true,
          coreHash: coreResult.transaction_hash,
          membersHash: membersResult.transaction_hash,
          collateralPaymentsHash: collateralPaymentsResult.transaction_hash,
          govScheduleHash: govScheduleResult.transaction_hash,
        };
      } catch (error) {
        console.error('Error deploying Ajo contracts:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, provider, isConnected]
  );

  return {
    createAjo,
    getAjoInfo,
    getUserAjos,
    deployAjoContracts,
    loading,
  };
};

export default useStarknetAjoFactory;
