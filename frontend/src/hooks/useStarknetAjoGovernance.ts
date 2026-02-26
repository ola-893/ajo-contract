/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoGovernanceAbi } from '@/abi/placeholders';

/**
 * Hook for interacting with Ajo Governance Cairo contract
 */
const useStarknetAjoGovernance = (ajoGovernanceAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  // Create provider instance
  const getProvider = () => {
    return new RpcProvider({
      nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4"
    });
  };

  /**
   * Create a new proposal
   */
  const createProposal = useCallback(
    async (
      proposalType: number,
      description: string,
      target: string,
      calldata: string[]
    ) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        governanceContract.connect(account as any);

        const proposalTypeU256 = cairo.uint256(proposalType);
        const descriptionFelt = cairo.felt(description);

        const result = await governanceContract.create_proposal(
          proposalTypeU256,
          descriptionFelt,
          target,
          calldata
        );
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Proposal created successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error creating proposal:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress]
  );

  /**
   * Cast a vote on a proposal
   */
  const castVote = useCallback(
    async (proposalId: number, support: boolean) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);

        const result = await governanceContract.cast_vote(proposalIdU256, support);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Vote cast successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error casting vote:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress]
  );

  /**
   * Execute a proposal
   */
  const executeProposal = useCallback(
    async (proposalId: number) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);

        const result = await governanceContract.execute_proposal(proposalIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Proposal executed successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error executing proposal:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress]
  );

  /**
   * Cancel a proposal
   */
  const cancelProposal = useCallback(
    async (proposalId: number) => {
      if (!account || !isConnected || !ajoGovernanceAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        governanceContract.connect(account as any);

        const proposalIdU256 = cairo.uint256(proposalId);

        const result = await governanceContract.cancel_proposal(proposalIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        console.log('Proposal cancelled successfully:', result);
        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error cancelling proposal:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoGovernanceAddress]
  );

  /**
   * Get proposal details
   */
  const getProposal = useCallback(
    async (proposalId: number) => {
      if (!ajoGovernanceAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        const proposalIdU256 = cairo.uint256(proposalId);

        const proposal = await governanceContract.get_proposal(proposalIdU256);
        
        console.log('Proposal:', proposal);
        return proposal;
      } catch (error) {
        console.error('Error fetching proposal:', error);
        throw error;
      }
    },
    [ajoGovernanceAddress]
  );

  /**
   * Get proposal status
   */
  const getProposalStatus = useCallback(
    async (proposalId: number) => {
      if (!ajoGovernanceAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        const proposalIdU256 = cairo.uint256(proposalId);

        const status = await governanceContract.get_proposal_status(proposalIdU256);
        
        console.log('Proposal status:', status);
        return status;
      } catch (error) {
        console.error('Error fetching proposal status:', error);
        throw error;
      }
    },
    [ajoGovernanceAddress]
  );

  /**
   * Get voting power of an address
   */
  const getVotingPower = useCallback(
    async (voterAddress: string) => {
      if (!ajoGovernanceAddress) {
        throw new Error('Contract address not available');
      }

      try {
        const provider = getProvider();
        const governanceContract = new Contract(
          ajoGovernanceAbi as any,
          ajoGovernanceAddress,
          provider
        );

        const power = await governanceContract.get_voting_power(voterAddress);
        
        console.log('Voting power:', power);
        return power;
      } catch (error) {
        console.error('Error fetching voting power:', error);
        throw error;
      }
    },
    [ajoGovernanceAddress]
  );

  /**
   * Get total number of proposals
   */
  const getTotalProposals = useCallback(async () => {
    if (!ajoGovernanceAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider
      );

      const total = await governanceContract.get_total_proposals();
      
      console.log('Total proposals:', total);
      return total;
    } catch (error) {
      console.error('Error fetching total proposals:', error);
      throw error;
    }
  }, [ajoGovernanceAddress]);

  /**
   * Get quorum requirement
   */
  const getQuorum = useCallback(async () => {
    if (!ajoGovernanceAddress) {
      throw new Error('Contract address not available');
    }

    try {
      const provider = getProvider();
      const governanceContract = new Contract(
        ajoGovernanceAbi as any,
        ajoGovernanceAddress,
        provider
      );

      const quorum = await governanceContract.get_quorum();
      
      console.log('Quorum:', quorum);
      return quorum;
    } catch (error) {
      console.error('Error fetching quorum:', error);
      throw error;
    }
  }, [ajoGovernanceAddress]);

  return {
    // View functions
    getProposal,
    getProposalStatus,
    getVotingPower,
    getTotalProposals,
    getQuorum,
    
    // Write functions
    createProposal,
    castVote,
    executeProposal,
    cancelProposal,
    
    // State
    loading,
  };
};

export default useStarknetAjoGovernance;
