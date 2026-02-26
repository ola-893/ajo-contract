import { useAjoCore } from "@/hooks/useAjoCore";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import { useAjoDetailsStore } from "@/store/ajoDetailsStore";
import { useAjoStore } from "@/store/ajoStore";
import { useMemberStore } from "@/store/memberInfoStore";
import { useTokenStore } from "@/store/tokenStore";
import { members } from "@/temp-data";
import formatCurrency, { formatCurrencyUSD } from "@/utils/formatCurrency";
import { formatAddress } from "@/utils/utils";
import {
  Check,
  Copy,
  DollarSign,
  ShieldCheckIcon,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface AjoDetailsStatsGridProps {
  isVisible: boolean;
}

const AjoDetailsStatsGrid = ({ isVisible }: AjoDetailsStatsGridProps) => {
  const { memberData } = useMemberStore();
  const { nairaRate } = useTokenStore();
  const { accountId: address } = useWalletInterface();
  const [copied, setCopied] = useState(false);
  const { totalMembers, totalCollateralHBAR, totalCollateralUSDC } =
    useAjoDetailsStore();
  const { ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  const { getTokenConfig } = useAjoCore(ajoCore ? ajoCore : "");
  const formattedTotalCollateralHBAR = Number(totalCollateralHBAR) / 1000000;
  const [formattedTotalCollateralUSDC, setFormattedTotalCollateralUSDC] =
    useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // GET USER DATA
  const getMonthlyPayement = useCallback(async () => {
    try {
      if (!address) {
        throw "Address not found, connect to hashpack";
      }
      const tokenConfig = await getTokenConfig(0);
      setMonthlyPayment(Number(tokenConfig?.monthlyPayment) / 1000000);
      // console.log("monthlyPayment:", monthlyPayment);
    } catch (err) {
      console.log("Error fetching member info:", err);
    }
  }, [address, getTokenConfig, monthlyPayment]);

  useEffect(() => {
    setFormattedTotalCollateralUSDC(Number(totalCollateralUSDC) / 1000000);
    getMonthlyPayement();
  }, [totalMembers, getMonthlyPayement]);

  // Copy guarantor's address
  const handleCopy = async () => {
    if (memberData) {
      await navigator.clipboard.writeText(memberData?.memberInfo.guarantor);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 transform transition-all duration-1000 delay-200 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <DollarSign className="w-3 h-3 md:w-6 md:h-6 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Monthly</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {formatCurrencyUSD(monthlyPayment)}
          {/* {formatCurrency(50 * nairaRate)} */}
        </div>
        <div className="text-sm text-muted-foreground">Payment Amount</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <Users className="w-3 h-3 md:w-6 md:h-6 text-accent" />
          </div>
          <span className="text-xs text-muted-foreground">Progress</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {totalMembers}/10
        </div>
        <div className="text-sm text-muted-foreground">Members</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <Wallet className="w-3 h-3 md:w-6 md:h-6  text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {formatCurrencyUSD(
            formattedTotalCollateralHBAR + formattedTotalCollateralUSDC
          )}
        </div>
        <div className="text-sm text-muted-foreground">Pool Value</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <ShieldCheckIcon className="w-3 h-3 md:w-6 md:h-6 text-accent" />
          </div>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-primary/20 rounded"
            title="Copy Address"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4 text-white" />
            )}
          </button>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {memberData && formatAddress(memberData?.memberInfo.guarantor)}
        </div>
        <div className="text-sm text-muted-foreground">Guarantor address</div>
      </div>
    </div>
  );
};

export default AjoDetailsStatsGrid;
