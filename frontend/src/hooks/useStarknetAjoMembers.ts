/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Contract, CallData } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoMembersAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Members Cairo contract
 */
const useStarknetAjoMembers = (ajoMembersAddress: string) => {
  const { account, provider, isConnected } = useStarknetWallet();

  /**
   * Join an Ajo group
   */
  const joinAjo = useCallback(
    async (params: {
      preferredToken: number;
      guarantor?: string;
    }) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      try {
        const membersContract = new Contract(
          ajoMembersAbi,
          ajoMembersAddress,
          provider
        );

        membersContract.connect(account);

        const callData = CallData.compile({
          preferred_token: params.preferredToken,
          guarantor: params.guarantor || '0x0',
        });

        const result = await membersContract.join_ajo(callData);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Joined Ajo successfully:', result);
        return result;
      } catch (error) {
        console.error('Error joining Ajo:', error);
        throw error;
      }
    },
    [account, provider, isConnected, ajoMembersAddress]
  );

  /**
   * Get all members details
   */
  const getAllMembersDetails = useCallback(async () => {
    if (!provider || !ajoMembersAddress) {
      throw new Error('Provider or contract address not available');
    }

    try {
      const membersContract = new Contract(
        ajoMembersAbi,
        ajoMembersAddress,
        provider
      );

      const members = await membersContract.get_all_members_details();
      
      console.log('All members:', members);
      return members;
    } catch (error) {
      console.error('Error fetching members:', error);
      throw error;
    }
  }, [provider, ajoMembersAddress]);

  /**
   * Get specific member info
   */
  const getMemberInfo = useCallback(
    async (memberAddress: string) => {
      if (!provider || !ajoMembersAddress) {
        throw new Error('Provider or contract address not available');
      }

      try {
        const membersContract = new Contract(
          ajoMembersAbi,
          ajoMembersAddress,
          provider
        );

        const memberInfo = await membersContract.get_member_info(memberAddress);
        
        console.log('Member info:', memberInfo);
        return memberInfo;
      } catch (error) {
        console.error('Error fetching member info:', error);
        throw error;
      }
    },
    [provider, ajoMembersAddress]
  );

  /**
   * Leave Ajo group
   */
  const leaveAjo = useCallback(async () => {
    if (!account || !isConnected || !ajoMembersAddress) {
      throw new Error('Wallet not connected or contract address not available');
    }

    try {
      const membersContract = new Contract(
        ajoMembersAbi,
        ajoMembersAddress,
        provider
      );

      membersContract.connect(account);

      const result = await membersContract.leave_ajo();
      await provider.waitForTransaction(result.transaction_hash);

      console.log('Left Ajo successfully:', result);
      return result;
    } catch (error) {
      console.error('Error leaving Ajo:', error);
      throw error;
    }
  }, [account, provider, isConnected, ajoMembersAddress]);

  return {
    joinAjo,
    getAllMembersDetails,
    getMemberInfo,
    leaveAjo,
  };
};

export default useStarknetAjoMembers;
