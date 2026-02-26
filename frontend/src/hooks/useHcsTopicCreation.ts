// Stub for useHcsTopicCreation - Hedera Consensus Service (not used on Starknet)
import { useState } from "react";

export const useHcsTopicCreation = () => {
  const [loading, setLoading] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);

  const createTopic = async () => {
    console.warn("createTopic: HCS not available on Starknet - consider using Starknet messaging");
    return null;
  };

  const submitMessage = async (message: string) => {
    console.warn("submitMessage: HCS not available on Starknet");
    return null;
  };

  return {
    loading,
    topicId,
    createTopic,
    submitMessage,
  };
};
