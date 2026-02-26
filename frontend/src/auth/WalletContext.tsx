// Compatibility wrapper for old WalletContext - redirects to Starknet wallet
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

export const useWallet = () => {
  const { address, isConnected } = useStarknetWallet();
  
  return {
    address,
    isConnected,
    accountId: address, // For backward compatibility
  };
};

// Dummy WalletProvider for any legacy code
export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
