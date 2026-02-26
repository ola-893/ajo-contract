/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Menu,
  X,
  Home,
  User,
  Coins,
  LogOut,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import WalletModal from "../ui/WalletModal";
import { STARKNET_NETWORKS } from "@/config/networks";
import { STARKNET_CONFIG } from "@/config/constants";

// Helper to shorten address for display
const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const StarknetHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);

  const { address, isConnected, disconnectWallet, chainId } = useStarknetWallet();

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      toast.success("Wallet disconnected");
      navigate("/");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  // Get current network name
  const currentNetwork = Object.values(STARKNET_NETWORKS).find(
    (net) => net.chainId === chainId
  )?.name || "Unknown Network";

  // Update active tab based on route
  useEffect(() => {
    const path = location.pathname;
    if (path === "/dashboard") setActiveTab("dashboard");
    else if (path === "/profile") setActiveTab("profile");
    else if (path.startsWith("/ajo")) setActiveTab("ajo");
  }, [location.pathname]);

  const handleNavigation = (path: string, itemId: string) => {
    // Check if trying to access profile without wallet connection
    if (itemId === "profile" && !isConnected) {
      toast.error("Please connect your wallet first");
      setIsWalletModalOpen(true);
      return;
    }
    
    setActiveTab(itemId);
    navigate(path);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, path: "/dashboard" },
    { id: "ajo", label: "My Ajos", icon: Coins, path: "/dashboard" },
    { id: "profile", label: "Profile", icon: User, path: "/profile" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <img
                src="/images/homepage/ajo-logo.png"
                alt="Ajo Logo"
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-white">
                Ajo<span className="text-primary">.Save</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-1 text-xs bg-primary/20 text-primary rounded-md">
                Starknet
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path, item.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-white hover:bg-primary/10"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Wallet Section */}
            <div className="flex items-center space-x-2">
              {isConnected && address ? (
                <div className="relative">
                  <button
                    onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-white hidden sm:inline">
                        {shortenAddress(address)}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* Wallet Dropdown */}
                  {isWalletDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsWalletDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-background border border-primary/20 rounded-lg shadow-xl z-50">
                        <div className="p-4 border-b border-primary/20">
                          <p className="text-xs text-muted-foreground mb-1">
                            Connected to {currentNetwork}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-mono text-white">
                              {shortenAddress(address)}
                            </p>
                            <button
                              onClick={handleCopy}
                              className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              {copied ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="p-2">
                          <button
                            onClick={handleDisconnect}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Disconnect</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Connect Wallet
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-muted-foreground hover:text-white"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <nav className="md:hidden py-4 border-t border-primary/20">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleNavigation(item.path, item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        activeTab === item.id
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-white hover:bg-primary/10"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  );
};

export default StarknetHeader;
