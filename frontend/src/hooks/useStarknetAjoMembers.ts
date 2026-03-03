/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { CairoCustomEnum, Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoMembersAbi } from '@/abi/placeholders';

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4';

const toBigIntValue = (value: any): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    if (!value.trim()) return 0n;
    return BigInt(value);
  }
  if (typeof value === 'object' && 'low' in value) {
    const low = BigInt((value as any).low ?? 0);
    const high = BigInt((value as any).high ?? 0);
    return low + (high << 128n);
  }
  if (typeof value?.toString === 'function') {
    const text = value.toString();
    if (!text || text === '[object Object]') return 0n;
    return BigInt(text);
  }
  return 0n;
};

const toBool = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value === 'true';
  if (typeof value === 'object' && value !== null) {
    if ('True' in value || 'true' in value) return true;
    if ('False' in value || 'false' in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const toAddress = (value: any): string => {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value.toLowerCase();
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }
  return `0x${toBigIntValue(value).toString(16)}`;
};

const parseEnum = (value: any, fallback: string) => {
  if (!value || typeof value !== 'object') return fallback;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : fallback;
};

const buildMemberStatusEnum = (
  status: 'Active' | 'Defaulted' | 'Completed' | 'Removed',
) => new CairoCustomEnum({ [status]: {} });

const extractSpanValues = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.snapshot)) return value.snapshot;
  if (Array.isArray(value?.[0])) return value[0];
  return [];
};

export interface StarknetMember {
  address: string;
  position: number;
  collateralDeposited: bigint;
  hasReceivedPayout: boolean;
  status: string;
  joinTimestamp: number;
}

/**
 * Hook for interacting with Ajo Members Cairo contract
 */
const useStarknetAjoMembers = (ajoMembersAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () =>
    new RpcProvider({
      nodeUrl: RPC_URL,
    });

  const getAuthorizedCore = useCallback(async (): Promise<string> => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const membersContract = new Contract(
      ajoMembersAbi as any,
      ajoMembersAddress,
      provider,
    );

    const result = await membersContract.get_authorized_core();
    return toAddress(result);
  }, [ajoMembersAddress]);

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        membersContract.connect(account as any);

        const result = await membersContract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting authorized core:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoMembersAddress],
  );

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
          provider,
        );

        membersContract.connect(account as any);
        const positionU256 = cairo.uint256(position);

        const result = await membersContract.add_member(memberAddress, positionU256);
        await provider.waitForTransaction(result.transaction_hash);

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
    [account, isConnected, ajoMembersAddress],
  );

  /**
   * Get all members
   */
  const getAllMembers = useCallback(async (): Promise<StarknetMember[]> => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider,
      );

      const members = await membersContract.get_all_members();
      const values = extractSpanValues(members);

      return values
        .map((raw) => ({
          address: toAddress(raw?.address),
          position: Number(toBigIntValue(raw?.position)),
          collateralDeposited: toBigIntValue(raw?.collateral_deposited),
          hasReceivedPayout: toBool(raw?.has_received_payout),
          status: parseEnum(raw?.status, 'Unknown'),
          joinTimestamp: Number(raw?.join_timestamp ?? 0),
        }))
        .filter((item) => item.address !== '0x0');
    } catch (error) {
      console.error('Error fetching members:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  /**
   * Get specific member info
   */
  const getMember = useCallback(
    async (memberAddress: string): Promise<StarknetMember> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const memberInfo = await membersContract.get_member(memberAddress);
        return {
          address: toAddress(memberInfo?.address),
          position: Number(toBigIntValue(memberInfo?.position)),
          collateralDeposited: toBigIntValue(memberInfo?.collateral_deposited),
          hasReceivedPayout: toBool(memberInfo?.has_received_payout),
          status: parseEnum(memberInfo?.status, 'Unknown'),
          joinTimestamp: Number(memberInfo?.join_timestamp ?? 0),
        };
      } catch (error) {
        console.error('Error fetching member info:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  const getMemberByPosition = useCallback(
    async (position: number): Promise<StarknetMember> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const memberInfo = await membersContract.get_member_by_position(
          cairo.uint256(position),
        );
        return {
          address: toAddress(memberInfo?.address),
          position: Number(toBigIntValue(memberInfo?.position)),
          collateralDeposited: toBigIntValue(memberInfo?.collateral_deposited),
          hasReceivedPayout: toBool(memberInfo?.has_received_payout),
          status: parseEnum(memberInfo?.status, 'Unknown'),
          joinTimestamp: Number(memberInfo?.join_timestamp ?? 0),
        };
      } catch (error) {
        console.error('Error fetching member by position:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  /**
   * Get total number of members
   */
  const getTotalMembers = useCallback(async (): Promise<number> => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider,
      );

      const total = await membersContract.get_total_members();
      return Number(toBigIntValue(total));
    } catch (error) {
      console.error('Error fetching total members:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  /**
   * Get member count
   */
  const getMemberCount = useCallback(async (): Promise<number> => {
    if (!ajoMembersAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const membersContract = new Contract(
        ajoMembersAbi as any,
        ajoMembersAddress,
        provider,
      );

      const count = await membersContract.get_member_count();
      return Number(toBigIntValue(count));
    } catch (error) {
      console.error('Error fetching member count:', error);
      throw error;
    }
  }, [ajoMembersAddress]);

  /**
   * Check if address is a member
   */
  const isMember = useCallback(
    async (memberAddress: string): Promise<boolean> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const result = await membersContract.is_member(memberAddress);
        return toBool(result);
      } catch (error) {
        console.error('Error checking member status:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  const getGuarantor = useCallback(
    async (memberAddress: string): Promise<string> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const result = await membersContract.get_guarantor(memberAddress);
        return toAddress(result);
      } catch (error) {
        console.error('Error fetching guarantor:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  const hasReceivedPayout = useCallback(
    async (memberAddress: string): Promise<boolean> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const result = await membersContract.has_received_payout(memberAddress);
        return toBool(result);
      } catch (error) {
        console.error('Error checking payout received status:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  const calculateGuarantorPosition = useCallback(
    async (position: number): Promise<number> => {
      if (!ajoMembersAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        const result = await membersContract.calculate_guarantor_position(
          cairo.uint256(position),
        );
        return Number(toBigIntValue(result));
      } catch (error) {
        console.error('Error calculating guarantor position:', error);
        throw error;
      }
    },
    [ajoMembersAddress],
  );

  const removeMember = useCallback(
    async (memberAddress: string) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        membersContract.connect(account as any);

        const result = await membersContract.remove_member(memberAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error removing member:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoMembersAddress],
  );

  const updateMemberStatus = useCallback(
    async (
      memberAddress: string,
      status: 'Active' | 'Defaulted' | 'Completed' | 'Removed',
    ) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        membersContract.connect(account as any);

        const statusEnum = buildMemberStatusEnum(status);
        const result = await membersContract.update_member_status(
          memberAddress,
          statusEnum,
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error updating member status:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoMembersAddress],
  );

  const markPayoutReceived = useCallback(
    async (memberAddress: string) => {
      if (!account || !isConnected || !ajoMembersAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const membersContract = new Contract(
          ajoMembersAbi as any,
          ajoMembersAddress,
          provider,
        );

        membersContract.connect(account as any);

        const result = await membersContract.mark_payout_received(memberAddress);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error marking payout received:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoMembersAddress],
  );

  return {
    // View functions
    getAllMembers,
    getMember,
    getMemberByPosition,
    getAuthorizedCore,
    getTotalMembers,
    getMemberCount,
    isMember,
    getGuarantor,
    hasReceivedPayout,
    calculateGuarantorPosition,

    // Write functions
    addMember,
    setAuthorizedCore,
    removeMember,
    updateMemberStatus,
    markPayoutReceived,

    // State
    loading,
  };
};

export default useStarknetAjoMembers;
