/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoMembersAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Members Cairo contract
 */
const useStarknetAjoMembers = (ajoMembersAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
    });
  };

  /**
   * Add a member to the Ajo
   */
  const addMember = useCallback(
    async (memberAddress: string, position: number) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider
        );

        membersContract.connect(account as any);

        const positionU256 = cairo.uint256(position);

        const result = await membersContract.add_member(memberAddress, positionU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Member added successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error adding member:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoMembersAddress]
  );

  /**
   * Get all members
   */
  const getAllMembers = useCallback(async () => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider
      );

      const members = await membersContract.get_all_members();
      
      console.log('All members:', members);
      return members;
    } catch (error) {
      console.error('Error fetching members:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  /**
   * Get specific member info
   */
  const getMember = useCallback(
    async (memberAddress: string) => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider
        );

        const memberInfo = await membersContract.get_member(memberAddress);
        
        console.log('Member info:', memberInfo);
        return memberInfo;
      } catch (error) {
        console.error('Error fetching member info:', error);
        throw error;
      }
    },
    [ajoMembersAddress]
  );

  /**
   * Get total number of members
   */
  const getTotalMembers = useCallback(async () => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider
      );

      const total = await membersContract.get_total_members();
      
      console.log('Total members:', total);
      return total;
    } catch (error) {
      console.error('Error fetching total members:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  /**
   * Get member count
   */
  const getMemberCount = useCallback(async () => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider
      );

      const count = await membersContract.get_member_count();
      
      console.log('Member count:', count);
      return count;
    } catch (error) {
      console.error('Error fetching member count:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  return {
    // View functions
    getAllMembers,
    getMember,
    getTotalMembers,
    getMemberCount,
    
    // Write functions
    addMember,
    
    // State
    loading,
  };
};

export default useStarknetAjoMembers;
