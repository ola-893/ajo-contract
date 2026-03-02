import { useState, useEffect, useCallback, useMemo } from "react";
import AjoDetailsCard from "@/components/ajo-details-page/AjoDetailsCard";
import AjoDetailsStatsGrid from "@/components/ajo-details-page/AjoDetailsStatsGrid";
import AjoDetailsNavigationTab from "@/components/ajo-details-page/AjoDetailsNavigationTab";
import AjoOverviewTab from "@/components/ajo-details-page/AjoOverviewTab";
import AjoMembers from "@/components/ajo-details-page/AjoMembers";
import AjoGovernance from "@/components/ajo-details-page/AjoGovernance";
import AjoPaymentHistory from "@/components/ajo-details-page/AjoPaymentHistory";
import { useParams } from "react-router-dom";
import Header from "@/components/header/Header";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { StarknetAjoInfo } from "@/hooks/useStarknetAjoFactory";

const AjoDetails = () => {
  const { ajoId } = useParams<{ ajoId: string }>();
  const { isConnected } = useStarknetWallet();

  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [ajoInfo, setAjoInfo] = useState<StarknetAjoInfo | null>(null);

  const { getAjoInfo } = useStarknetAjoFactory();

  const monthlyPayment = useMemo(() => {
    if (!ajoInfo) return null;
    const decimals = ajoInfo.config.paymentToken === "BTC" ? 8 : 6;
    const divisor = 10 ** decimals;
    return Number(ajoInfo.config.monthlyContribution) / divisor;
  }, [ajoInfo]);

  // Fetch Ajo details
  const fetchAjoDetails = useCallback(async () => {
    if (!ajoId || !isConnected) return;

    setLoading(true);
    try {
      console.log("📡 Fetching Ajo details for ID:", ajoId);

      // Fetch basic Ajo info from factory
      const info = await getAjoInfo(ajoId);
      setAjoInfo(info);
      console.log("✅ Ajo info:", info);

      setLastUpdated(new Date());
      toast.success("Ajo details loaded");
    } catch (error) {
      console.error("❌ Failed to fetch Ajo details:", error);
      toast.error("Failed to load Ajo details");
    } finally {
      setLoading(false);
    }
  }, [ajoId, isConnected, getAjoInfo]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (isConnected && ajoId) {
      fetchAjoDetails();
    }
  }, [isConnected, ajoId, fetchAjoDetails]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground mb-4">
              Connect your wallet to view Ajo details
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">
              Loading Ajo details...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <AjoDetailsCard
          ajo={ajoInfo}
          member={null}
          memberLoading={false}
          monthlyPayment={monthlyPayment}
          isVisible={isVisible}
          lastUpdated={lastUpdated}
          onRefresh={fetchAjoDetails}
        />

        <AjoDetailsStatsGrid
          isVisible={isVisible}
          monthlyPayment={monthlyPayment}
          memberCount={0}
          totalParticipants={ajoInfo?.config.totalParticipants ?? 10}
        />

        <AjoDetailsNavigationTab
          isVisible={isVisible}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div
          className={`transform transition-all duration-500 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          {activeTab === "overview" && (
            <AjoOverviewTab ajo={ajoInfo} memberCount={0} currentCycle={1} />
          )}
          {activeTab === "members" && <AjoMembers ajo={ajoInfo} />}
          {activeTab === "payments" && <AjoPaymentHistory />}
          {activeTab === "governance" && <AjoGovernance ajo={ajoInfo} />}
        </div>
      </div>
    </div>
  );
};

export default AjoDetails;
