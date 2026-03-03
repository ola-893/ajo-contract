import { useState, useEffect, useCallback, useMemo } from "react";
import AjoDetailsCard from "@/components/ajo-details-page/AjoDetailsCard";
import AjoDetailsStatsGrid from "@/components/ajo-details-page/AjoDetailsStatsGrid";
import AjoDetailsNavigationTab from "@/components/ajo-details-page/AjoDetailsNavigationTab";
import AjoOverviewTab from "@/components/ajo-details-page/AjoOverviewTab";
import AjoMembers from "@/components/ajo-details-page/AjoMembers";
import AjoGovernance from "@/components/ajo-details-page/AjoGovernance";
import AjoPaymentHistory from "@/components/ajo-details-page/AjoPaymentHistory";
import AjoSchedule from "@/components/ajo-details-page/AjoSchedule";
import AjoAdvancedModules from "@/components/ajo-details-page/AjoAdvancedModules";
import { useParams } from "react-router-dom";
import Header from "@/components/header/Header";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import useStarknetAjoMembers from "@/hooks/useStarknetAjoMembers";
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetAjoCollateral from "@/hooks/useStarknetAjoCollateral";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { StarknetAjoInfo } from "@/hooks/useStarknetAjoFactory";
import { formatAddress } from "@/utils/utils";

const toBigIntValue = (value: any): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") {
    if (!value.trim()) return 0n;
    return BigInt(value);
  }
  if (typeof value === "object" && "low" in value) {
    const low = BigInt((value as any).low ?? 0);
    const high = BigInt((value as any).high ?? 0);
    return low + (high << 128n);
  }
  if (typeof value?.toString === "function") {
    const text = value.toString();
    if (!text || text === "[object Object]") return 0n;
    return BigInt(text);
  }
  return 0n;
};

const toBool = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value === "true";
  if (typeof value === "object" && value !== null) {
    if ("True" in value || "true" in value) return true;
    if ("False" in value || "false" in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const AjoDetails = () => {
  const { ajoId } = useParams<{ ajoId: string }>();
  const { isConnected, address } = useStarknetWallet();

  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [ajoInfo, setAjoInfo] = useState<StarknetAjoInfo | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [guarantorAddress, setGuarantorAddress] = useState("N/A");
  const [advancedFeatures, setAdvancedFeatures] = useState<{
    bridgeEnabled?: boolean;
    swapEnabled?: boolean;
    btcCommitmentEnabled?: boolean;
    collateralMode?: string;
  } | null>(null);
  const [collateralSummary, setCollateralSummary] = useState<{
    totalCollateral?: bigint;
    userCollateral?: bigint;
    isSufficient?: boolean;
  } | null>(null);

  const { getAjoInfo } = useStarknetAjoFactory();
  const { getTotalMembers, getGuarantor } = useStarknetAjoMembers(
    ajoInfo?.membersAddress || "",
  );
  const { getCurrentCycle: getCurrentCycleFromCore, getAdvancedFeatures } =
    useStarknetAjoCore(ajoInfo?.coreAddress || "");
  const { getTotalCollateral, getMemberCollateral, isCollateralSufficient } =
    useStarknetAjoCollateral(ajoInfo?.collateralAddress || "");

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

  const fetchModuleData = useCallback(async () => {
    if (!ajoInfo) return;

    try {
      const [membersTotal, cycle, features] = await Promise.all([
        getTotalMembers().catch(() => 0),
        getCurrentCycleFromCore().catch(() => 1),
        getAdvancedFeatures().catch(() => null),
      ]);

      setMemberCount(membersTotal || 0);
      setCurrentCycle(Number(cycle || 1));
      setAdvancedFeatures(features);

      if (address) {
        try {
          const guarantor = await getGuarantor(address);
          setGuarantorAddress(
            guarantor && !/^0x0+$/i.test(guarantor)
              ? formatAddress(guarantor)
              : "N/A",
          );
        } catch {
          setGuarantorAddress("N/A");
        }

        try {
          const [memberCollateralRaw, sufficientRaw] = await Promise.all([
            getMemberCollateral(address).catch(() => 0n),
            isCollateralSufficient(address).catch(() => false),
          ]);
          const totalCollateralRaw = await getTotalCollateral().catch(() => 0n);

          setCollateralSummary({
            totalCollateral: toBigIntValue(totalCollateralRaw),
            userCollateral: toBigIntValue(memberCollateralRaw),
            isSufficient: toBool(sufficientRaw),
          });
        } catch {
          setCollateralSummary(null);
        }
      } else {
        setGuarantorAddress("N/A");
        setCollateralSummary(null);
      }
    } catch (error) {
      console.error("Failed to fetch module data:", error);
    }
  }, [
    ajoInfo,
    getTotalMembers,
    getCurrentCycleFromCore,
    getAdvancedFeatures,
    address,
    getGuarantor,
    getTotalCollateral,
    getMemberCollateral,
    isCollateralSufficient,
  ]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (isConnected && ajoId) {
      fetchAjoDetails();
    }
  }, [isConnected, ajoId, fetchAjoDetails]);

  useEffect(() => {
    if (ajoInfo) {
      fetchModuleData();
    }
  }, [ajoInfo, fetchModuleData]);

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
          memberCount={memberCount}
          totalParticipants={ajoInfo?.config.totalParticipants ?? 10}
          guarantorAddress={guarantorAddress}
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
            <AjoOverviewTab
              ajo={ajoInfo}
              memberCount={memberCount}
              currentCycle={currentCycle}
              advancedFeatures={advancedFeatures}
              collateralSummary={collateralSummary}
            />
          )}
          {activeTab === "members" && (
            <AjoMembers ajo={ajoInfo} currentCycle={currentCycle} />
          )}
          {activeTab === "payments" && <AjoPaymentHistory ajo={ajoInfo} />}
          {activeTab === "schedule" && (
            <AjoSchedule ajo={ajoInfo} currentCycle={currentCycle} />
          )}
          {activeTab === "advanced" && <AjoAdvancedModules ajo={ajoInfo} />}
          {activeTab === "governance" && <AjoGovernance ajo={ajoInfo} />}
        </div>
      </div>
    </div>
  );
};

export default AjoDetails;
