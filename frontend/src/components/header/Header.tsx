/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Wallet,
  Menu,
  X,
  Home,
  User,
  Coins,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTokenStore } from "@/store/tokenStore";
import { toast } from "sonner";
import WalletModal from "../ui/WalletModal";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { Tooltip, Whisper, Button } from "rsuite";
import "rsuite/Tooltip/styles/index.css";

// Helper to format Starknet address
const formatStarknetAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const Header = () => {
  const { setAddress, setUsdc } = useTokenStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);

  // Use Starknet wallet
  const { address, isConnected, disconnectWallet } = useStarknetWallet();
  const connected = isConnected;
  const accountId = address;

  // Fetch token balances
  const { balance: strkBalance, loading: strkLoading, refetch: refetchStrk } = useTokenBalance("STRK");
  const { balance: usdcBalance, loading: usdcLoading, refetch: refetchUsdc } = useTokenBalance("USDC");
  
  const loadingBalances = strkLoading || usdcLoading;
  
  const loadBalances = () => {
    refetchStrk();
    refetchUsdc();
  };

  const handleCopy = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Store address when connected
  useEffect(() => {
    if (accountId) {
      setAddress(accountId);
    }
  }, [accountId, setAddress]);

  // Handle create ajo route
  const handleCreateAjoRoute = () => {
    if (accountId) {
      navigate("/ajo/create-ajo");
    } else {
      toast.info("Connect wallet to create an ajo");
    }
  };

  // Connect wallet handlers
  const handleConnect = () => {
    setIsWalletModalOpen(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      setUsdc("");
      toast.success("Wallet disconnected");
      navigate("/");
    } catch (error) {
      console.error("Disconnect failed:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  useEffect(() => {
    const currentPath = location.pathname.replace("/", "") || "dashboard";
    setActiveTab(currentPath || "dashboard");
  }, [location]);

  const navigateTo = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/${tabId}`);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:block fixed bg-gradient-to-r from-background via-background to-background/95 backdrop-blur-xl border-b border-primary/20 w-full top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center space-x-3 shrink-0 cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary via-primary/90 to-accent rounded-xl flex items-center justify-center shadow-lg hover:shadow-primary/50 transition-all duration-300 hover:scale-110">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Ajo.Save
              </span>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              {[
                { id: "dashboard", label: "Dashboard", icon: Home },
                { id: "profile", label: "Profile", icon: User },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => navigateTo(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Wallet Section */}
            <div className="flex items-center gap-3 shrink-0">
              {accountId ? (
                <div className="relative">
                  <button
                    onClick={() =>
                      setIsWalletDropdownOpen(!isWalletDropdownOpen)
                    }
                    className="flex items-center gap-3 bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 px-4 py-2 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <div className="flex flex-col items-start">
                        <span className="text-xs text-muted-foreground">
                          Balance
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {loadingBalances ? '...' : strkBalance.formatted} STRK
                          </span>
                          <span className="text-xs text-muted-foreground">
                            |
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {loadingBalances ? '...' : usdcBalance.formatted} USDC
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isWalletDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isWalletDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-card border border-primary/20 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Connected Wallet
                          </span>
                          <button
                            onClick={loadBalances}
                            disabled={loadingBalances}
                            className="p-1 hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <RefreshCw
                              className={`h-4 w-4 text-primary ${
                                loadingBalances ? "animate-spin" : ""
                              }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-foreground">
                            Starknet Wallet
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {accountId.startsWith("0x")
                              ? `${accountId.slice(0, 8)}...${accountId.slice(
                                  -6
                                )}`
                              : `${accountId}`}
                          </span>
                          <button
                            onClick={handleCopy}
                            className="p-1 hover:bg-primary/10 rounded transition-colors"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Balances */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">
                            USDC Balance
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            {loadingBalances ? '...' : usdcBalance.formatted}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">
                            STRK Balance
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            {loadingBalances ? '...' : strkBalance.formatted}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-4 border-t border-primary/20 space-y-2">
                        {/* <button
                          onClick={() => {
                            setShowMintModal(true);
                            setIsWalletDropdownOpen(false);
                          }}
                          disabled={minting}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <BadgeDollarSign className="h-4 w-4" />
                          {minting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Minting...</span>
                            </>
                          ) : (
                            <span>Mint Tokens</span>
                          )}
                        </button> */}
                        <button
                          onClick={handleDisconnect}
                          className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-600 border border-red-600/30 px-4 py-2 rounded-lg font-semibold transition-all duration-300"
                        >
                          <LogOut className="h-4 w-4" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden bg-gradient-to-r from-background via-background to-background/95 backdrop-blur-xl border-b border-primary/20 fixed w-full top-0 z-50 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-primary via-primary/90 to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Ajo.Save
            </span>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="border-t border-primary/20 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Navigation Links */}
            {[
              { id: "dashboard", label: "Dashboard", icon: Home },
              { id: "profile", label: "Profile", icon: User },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                    : "text-muted-foreground hover:bg-primary/10"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}

            <div className="pt-3 border-t border-primary/20">
              {accountId ? (
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-4 shadow-lg space-y-4">
                  {/* Wallet Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-foreground">
                        Starknet Wallet
                      </span>
                    </div>
                    <button
                      onClick={loadBalances}
                      disabled={loadingBalances}
                      className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <RefreshCw
                        className={`h-4 w-4 text-primary ${
                          loadingBalances ? "animate-spin" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Address */}
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-xs font-mono text-muted-foreground">
                      {accountId.startsWith("0x")
                        ? `${accountId.slice(0, 8)}...${accountId.slice(-6)}`
                        : `${accountId}`}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-primary/10 rounded transition-colors"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Balances */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background/50 p-3 rounded-lg">
                      <span className="text-xs text-muted-foreground block mb-1">
                        USDC
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {loadingBalances ? '...' : usdcBalance.formatted}
                      </span>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg">
                      <span className="text-xs text-muted-foreground block mb-1">
                        STRK
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {loadingBalances ? '...' : strkBalance.formatted}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center justify-center gap-2 bg-red-600/10 text-red-600 border border-red-600/30 px-4 py-2.5 rounded-lg font-semibold transition-all duration-300"
                    >
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all duration-300"
                >
                  <Wallet className="h-5 w-5" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Floating Create Ajo Button */}
      <div className="fixed bottom-6 right-6 z-40 cursor-pointer">
        <Whisper placement="auto" speaker={<Tooltip>Create Ajo</Tooltip>}>
          <button
            onClick={handleCreateAjoRoute}
            className="bg-gradient-to-r from-primary to-accent text-white p-4 rounded-full shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-110 group"
          >
            <Coins className="h-6 w-6 group-hover:rotate-180 transition-transform duration-300" />
          </button>
        </Whisper>
      </div>

      {/* Wallet Selection Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {/* Click outside to close dropdown */}
      {isWalletDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsWalletDropdownOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
