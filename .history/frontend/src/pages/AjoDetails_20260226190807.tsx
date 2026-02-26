import { useState, useEffect, useCallback } from "react";
import AjoDetailsCard from "@/components/ajo-details-page/AjoDetailsCard";
import AjoDetailsStatsGrid from "@/components/ajo-details-page/AjoDetailsStatsGrid";
import AjoDetailsNavigationTab from "@/components/ajo-details-page/AjoDetailsNavigationTab";
import AjoOverviewTab from "@/components/ajo-details-page/AjoOverviewTab";
import AjoMembers from "@/components/ajo-details-page/AjoMembers";
import AjoGovernance from "@/components/ajo-details-page/AjoGovernance";
import AjoPaymentHistory from "@/components/ajo-details-page/AjoPaymentHistory";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/header/Header";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetAjoMembers from "@/hooks/useStarknetAjoMembers";
import useStarknetAjoPayments from "@/hooks/useStarknetAjoPayments";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface AjoInfo {
  id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

interface AjoConfig {
  [key: string]: unknown;
}

interface AjoMember {
  [key: string]: unknown;
}

const AjoDetails = () => {
  const { ajoId } = useParams<{ ajoId: string }>();
  const navigate = useNavigate();
  const { address, isConnected } = useStarknetWallet();
  
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  // Ajo data state
  const [ajoInfo, setAjoInfo] = useState<AjoInfo | null>(null);
  const [ajoConfig, setAjoConfig] = useState<AjoConfig | null>(null);
  const [members, setMembers] = useState<AjoMember[]>([]);
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  
  // TODO: These addresses will come from the factory contract
  // For now, we'll use placeholder addresses
  const ajoCoreAddress = ""; // Will be fetched from factory
  const ajoMembersAddress = ""; // Will be fetched from factory
  const ajoPaymentsAddress = ""; // Will be fetched from factory
  
  const { getAjoInfo } = useStarknetAjoFactory();
  const ajoCore = useStarknetAjoCore(ajoCoreAddress);
  const ajoMembers = useStarknetAjoMembers(ajoMembersAddress);
  const ajoPayments = useStarknetAjoPayments(ajoPaymentsAddress);

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

      // TODO: Once we have the contract addresses from factory, fetch more details
      // const config = await ajoCore.getConfig();
      // setAjoConfig(config);
      
      // const allMembers = await ajoMembers.getAllMembers();
      // setMembers(allMembers);
      
      // const cycle = await ajoPayments.getCurrentCycle();
      // setCurrentCycle(cycle);

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
            <span className="ml-3 text-muted-foreground">Loading Ajo details...</span>
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
        {/* Temporary placeholder until we implement full details */}
        <div className="bg-card p-8 rounded-xl border border-border mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-card-foreground mb-2">
                Ajo #{ajoId}
              </h1>
              <p className="text-muted-foreground">
                On Starknet Sepolia
              </p>
            </div>
            <button
              onClick={fetchAjoDetails}
              className="p-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-5 w-5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {ajoInfo ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ajo information loaded successfully
              </p>
              {/* TODO: Display actual Ajo data here */}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No data available for this Ajo yet
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation - Commented out until components are updated */}
        {/* <AjoDetailsNavigationTab
          isVisible={isVisible}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        /> */}

        {/* Tab Content - Commented out until data is available */}
        {/* <div
          className={`transform transition-all duration-500 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          {activeTab === "overview" && <AjoOverviewTab ajo={ajoInfo} />}
          {activeTab === "members" && <AjoMembers ajo={ajoInfo} />}
          {activeTab === "payments" && <AjoPaymentHistory />}
          {activeTab === "governance" && <AjoGovernance ajo={ajoInfo} />}
        </div> */}
      </div>
    </div>
  );
};

export default AjoDetails;
