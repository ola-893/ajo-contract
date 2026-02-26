// Stub for useAjoPayment - returns disabled functions until Cairo contracts are ready
import { useState } from "react";

const useAjoPayment = (ajoPaymentAddress?: string) => {
  const [loading, setLoading] = useState(false);

  const makePayment = async () => {
    console.warn("makePayment: Awaiting Cairo contract implementation");
    return null;
  };

  const getPaymentHistory = async () => {
    console.warn("getPaymentHistory: Awaiting Cairo contract implementation");
    return [];
  };

  return {
    loading,
    makePayment,
    getPaymentHistory,
  };
};

export default useAjoPayment;
