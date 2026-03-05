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
import { useTokenBalance } from "@/hooks/useTokenBalance";

const Profile = () => {
  // const { ajoId, ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  // const { getMemberInfo, needsToPayThisCycle } = useAjoCore(
  //   ajoCore ? ajoCore : ""
  // );
  const navigate = useNavigate();
  const { isConnected, address: walletAddress } = useStarknetWallet();
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("ajo");
  const { setStrk, setEth, setUsdc, setAddress, setLoading } = useTokenStore();
  const [copied, setCopied] = useState(false);
  const [strkPrice, setStrkPrice] = useState<number | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  // Fetch token balances using the hook
  const strkBalance = useTokenBalance("STRK");
  const btcBalance = useTokenBalance("BTC");
  const usdcBalance = useTokenBalance("USDC");

  // Update token store when balances change
  useEffect(() => {
    if (walletAddress) {
      setAddress(walletAddress);
    }
  }, [walletAddress, setAddress]);

  useEffect(() => {
    setStrk(strkBalance.balance.formatted);
    setEth(btcBalance.balance.formatted);
    setUsdc(usdcBalance.balance.formatted);
    setLoading(strkBalance.loading || btcBalance.loading || usdcBalance.loading);
    
    console.log("STRK balance:", strkBalance.balance.formatted);
    console.log("BTC balance:", btcBalance.balance.formatted);
    console.log("USDC balance:", usdcBalance.balance.formatted);
  }, [
    strkBalance.balance.formatted,
    btcBalance.balance.formatted,
    usdcBalance.balance.formatted,
    strkBalance.loading,
    btcBalance.loading,
    usdcBalance.loading,
    setStrk,
    setEth,
    setUsdc,
    setLoading,
  ]);

  // Redirect to homepage if wallet is not connected
  useEffect(() => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      navigate("/");
      return;
    }
    setIsVisible(true);
  }, [isConnected, navigate]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const [strkRes, btcRes] = await Promise.all([
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd",
          ),
          fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
          ),
        ]);

        const [strkData, btcData] = await Promise.all([
          strkRes.json(),
          btcRes.json(),
        ]);

        const strkUsdPrice = strkData?.["starknet"]?.usd ?? 0;
        const btcUsdPrice = btcData?.["bitcoin"]?.usd ?? 0;

        console.log("STRK Price USD:", strkUsdPrice);
        console.log("BTC Price USD:", btcUsdPrice);

        setStrkPrice(parseFloat(strkUsdPrice));
        setBtcPrice(parseFloat(btcUsdPrice));
      } catch (error) {
        console.error("Failed to fetch prices:", error);
      }
    };

    fetchPrices();
  }, []);

  const handleCopy = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success("Address copied!");
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
          address={walletAddress}
          isVisible={isVisible}
          strk={strkBalance.balance.formatted}
          eth={btcBalance.balance.formatted}
          usdc={usdcBalance.balance.formatted}
          strkPrice={strkPrice}
          ethPrice={btcPrice}
          loading={strkBalance.loading || btcBalance.loading || usdcBalance.loading}
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
