// Stub for useHcsVoting - Hedera Consensus Service voting (no longer used with Starknet)
import { useState } from "react";

export const useHcsVoting = () => {
  const [loading, setLoading] = useState(false);

  const submitVote = async () => {
    console.warn("submitVote: HCS voting not available on Starknet");
    return null;
  };

  const getVotes = async () => {
    console.warn("getVotes: HCS voting not available on Starknet");
    return [];
  };

  return {
    loading,
    submitVote,
    getVotes,
  };
};
