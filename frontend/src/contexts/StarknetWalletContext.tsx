import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { connect, disconnect } from "starknetkit";
import type { StarknetWindowObject } from "starknetkit";

interface StarknetWalletContextType {
  account: StarknetWindowObject | null;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  chainId: string | null;
}

const StarknetWalletContext = createContext<
  StarknetWalletContextType | undefined
>(undefined);

export const StarknetWalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = useState<StarknetWindowObject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to silently reconnect to last connected wallet
        const { wallet, connectorData } = await connect({
          modalMode: "neverAsk",
        });

        if (wallet && connectorData && connectorData.account) {
          // The wallet object from StarknetKit is already the connected wallet
          setAccount(wallet as StarknetWindowObject);
          setAddress(connectorData.account);
          setIsConnected(true);

          // Get chain ID
          if (connectorData.chainId) {
            setChainId(connectorData.chainId.toString());
          }

          console.log("🔄 Auto-reconnected to wallet:", connectorData.account);
        }
      } catch (error) {
        console.log("No existing wallet connection found");
      }
    };

    checkConnection();
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Show wallet selection modal
      const { wallet, connectorData } = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "dark",
      });

      console.log("Connect result:", { wallet, connectorData });

      if (!wallet || !connectorData || !connectorData.account) {
        throw new Error(
          "No Starknet wallet detected. Please install ArgentX or Braavos.",
        );
      }

      // The wallet object from StarknetKit is already the connected wallet
      // The wallet is a StarknetWindowObject which implements the account interface
      setAccount(wallet as StarknetWindowObject);
      setAddress(connectorData.account);
      setIsConnected(true);

      // Get chain ID
      if (connectorData.chainId) {
        setChainId(connectorData.chainId.toString());
      }

      console.log(
        "✅ Successfully connected to Starknet wallet:",
        connectorData.account,
      );
    } catch (error) {
      console.error("❌ Failed to connect wallet:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect({ clearLastWallet: true });
      setAccount(null);
      setAddress(null);
      setIsConnected(false);
      setChainId(null);
      console.log("Disconnected from Starknet wallet");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      throw error;
    }
  };

  return (
    <StarknetWalletContext.Provider
      value={{
        account,
        address,
        isConnected,
        isConnecting,
        connectWallet,
        disconnectWallet,
        chainId,
      }}
    >
      {children}
    </StarknetWalletContext.Provider>
  );
};

export const useStarknetWallet = () => {
  const context = useContext(StarknetWalletContext);
  if (context === undefined) {
    throw new Error(
      "useStarknetWallet must be used within a StarknetWalletProvider",
    );
  }
  return context;
};
