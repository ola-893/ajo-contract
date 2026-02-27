/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, cairo, RpcProvider, CairoCustomEnum } from 'starknet';
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
      nodeUrl:
        "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4",
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
      paymentToken: "USDC" | "BTC";
    }) => {
      if (!account || !isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        // Get factory contract address
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;

        if (!factoryAddress) {
          throw new Error("Factory contract address not configured");
        }

        console.log("Creating Ajo with factory at:", factoryAddress);
        
        // First, check if the contract is paused
        try {
          const checkProvider = getProvider();
          const checkContract = new Contract(
            ajoFactoryAbi as any,
            factoryAddress,
            checkProvider,
          );
          
          const isPaused = await checkContract.is_paused();
          console.log("Factory contract paused status:", isPaused);
          
          if (isPaused) {
            throw new Error("The Ajo Factory contract is currently paused. Please contact the administrator to unpause it.");
          }
        } catch (pauseCheckError) {
          console.warn("Could not check paused status:", pauseCheckError);
          // Continue anyway - might not have is_paused function
        }

        // Create contract instance with the account
        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          account,
        );

        // Convert name to felt252 (short string)
        const nameFelt = cairo.felt(params.name);

        // Convert contribution amount to u256 (assuming 6 decimals for USDC)
        const contributionAmount = cairo.uint256(
          parseFloat(params.monthlyContribution) * 1_000_000
        );

        // Convert total participants to u256
        const totalParticipants = cairo.uint256(params.totalParticipants);

        // Convert cycle duration from days to seconds
        // For u64, pass as string or number - Starknet.js will handle it
        const cycleDuration = (params.cycleDuration * 24 * 60 * 60).toString();

        // Payment token enum - Starknet.js expects: new CairoCustomEnum({ variant_name: {} })
        // For enums without data, pass the variant as a property with empty object
        const paymentToken = params.paymentToken === 'USDC' 
          ? new CairoCustomEnum({ USDC: {} })
          : new CairoCustomEnum({ BTC: {} });

        console.log('Contract call parameters:', {
          name: params.name,
          nameFelt,
          contributionAmount,
          totalParticipants,
          cycleDuration,
          paymentToken,
          paymentTokenVariant: paymentToken.activeVariant(),
        });

        // Try using populate transaction to see the calldata
        const populatedTx = await factoryContract.populate('create_ajo', [
          nameFelt,
          contributionAmount,
          totalParticipants,
          cycleDuration,
          paymentToken
        ]);
        
        console.log('Populated transaction:', populatedTx);
        console.log('Calldata:', populatedTx.calldata);

        // Execute transaction using the contract instance
        // Let Starknet.js handle the serialization
        const result = await factoryContract.create_ajo(
          nameFelt,
          contributionAmount,
          totalParticipants,
          cycleDuration,
          paymentToken
        );
        
        console.log("Transaction result:", result);
        console.log("Transaction submitted:", result.transaction_hash);

        // Wait for transaction confirmation
        const provider = getProvider();
        await provider.waitForTransaction(result.transaction_hash);

        console.log("Ajo created successfully!");

        // The transaction should emit an event with the ajo_id
        // For now, we'll return the transaction result
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error: any) {
        console.error("Error creating Ajo:", error);
        console.error("Error details:", {
          message: error?.message,
          code: error?.code,
          data: error?.data,
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, address],
  );

  /**
   * Get Ajo info by ID
   */
  const getAjoInfo = useCallback(async (ajoId: string) => {
    try {
      const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;

      if (!factoryAddress) {
        throw new Error("Factory contract not deployed yet");
      }

      const provider = getProvider();

      const factoryContract = new Contract(
        ajoFactoryAbi as any,
        factoryAddress,
        provider,
      );

      // Call view function
      const ajoIdU256 = cairo.uint256(ajoId);
      const ajoInfo = await factoryContract.get_ajo_info(ajoIdU256);

      console.log("Ajo Info:", ajoInfo);
      return ajoInfo;
    } catch (error) {
      console.error("Error fetching Ajo info:", error);
      throw error;
    }
  }, []);

  /**
   * Get all Ajos created by a user
   */
  const getUserAjos = useCallback(async (userAddress: string) => {
    try {
      const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;

      if (!factoryAddress) {
        throw new Error("Factory contract not deployed yet");
      }

      const provider = getProvider();

      const factoryContract = new Contract(
        ajoFactoryAbi as any,
        factoryAddress,
        provider,
      );

      // Call view function
      const ajos = await factoryContract.get_user_ajos(userAddress);

      console.log("User Ajos:", ajos);
      return ajos;
    } catch (error) {
      console.error("Error fetching user Ajos:", error);
      throw error;
    }
  }, []);

  /**
   * Deploy additional contracts for an Ajo
   */
  const deployAjoContracts = useCallback(
    async (ajoId: string) => {
      if (!account || !isConnected) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        if (!factoryAddress) {
          throw new Error("Factory contract not deployed yet");
        }

        const provider = getProvider();

        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          provider,
        );
        factoryContract.connect(account as any);

        const ajoIdU256 = cairo.uint256(ajoId);

        // Deploy core contract
        console.log("Deploying core contract...");
        const coreResult = await factoryContract.deploy_core(ajoIdU256);
        await provider.waitForTransaction(coreResult.transaction_hash);

        // Deploy members contract
        console.log("Deploying members contract...");
        const membersResult = await factoryContract.deploy_members(ajoIdU256);
        await provider.waitForTransaction(membersResult.transaction_hash);

        // Deploy collateral and payments
        console.log("Deploying collateral and payments...");
        const collateralPaymentsResult =
          await factoryContract.deploy_collateral_and_payments(ajoIdU256);
        await provider.waitForTransaction(
          collateralPaymentsResult.transaction_hash,
        );

        // Deploy governance and schedule
        console.log("Deploying governance and schedule...");
        const govScheduleResult =
          await factoryContract.deploy_governance_and_schedule(ajoIdU256);
        await provider.waitForTransaction(govScheduleResult.transaction_hash);

        console.log("All contracts deployed successfully!");
        return {
          success: true,
          coreHash: coreResult.transaction_hash,
          membersHash: membersResult.transaction_hash,
          collateralPaymentsHash: collateralPaymentsResult.transaction_hash,
          govScheduleHash: govScheduleResult.transaction_hash,
        };
      } catch (error) {
        console.error("Error deploying Ajo contracts:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected],
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
