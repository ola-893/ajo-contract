import { useAjoCore } from "@/hooks/useAjoCore";
// import useAjoMembers from "@/hooks/useAjoMembers";
import useAjoPayment from "@/hooks/useAjoPayment";
import { useAjoDetailsStore } from "@/store/ajoDetailsStore";
import { useMembersStore } from "@/store/ajoMembersStore";
import { type AjoInfo } from "@/store/ajoStore";
import { useMemberStore } from "@/store/memberInfoStore";
import { useTokenStore } from "@/store/tokenStore";
import formatCurrency, { formatCurrencyUSD } from "@/utils/formatCurrency";
import {
  CheckCircle,
  Coins,
  Database,
  RefreshCw,
  Shield,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const AjoOverviewTab = ({ ajo }: { ajo: AjoInfo | null | undefined }) => {
  const { ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  const { getCollateralDemo } = useAjoCore(ajoCore ? ajoCore : "");
  const [cycleCount, setCycleCount] = useState(0);
  const { nairaRate } = useTokenStore();
  const { memberData } = useMemberStore();
  const { membersDetails } = useMembersStore();
  const { getCurrentCycle } = useAjoPayment(ajo ? ajo?.ajoPayments : "");
  //   const { getAllMembersDetails } = useAjoMembers(ajo ? ajo?.ajoMembers : "");
  const {
    totalMembers,
    activeToken,
    totalCollateralUSDC,
    contractBalanceUSDC,
    contractBalanceHBAR,
    ajoId,
  } = useAjoDetailsStore();
  const [demoData, setDemoData] = useState<{
    positions: string[];
    collaterals: string[];
  } | null>(null);

  const getFunctions = useCallback(async () => {
    try {
      const demo = await getCollateralDemo(10, "50");
      // console.log("demo", demo);
      setDemoData(demo);
      //   const count = await getCurrentCycle();
      //   if (!count) return null;
      //   setCycleCount(count);
      //   await getAllMembersDetails();
    } catch (err) {
      console.log("Error", err);
    }
  }, []);

  // get current cycle count
  const _getCurrentCycle = useCallback(async () => {
    try {
      const count = await getCurrentCycle();
      if (!count) return null;
      setCycleCount(count);
    } catch (err) {
      console.log("Error", err);
    }
  }, []);

  useEffect(() => {
    getFunctions();
    _getCurrentCycle();
  }, [_getCurrentCycle, getFunctions]);

  useEffect(() => {}, []);

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Collateral Simulation  */}

        {/* Cycle Progress */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Target className="w-6 h-6 text-primary" />
            <span>Current Cycle Progress</span>
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className=" text-sm text-muted-foreground">
                Cycle {cycleCount} of {10}
              </span>
              <span className="text-sm font-semibold text-card-foreground">
                Next payout: Queue {cycleCount}
              </span>
            </div>

            <div className="w-full bg-background/50 rounded-full h-3 border border-border">
              <div
                className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-1000"
                style={{
                  width: `${
                    ((cycleCount === 0 ? 0 : cycleCount - 1) / 10) * 100
                  }%`,
                }}
              ></div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {cycleCount === 0 ? 0 : cycleCount - 1}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">
                  {totalMembers}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Members
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {10 - Number(totalMembers)}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Contract Status */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <Database className="w-6 h-6 text-accent" />
            <span>Ajo Contract Status</span>
            {!ajoId && (
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </h3>

          {ajoId ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Guarantor queue position:
                  </span>
                  <span className="font-semibold text-card-foreground">
                    {memberData?.memberInfo.guaranteePosition}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    your queue Position:
                  </span>
                  <span className="font-semibold text-card-foreground">
                    {memberData?.memberInfo.queueNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Members:</span>
                  <span className="font-semibold text-primary">
                    {totalMembers}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Token:</span>
                  <span className="font-semibold flex items-center space-x-1 text-card-foreground">
                    <Coins className="w-4 h-4" />
                    <span>{activeToken === "0" ? "USDC" : "WHBAR"}</span>
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total Collateral:
                  </span>
                  <span className="font-semibold text-white">
                    {formatCurrencyUSD(
                      Number(Number(totalCollateralUSDC) / 1000000)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Contract Balance:
                  </span>
                  <span className="font-semibold text-primary">
                    {Number(totalCollateralUSDC) / 1000000} USDC
                  </span>
                </div>
                {/* <div className="flex justify-between">
                  <span className="text-muted-foreground">HBAR Balance:</span>
                  <span className="font-semibold text-card-foreground">
                    {contractBalanceHBAR} HBAR
                  </span>
                </div> */}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Loading contract data...</p>
            </div>
          )}
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
                Get USDC from Circle faucet (10 tokens)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="font-semibold text-card-foreground">
                Approve contract to lock your collateral
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
                Receive payout when it's your turn!
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="font-semibold text-green-400">
                Early positions lock more collateral but get paid first!
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary-foreground/20">
            <div className="text-xs opacity-90">
              <div>Network: Hedera Hashgraph</div>
              <div>Gas Optimization: ✓</div>
              <div>Audit Status: Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Key Information */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-lg font-bold text-card-foreground mb-4">
            Key Information
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Token:</span>
              <span className="font-semibold text-card-foreground flex items-center space-x-1">
                <Coins className="w-4 h-4" />
                <span>USDC</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cycle Length:</span>
              <span className="font-semibold text-card-foreground">
                30 days
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Privacy:</span>
              <span className="font-semibold text-card-foreground">Public</span>
            </div>
            {/* <div className="flex justify-between">
              <span className="text-muted-foreground">Collateral:</span>
              <span className="font-semibold text-white">
                {formatCurrency(
                  Number(Number(totalCollateralUSDC) / 1000000) * nairaRate
                )}
              </span>
            </div> */}
          </div>
        </div>
        {demoData && (
          <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
            <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
              <Shield className="w-6 h-6 text-primary" />
              <span>Collateral Simulation</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg">
                <thead>
                  <tr className="bg-primary/20 text-left">
                    <th className="p-2">Queue Position</th>
                    <th className="p-2">Collateral to be paid</th>
                  </tr>
                </thead>
                <tbody>
                  {demoData.positions.map((pos, idx) => (
                    <tr
                      key={idx}
                      className="border-t hover:bg-primary/10 transition"
                    >
                      <td className="p-2 font-medium text-card-foreground">
                        {pos}
                      </td>
                      <td className="p-2 text-white">
                        {formatCurrencyUSD(Number(demoData.collaterals[idx]))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AjoOverviewTab;
