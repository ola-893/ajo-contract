import { useState, useEffect, useCallback } from "react";
import AjoDetailsCard from "@/components/ajo-details-page/AjoDetailsCard";
import AjoDetailsStatsGrid from "@/components/ajo-details-page/AjoDetailsStatsGrid";
import AjoDetailsNavigationTab from "@/components/ajo-details-page/AjoDetailsNavigationTab";
import AjoOverviewTab from "@/components/ajo-details-page/AjoOverviewTab";
import AjoMembers from "@/components/ajo-details-page/AjoMembers";
import AjoGovernance from "@/components/ajo-details-page/AjoGovernance";
// import AjoDetailAnalytics from "@/components/ajo-details-page/AjoDetailAnalytics";
import AjoPaymentHistory from "@/components/ajo-details-page/AjoPaymentHistory";
import { useAjoCore } from "@/hooks/useAjoCore";
import { useWallet } from "@/auth/WalletContext";
import { useTokenStore } from "@/store/tokenStore";
import {
  hederaAccountToEvmAddress,
  useAjoDetails,
  useIndividualMemberDetails,
} from "@/utils/utils";
import { useAjoFactory } from "@/hooks/useAjoFactory";
import { useParams } from "react-router-dom";
import { useAjoDetailsStore } from "@/store/ajoDetailsStore";
import Header from "@/components/header/Header";
import useAjoMembers from "@/hooks/useAjoMembers";
import { usePaymentStore } from "@/store/ajoPaymentStore";
import useAjoPayment from "@/hooks/useAjoPayment";

const AjoDetails = () => {
  const { ajoId, ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  const parsedId = ajoId ? parseInt(ajoId, 10) : 0;
  const { address } = useTokenStore();
  const ajo = useAjoDetails();
  const member = useIndividualMemberDetails(address ? address : "");
  const {
    getMemberInfo,
    // getQueueInfo,
    getTokenConfig,
    // needsToPayThisCycle,
  } = useAjoCore(ajoCore ? ajoCore : "");
  const { getAllMembersDetails } = useAjoMembers(ajo ? ajo?.ajoMembers : "");
  const loadNewAjo = useAjoDetailsStore((state) => state.loadNewAjo);
  const { getAjoOperationalStatus } = useAjoFactory();
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { monthlyPayment, setMonthlyPayment } = usePaymentStore();
  const { getCurrentCycleDashboard } = useAjoPayment(
    ajo ? ajo?.ajoPayments : ""
  );
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    if (parsedId) {
      loadNewAjo(parsedId);
    }
  }, [parsedId, loadNewAjo]);

  // operational status
  const _getAjoOperationalStatus = useCallback(async () => {
    try {
      const status = await getAjoOperationalStatus(parsedId, ajo);
      console.log("✅ Ajo details:", status);
    } catch (err) {
      console.error("Error fetching Ajo operational status:", err);
    }
  }, [parsedId, ajo]);

  //  Get member info
  const _getMemberInfo = useCallback(async () => {
    try {
      const evmAddress = hederaAccountToEvmAddress(address ? address : "");
      const info = await getMemberInfo(evmAddress);
    } catch (err) {
      console.log("Error getting member info:", err);
    }
  }, []);

  // GET USER DATA
  const getUserData = useCallback(async () => {
    try {
      if (!address) {
        throw "Address not found, connect to hashpack";
      }
      // const queue = await getQueueInfo(address);
      const tokenConfig = await getTokenConfig(0);
      // console.log("Token Config", tokenConfig);
      setMonthlyPayment(Number(tokenConfig?.monthlyPayment) / 1000000);
      console.log("monthlyPayment:", monthlyPayment);
    } catch (err) {
      console.log("Error fetching member info:", err);
    }
  }, [getMemberInfo]);

  // Fetch all members
  const getAllMembers = useCallback(async () => {
    try {
      await getAllMembersDetails();
    } catch (err) {
      console.log("Error:", err);
    }
  }, [getAllMembersDetails]);

  // fetch cycle dashboard
  const cycleDashboard = useCallback(async () => {
    try {
      await getCurrentCycleDashboard();
    } catch (err) {
      console.log("Dashboard err:", err);
    }
  }, []);

  useEffect(() => {
    setIsVisible(true);
    _getMemberInfo();
    _getAjoOperationalStatus();
    getUserData();
    getAllMembers();
  }, [getMemberInfo, getAllMembersDetails]);

  useEffect(() => {
    getCurrentCycleDashboard();
  }, [getCurrentCycleDashboard]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Ajo Header */}
        <AjoDetailsCard
          ajo={ajo}
          member={member.member}
          memberLoading={member.isLoading}
          monthlyPayment={monthlyPayment}
          isVisible={isVisible}
          lastUpdated={lastUpdated}
        />

        {/* Stats Grid */}

        <AjoDetailsStatsGrid isVisible={isVisible} />
        {/* Tab Navigation */}

        <AjoDetailsNavigationTab
          isVisible={isVisible}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        {/* Tab Content */}
        <div
          className={`transform transition-all duration-500 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          {activeTab === "overview" && <AjoOverviewTab ajo={ajo} />}

          {activeTab === "members" && <AjoMembers ajo={ajo} />}
          {activeTab === "payments" && <AjoPaymentHistory />}

          {activeTab === "governance" && <AjoGovernance ajo={ajo} />}

          {/* {activeTab === "analytics" && <AjoDetailAnalytics />} */}
        </div>
      </div>
    </div>
  );
};

export default AjoDetails;
