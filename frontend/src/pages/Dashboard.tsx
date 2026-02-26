/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmptyState } from "@/components/dashboard/EmptyState";
import Header from "@/components/header/Header";
import AjoCard from "@/components/shared/AjoCard";
import { useAjoStore } from "@/store/ajoStore";
import { Shield, Users, Star, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import formatCurrency from "@/utils/formatCurrency";
import { toast } from "sonner";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

const Dashboard = () => {
  const { address, isConnected } = useStarknetWallet();
  const { getUserAjos, loading: factoryLoading } = useStarknetAjoFactory();
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [userAjos, setUserAjos] = useState<any[]>([]);

  // Fetch user's Ajos from Starknet
  const fetchAjos = useCallback(
    async (showToast = false) => {
      if (!address || !isConnected) {
        console.log("Wallet not connected");
        return;
      }

      try {
        setIsRefreshing(true);
        console.log("🔄 Fetching user Ajos from Starknet...");
        
        const ajos = await getUserAjos(address);
        console.log("✅ Fetched Ajos:", ajos);
        
        setUserAjos(ajos || []);
        setLastUpdate(new Date());
        
        if (showToast) {
          toast.success("Ajos refreshed successfully");
        }
      } catch (err) {
        console.error("❌ Failed to fetch ajos:", err);
        if (showToast) {
          toast.error("Failed to refresh Ajos");
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [address, isConnected, getUserAjos]
  );

  // Initial load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Initial fetch when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchAjos();
    }
  }, [isConnected, address, fetchAjos]);

  const handleRoute = () => {
    navigate("/ajo/create-ajo");
  };

  const handleManualRefresh = () => {
    fetchAjos(true); // Show toast on manual refresh
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 h-auto mt-16 lg:px-8 py-6">
        <div
          className={`space-y-6 mt-8 transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          {/* Welcome Banner with Refresh Button */}
          <div className="bg-gradient-to-br from-primary to-accent text-primary-foreground p-6 rounded-xl shadow-lg border border-border">
            <div className="flex items-start w-full">
              <div className="w-full">
                <div className="flex justify-between items-start w-full">
                  <h2 className="text-2xl font-bold mb-2">Welcome</h2>
                  {/* Refresh Button */}
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh Ajos"
                  >
                    <RefreshCw
                      size={18}
                      className={isRefreshing ? "animate-spin" : ""}
                    />
                    <span className="text-sm font-medium">Refresh</span>
                  </button>
                </div>
                <p className="text-primary-foreground/90">Ajo Platform</p>
                <p className="text-sm text-primary-foreground/80 mt-2 w-full">
                  Transparency on-chain, blockchain-powered savings groups.
                  Build wealth with your community.
                </p>
              </div>
            </div>

            {/* Last Update Timestamp */}
            {lastUpdate && (
              <p className="text-xs text-primary-foreground/70 mt-3">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Stats Cards */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-4 transform transition-all duration-1000 delay-200 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-all hover:scale-105 hover:border-primary/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">My Ajos</p>
                  <p className="text-2xl font-bold text-foreground">
                    {userAjos.length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>

            {/* <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-all hover:scale-105 hover:border-accent/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">
                    Total Ajo Pools
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(0)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-accent" />
              </div>
            </div> */}

            <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-all hover:scale-105 hover:border-secondary/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Cultural NFTs</p>
                  <p className="text-2xl font-bold text-foreground">0</p>
                </div>
                <Star className="h-8 w-8 text-secondary" />
              </div>
            </div>
          </div>

          {/* Ajo Cards */}
          {isRefreshing || factoryLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading your Ajos...</span>
            </div>
          ) : userAjos.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userAjos.map((ajo, index) => (
                <div
                  key={index}
                  className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-all hover:scale-105"
                >
                  <h3 className="text-lg font-semibold mb-2">Ajo #{index + 1}</h3>
                  <p className="text-sm text-muted-foreground">
                    Click to view details
                  </p>
                  {/* TODO: Add more Ajo details once we fetch from getAjoInfo */}
                </div>
              ))}
            </div>
          ) : !isConnected ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Connect your wallet to view your Ajos
              </p>
            </div>
          ) : (
            <EmptyState onCreateAjo={handleRoute} />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
