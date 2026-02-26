// Stub for useAjoCore - returns disabled functions until Cairo contracts are ready
import { useState } from "react";

export const useAjoCore = (ajoCoreAddress?: string) => {
  const [loading, setLoading] = useState(false);

  const getOperationalStatus = async () => {
    console.warn("getOperationalStatus: Awaiting Cairo contract implementation");
    return null;
  };

  const initializeAjo = async () => {
    console.warn("initializeAjo: Awaiting Cairo contract implementation");
    return null;
  };

  return {
    loading,
    getOperationalStatus,
    initializeAjo,
  };
};
