// Stub for useAjoGovernance - returns disabled functions until Cairo contracts are ready
import { useState } from "react";

export enum VoteSupport {
  Against = 0,
  For = 1,
  Abstain = 2,
}

export const useAjoGovernance = (ajoGovernanceAddress?: string) => {
  const [loading, setLoading] = useState(false);

  const createProposal = async () => {
    console.warn("createProposal: Awaiting Cairo contract implementation");
    return null;
  };

  const castVote = async (proposalId: string, support: VoteSupport) => {
    console.warn("castVote: Awaiting Cairo contract implementation");
    return null;
  };

  const getProposal = async (proposalId: string) => {
    console.warn("getProposal: Awaiting Cairo contract implementation");
    return null;
  };

  return {
    loading,
    createProposal,
    castVote,
    getProposal,
  };
};
