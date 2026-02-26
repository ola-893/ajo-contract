// WalletModal.tsx - Updated for Starknet wallets

import { ArrowRight, X } from "lucide-react";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { useState } from "react";

// Define the shape of the props
interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { connectWallet, isConnecting } = useStarknetWallet();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
    try {
      setError(null);
      await connectWallet();
      onClose();
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect wallet. Please make sure you have ArgentX or Braavos installed.');
    }
  };

  // Simple overlay and modal structure with Tailwind CSS classes
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background border border-primary/20 rounded-xl p-6 w-11/12 max-w-sm shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-2">Connect Wallet</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Connect your Starknet wallet to Ajo.Save
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Starknet Wallets (ArgentX, Braavos) */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-between p-4 bg-primary/10 hover:bg-primary/20 transition-colors duration-200 rounded-lg border border-primary/20 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">S</span>
              </div>
              <div className="text-left">
                <span className="font-semibold text-white block">Starknet Wallet</span>
                <span className="text-xs text-muted-foreground">ArgentX, Braavos</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Don't have a wallet?{" "}
            <a
              href="https://www.argent.xyz/argent-x/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Install ArgentX
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
