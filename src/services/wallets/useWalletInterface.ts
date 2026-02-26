// Compatibility wrapper for old useWalletInterface - redirects to Starknet wallet
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

export const useWalletInterface = () => {
  const { address, isConnected } = useStarknetWallet();
  
  return {
    accountId: address,
    walletInterface: null, // No longer needed with Starknet
    isConnected,
  };
};
