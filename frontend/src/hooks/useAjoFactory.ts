// Stub for useAjoFactory - returns disabled functions until Cairo contracts are ready
import { useState } from "react";

export const useAjoFactory = (ajoFactoryAddress?: string) => {
  const [loading, setLoading] = useState(false);

  const createAjo = async () => {
    console.warn("createAjo: Awaiting Cairo contract implementation");
    return null;
  };

  const getAllAjos = async () => {
    console.warn("getAllAjos: Awaiting Cairo contract implementation");
    return [];
  };

  const getAjoDetails = async (ajoId: string) => {
    console.warn("getAjoDetails: Awaiting Cairo contract implementation");
    return null;
  };

  return {
    loading,
    createAjo,
    getAllAjos,
    getAjoDetails,
  };
};
