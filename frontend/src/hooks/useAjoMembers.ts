// Stub for useAjoMembers - returns disabled functions until Cairo contracts are ready
import { useState } from "react";

const useAjoMembers = (ajoMembersAddress?: string) => {
  const [loading, setLoading] = useState(false);

  const joinAjo = async () => {
    console.warn("joinAjo: Awaiting Cairo contract implementation");
    return null;
  };

  const getMemberInfo = async (address: string) => {
    console.warn("getMemberInfo: Awaiting Cairo contract implementation");
    return null;
  };

  const getAllMembers = async () => {
    console.warn("getAllMembers: Awaiting Cairo contract implementation");
    return [];
  };

  return {
    loading,
    joinAjo,
    getMemberInfo,
    getAllMembers,
  };
};

export default useAjoMembers;
