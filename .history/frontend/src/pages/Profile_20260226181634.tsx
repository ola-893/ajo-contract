import { useState, useEffect } from "react";
import { useWallet } from "@/auth/WalletContext";
import { useTokenStore } from "@/store/tokenStore";
import StatsCard from "@/components/profile/StatsCard";
import ProfileNavigationTab from "@/components/profile/ProfileNavigationTab";
import ProfileOverview from "@/components/profile/ProfileOverview";
import ProfileAjoGroups from "@/components/profile/ProfileAjoGroups";
import UserProfileCard from "@/components/profile/UserProfileCard";
import ProfileNftPage from "@/components/profile/ProfileNftPage";
import ProfileRecentActivity from "@/components/profile/ProfileRecentActivity";
// import useAjoCore from "@/hooks/useAjoCore";
import { useAjoStore } from "@/store/ajoStore";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/header/Header";
import { toast } from "sonner";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

const Profile = () => {
  // const { ajoId, ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  // const { getMemberInfo, needsToPayThisCycle } = useAjoCore(
  //   ajoCore ? ajoCore : ""
  // );
  const navigate = useNavigate();
  const { isConnected } = useStarknetWallet();
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("ajo");
  const { hbar, usdc, loading, address } = useTokenStore();
  const [copied, setCopied] = useState(false);
  const [hbarPrice, setHbarPrice] = useState<number | null>(null);

  // Redirect to homepage if wallet is not connected
  useEffect(() => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      navigate("/dashboard");
      return;
    }
    setIsVisible(true);
    console.log("hbar balance:", hbar);
  }, [isConnected, navigate]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [hbarRes, hbarUsdRes, usdcRes] = await Promise.all([
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=ngn",
          ),
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd",
          ),
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn",
          ),
        ]);

        const [hbarData, hbarUsdData, usdcData] = await Promise.all([
          hbarRes.json(),
          hbarUsdRes.json(),
          usdcRes.json(),
        ]);

        const hbarPrice = hbarData?.["hedera-hashgraph"]?.ngn ?? 0;
        const hbarUsdPrice = hbarUsdData?.["hedera-hashgraph"]?.usd ?? 0;
        const usdcPrice = usdcData?.["usd-coin"]?.ngn ?? 0;

        // console.log("HBAR Price NGN:", hbarPrice);
        // console.log("HBAR Price USD:", hbarUsdPrice);
        // console.log("USDC Price NGN:", usdcPrice);

        // if you already have balances
        if (hbar) setHbarPrice(parseFloat(hbarUsdPrice));
      } catch (error) {
        console.error("Failed to fetch prices:", error);
      }
    };
    // if (address) {
    //   getMemberInfo(address);
    //   needsToPayThisCycle(address);
    // }

    fetchPrices();
  }, [hbar, usdc]);

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Profile Header */}

        <UserProfileCard
          address={address}
          isVisible={isVisible}
          hbar={hbar}
          usdc={usdc}
          hbarPrice={hbarPrice}
          loading={loading}
          copied={copied}
          handleCopy={handleCopy}
        />

        {/* Stats Cards */}
        {/* <StatsCard isVisible={isVisible} /> */}
        {/* Navigation Tabs */}
        <ProfileNavigationTab
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
          {/* {activeTab === "overview" && <ProfileOverview />} */}

          {activeTab === "ajo" && <ProfileAjoGroups />}

          {activeTab === "nfts" && <ProfileNftPage />}
          {/* 
          {activeTab === "activity" && <ProfileRecentActivity />} */}
        </div>
      </div>
    </div>
  );
};

export default Profile;
