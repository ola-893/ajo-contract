import {
  CheckCircle,
  Coins,
  Shield,
  Target,
} from "lucide-react";
import type { StarknetAjoInfo } from "@/hooks/useStarknetAjoFactory";
import CycleCountdown from "./CycleCountdown";

const AjoOverviewTab = ({
  ajo,
  memberCount = 0,
  currentCycle = 1,
  cycleStartTime,
  advancedFeatures,
  collateralSummary,
}: {
  ajo: StarknetAjoInfo | null | undefined;
  memberCount?: number;
  currentCycle?: number;
  cycleStartTime?: number;
  advancedFeatures?: {
    bridgeEnabled?: boolean;
    swapEnabled?: boolean;
    btcCommitmentEnabled?: boolean;
    collateralMode?: string;
  } | null;
  collateralSummary?: {
    totalCollateral?: bigint;
    userCollateral?: bigint;
    isSufficient?: boolean;
  } | null;
}) => {
  const totalParticipants = ajo?.config.totalParticipants ?? 10;
  const progressPercent =
    totalParticipants > 0 ? ((currentCycle - 1) / totalParticipants) * 100 : 0;
  const cycleLengthLabel = formatCycleDuration(
    Number(ajo?.config.cycleDuration ?? 30 * 24 * 60 * 60),
  );

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Target className="w-6 h-6 text-primary" />
            <span>Current Cycle Progress</span>
          </h3>

          <div className="space-y-4">
            {cycleStartTime && ajo?.config.cycleDuration && (
              <CycleCountdown
                cycleStartTime={cycleStartTime}
                cycleDuration={ajo.config.cycleDuration}
                currentCycle={currentCycle}
              />
            )}

            <div className="flex justify-between items-center">
              <span className=" text-sm text-muted-foreground">
                Cycle {currentCycle} of {totalParticipants}
              </span>
              <span className="text-sm font-semibold text-card-foreground">
                Next payout: Queue {Math.max(1, currentCycle)}
              </span>
            </div>

            <div className="w-full bg-background/50 rounded-full h-3 border border-border">
              <div
                className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {Math.max(0, currentCycle - 1)}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">
                  {memberCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Members
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {Math.max(0, totalParticipants - memberCount)}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary to-accent rounded-xl shadow-lg p-6 text-primary-foreground border border-primary/30">
          <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>How to participate</span>
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="font-semibold text-green-400">
                Fund wallet with USDC and STRK
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="font-semibold text-card-foreground">
                Join Ajo and lock required collateral
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-secondary-foreground" />
              <span className="font-semibold text-card-foreground">
                Make monthly payments
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="font-semibold text-green-400">
                Receive payout when it is your turn
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4">
            Key Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Token:</span>
              <span className="font-semibold text-card-foreground flex items-center gap-1">
                <Coins className="w-4 h-4 text-primary" />
                {ajo?.config.paymentToken ?? "USDC"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cycle Length:</span>
              <span className="font-semibold text-card-foreground">
                {cycleLengthLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Privacy:</span>
              <span className="font-semibold text-card-foreground">Public</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4">
            Module Status
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collateral Mode:</span>
              <span className="font-semibold text-card-foreground">
                {advancedFeatures?.collateralMode ?? "L2Escrow"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bridge:</span>
              <span className="font-semibold text-card-foreground">
                {advancedFeatures?.bridgeEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Swap Router:</span>
              <span className="font-semibold text-card-foreground">
                {advancedFeatures?.swapEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">BTC Commitments:</span>
              <span className="font-semibold text-card-foreground">
                {advancedFeatures?.btcCommitmentEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collateral Status:</span>
              <span className="font-semibold text-card-foreground">
                {collateralSummary?.isSufficient ? "Sufficient" : "Needs Top-up"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoOverviewTab;

const formatCycleDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) return `${safeSeconds}s`;
  return parts.join(" ");
};
