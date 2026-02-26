/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import type { AjoInfo } from "@/store/ajoStore";
import { useTokenStore } from "@/store/tokenStore";
import formatCurrency, { formatCurrencyUSD } from "@/utils/formatCurrency";
import { formatAddress, formatTimestamp } from "@/utils/utils";
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AjoCardProps {
  ajo: AjoInfo;
  isVisible: boolean;
}

const AjoCard = ({ ajo, isVisible }: AjoCardProps) => {
  const navigate = useNavigate();
  const { nairaRate } = useTokenStore();
  const { accountId } = useWalletInterface();

  const handleAjoRoute = () => {
    if (accountId) {
      navigate(`/ajo/${ajo.ajoId}/${ajo.ajoCore}`);
    } else toast.info("Connect your wallet to view ajo");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Zap className="w-4 h-4" />;
      case "forming":
        return <Users className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "forming":
        return "bg-accent/20 text-accent border border-accent/30";
      case "completed":
        return "bg-secondary/20 text-secondary-foreground border border-secondary/30";
      default:
        return "bg-muted/20 text-muted-foreground border border-muted/30";
    }
  };

  return (
    <div
      className={`bg-gradient-to-br from-card to-[#2b1a0f]/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 group cursor-pointer transform duration-300 border border-border/50 hover:border-primary/30 h-fit ${"delay-100"} ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      {/* Card Header */}
      <div className="p-6 border-b border-border/30 bg-accent/10 rounded-t-xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-card-foreground group-hover:text-primary transition-colors mb-1">
              {ajo.name}
            </h3>
          </div>

          {/* <div
            className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(
              "forming"
            )}`}
          >
            {getStatusIcon("forming")}
            <span className="capitalize">forming</span>
          </div> */}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
              #{ajo.ajoId}
            </div>
            <span className="text-muted-foreground">
              by {formatAddress(ajo.creator)}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-accent fill-current" />
            <span className="font-semibold text-card-foreground">0</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-3">
          Created: {formatTimestamp(ajo.createdAt)}
        </p>
      </div>

      {/* Card Body */}
      <div className="p-6 bg-gradient-to-b from-transparent to-card/30">
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* <div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(nairaRate * 50)}
            </div>
            <div className="text-xs text-muted-foreground">Monthly Payment</div>
          </div> */}

          {/* <div>
            <div className="text-2xl font-bold text-accent">
              {ajoData.activeMembers}/5
            </div>
            <div className="text-xs text-muted-foreground">Members</div>
          </div> */}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">Monthly Payment</div>
            <div className="text-lg font-bold text-primary">
              {formatCurrencyUSD(Number(ajo.ajoMonthlyPaymentUSDC) / 1000000)}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-xs text-muted-foreground">
              Payment Token:
            </span>
            <span className="font-semibold text-card-foreground flex items-center space-x-1">
              <Coins className="w-4 h-4 text-primary" />
              <span>USDC</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-xs text-muted-foreground">Cycle:</span>
            <span className="font-semibold text-card-foreground flex items-center space-x-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span>10</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">Expected Payout</div>
            <div className="text-lg font-bold text-primary">
              {formatCurrencyUSD(
                (Number(ajo.ajoMonthlyPaymentUSDC) / 1000000) * 10
              )}
            </div>
          </div>

          {/* <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Next Payout:</span>
            <span className="font-semibold text-card-foreground flex items-center space-x-1">
              <Clock className="w-4 h-4 text-accent" />
              <span>{ajoData.nextPayout}</span>
            </span>
          </div> */}

          {/* <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Saved:</span>
            <span className="font-semibold text-white">
              {formatCurrency(Number(ajoData.totalCollateralUSDC) * nairaRate)}
            </span>
          </div> */}
          {/* 
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Completed Cycles:</span>
            <span className="font-semibold text-card-foreground flex items-center space-x-1">
              <Award className="w-4 h-4 text-primary" />
              <span>0</span>
            </span>
          </div> */}
        </div>

        {/* Progress Bar */}
        {/* <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Member Progress</span>
            <span>
              {Math.round((Number(ajoData.activeMembers) / 10) * 100)}%
            </span>
          </div>
          <div className="w-full bg-background/50 rounded-full h-2 border border-border mt-4">
            <div
              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-1000 shadow-sm"
              style={{
                width: `${
                  ajoData.activeMembers == "0"
                    ? "0"
                    : (Number(ajoData.activeMembers) / 10) * 100
                }%`,
              }}
            ></div>
          </div>
        </div> */}

        {/* Action Button */}
        <button
          onClick={handleAjoRoute}
          className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 group border border-primary/20 shadow-md cursor-pointer"
        >
          <span>
            {/* {ajoData.status === "forming" ? "Join ajo" : "View Details"} */}
            View Details
          </span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default AjoCard;
