import { useState, useEffect } from "react";
import Header from "@/components/header/Header";
import formatCurrency from "@/utils/formatCurrency";
import { TrendingUp, Zap, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import { toast } from "sonner";

const Ajo = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const { address, isConnected } = useStarknetWallet();
  const { getUserAjos, loading } = useStarknetAjoFactory();
  const [userAjos, setUserAjos] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user's Ajos
  const fetchAjos = async () => {
    if (!address || !isConnected) return;

    try {
      setIsRefreshing(true);
      const ajos = await getUserAjos(address);
      setUserAjos(ajos || []);
    } catch (error) {
      console.error("Failed to fetch Ajos:", error);
      toast.error("Failed to load Ajos");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      fetchAjos();
    }
  }, [isConnected, address]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Page header */}
          <div
            className={`flex items-center justify-between transform transition-all duration-1000 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">
                Digital Ajo Groups
              </h2>
              <p className="text-muted-foreground">
                Traditional savings, modern yields
              </p>
            </div>
            <button
              onClick={() => navigate("/ajo/create-ajo")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Create New Ajo
            </button>
          </div>

          {/* Highlight card */}
          <div
            className={`bg-gradient-to-br from-primary to-accent text-primary-foreground p-6 rounded-xl transform transition-all duration-1000 delay-200 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">
                Starknet-Powered Savings
              </h3>
              <button
                onClick={fetchAjos}
                disabled={isRefreshing || loading}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing || loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <p className="text-sm text-white/80 mb-3">
              Transparent, on-chain savings groups powered by Cairo smart contracts
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-background/20 px-3 py-1 rounded-full">
                <Zap className="h-3 w-3 inline mr-1" />
                Blockchain-secured
              </div>
              <div className="bg-background/20 px-3 py-1 rounded-full">
                {userAjos.length} Active
              </div>
            </div>
          </div>

          {/* Groups grid */}
          <div
            className={`grid gap-4 transform transition-all duration-1000 delay-300 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            {loading || isRefreshing ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading Ajos...</span>
              </div>
            ) : !isConnected ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground mb-4">
                  Connect your wallet to view your Ajos
                </p>
              </div>
            ) : userAjos.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground mb-4">
                  You haven't joined or created any Ajos yet
                </p>
                <button
                  onClick={() => navigate("/ajo/create-ajo")}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Create Your First Ajo
                </button>
              </div>
            ) : (
              userAjos.map((ajo, index) => (
                <div
                  key={index}
                  className={`bg-card/60 rounded-xl shadow-sm border border-border/30 p-6 transition-all duration-700 cursor-pointer hover:shadow-md hover:border-primary/30 ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-10"
                  }`}
                  style={{ transitionDelay: `${400 + index * 150}ms` }}
                  onClick={() => navigate(`/ajo/${index}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground">
                        Ajo #{index + 1}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        On Starknet Sepolia
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="text-sm font-bold text-primary">
                        Active
                      </p>
                    </div>
                  </div>

                  <div className="bg-primary/10 rounded-lg p-4 mb-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to view details and manage your Ajo
                    </p>
                  </div>

                  <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                    View Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ajo;
