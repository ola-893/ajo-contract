import formatCurrency, { formatCurrencyUSD } from "@/utils/formatCurrency";
import {
  Check,
  Copy,
  Wallet,
  RefreshCw,
  TrendingUp,
  Coins,
} from "lucide-react";
import { useState } from "react";

interface UserProfileCardProps {
  isVisible: boolean;
  address?: string | null;
  network?: string | null;
  hbar?: string | null;
  hbarPrice: number | null;
  usdc?: string | null;
  loading?: boolean;
  copied?: boolean;
  handleCopy?: () => void;
  onRefresh?: () => void;
}

const UserProfileCard = ({
  isVisible,
  address,
  network,
  hbar,
  usdc,
  loading,
  copied,
  hbarPrice,
  handleCopy,
  onRefresh,
}: UserProfileCardProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const isMetaMask = address?.startsWith("0x");

  const handleRefreshClick = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setTimeout(() => setRefreshing(false), 1000);
    }
  };
  const hbarInUsd = Number(hbar) * (hbarPrice ?? 0);
  // Calculate total balance in USD (if available)
  const totalBalanceUSD = (Number(usdc) || 0) + (hbarInUsd || 0);

  return (
    <div
      className={`transform transition-all duration-1000 mb-4 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      {/* Main Card */}
      <div className="bg-gradient-to-br from-card via-card to-card/95 backdrop-blur-xl border border-primary/20 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Section with Gradient Background */}
        <div className="relative bg-gradient-to-r from-primary via-yellow-500 to-accent p-6 sm:p-8">
          {/* Decorative overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/20"></div>

          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute top-0 -right-4 w-40 h-40 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 -left-4 w-40 h-40 bg-white rounded-full blur-3xl"></div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Top Row: Address & Network Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              {/* Address Section */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl items-center justify-center border border-white/30">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-xs font-medium mb-1">
                    Wallet Address
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm sm:text-base font-semibold">
                      {isMetaMask
                        ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                        : address}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-all duration-300 active:scale-95"
                      title="Copy Address"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-300" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/90" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Network Badge */}
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-sm">
                  Hedera Testnet
                </span>
              </div>
            </div>

            {/* Wallet Balance Label */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-white/90" />
                <h2 className="text-white/90 text-sm sm:text-base font-semibold">
                  Wallet Balance
                </h2>
              </div>
              {onRefresh && (
                <button
                  onClick={handleRefreshClick}
                  disabled={refreshing || loading}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all duration-300 disabled:opacity-50"
                  title="Refresh Balances"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-white ${
                      refreshing || loading ? "animate-spin" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Balance Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* USDC Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <img
                      src="/images/profile/usdc.png"
                      alt="USDC"
                      className="w-6 h-6"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-medium">USDC</p>
                    <p className="text-white/40 text-[10px]">USD Coin</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  {loading ? (
                    <div className="h-8 w-24 bg-white/20 rounded-lg animate-pulse"></div>
                  ) : (
                    <>
                      <span className="text-white text-2xl sm:text-3xl font-bold">
                        {usdc || "0.00"}
                      </span>
                      <span className="text-white/60 text-sm font-medium">
                        USDC
                      </span>
                    </>
                  )}
                </div>
                {usdc !== null && (
                  <p className="text-white/50 text-xs mt-2">
                    ≈{formatCurrencyUSD(usdc ? Number(usdc) : 0)}
                  </p>
                )}
              </div>

              {/* HBAR Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <img
                      src="/images/profile/hedera.png"
                      alt="HBAR"
                      className="w-6 h-6"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-medium">HBAR</p>
                    <p className="text-white/40 text-[10px]">Hedera</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  {loading ? (
                    <div className="h-8 w-24 bg-white/20 rounded-lg animate-pulse"></div>
                  ) : (
                    <>
                      <span className="text-white text-2xl sm:text-3xl font-bold">
                        {hbar || "0.00"}
                      </span>
                      <span className="text-white/60 text-sm font-medium">
                        HBAR
                      </span>
                    </>
                  )}
                </div>
                {hbar !== null && (
                  <p className="text-white/50 text-xs mt-2">
                    ≈ {formatCurrencyUSD(hbar ? hbarInUsd : 0)}
                  </p>
                )}
              </div>
            </div>

            {/* Total Balance (if NGN values available) */}
            {totalBalanceUSD > 0 && (
              <div className="mt-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                <p className="text-white/60 text-xs font-medium mb-1">
                  Total Portfolio Value
                </p>
                <p className="text-white text-2xl sm:text-3xl font-bold">
                  {totalBalanceUSD.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    style: "currency",
                    currency: "USD",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <button className="bg-card hover:bg-card/80 border border-primary/20 rounded-xl p-4 transition-all duration-300 hover:scale-105">
          <Coins className="w-6 h-6 text-primary mb-2 mx-auto" />
          <p className="text-xs font-semibold text-foreground">Join Ajo</p>
        </button>
        <button className="bg-card hover:bg-card/80 border border-primary/20 rounded-xl p-4 transition-all duration-300 hover:scale-105">
          <TrendingUp className="w-6 h-6 text-green-500 mb-2 mx-auto" />
          <p className="text-xs font-semibold text-foreground">History</p>
        </button>
        <button className="bg-card hover:bg-card/80 border border-primary/20 rounded-xl p-4 transition-all duration-300 hover:scale-105">
          <Wallet className="w-6 h-6 text-blue-500 mb-2 mx-auto" />
          <p className="text-xs font-semibold text-foreground">Send</p>
        </button>
        <button className="bg-card hover:bg-card/80 border border-primary/20 rounded-xl p-4 transition-all duration-300 hover:scale-105">
          <RefreshCw className="w-6 h-6 text-purple-500 mb-2 mx-auto" />
          <p className="text-xs font-semibold text-foreground">Swap</p>
        </button>
      </div> */}
    </div>
  );
};

export default UserProfileCard;
