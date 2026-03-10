import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetAjoMembers from "@/hooks/useStarknetAjoMembers";
import useStarknetAjoPayments from "@/hooks/useStarknetAjoPayments";
import useStarknetAjoCollateral from "@/hooks/useStarknetAjoCollateral";
import useStarknetAjoGovernance from "@/hooks/useStarknetAjoGovernance";
import useStarknetAjoSchedule from "@/hooks/useStarknetAjoSchedule";
import useStarknetBridgeAdapter from "@/hooks/useStarknetBridgeAdapter";
import useStarknetSwapRouter from "@/hooks/useStarknetSwapRouter";
import useStarknetBTCCollateralAdapter from "@/hooks/useStarknetBTCCollateralAdapter";
import { CONTRACT_ADDRESSES } from "@/config/constants";
import { TOKEN_ADDRESSES } from "@/config/constants";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

const parseDecimalToUnits = (amount: string, decimals: number): bigint => {
  const normalized = amount.trim();
  if (!normalized) return 0n;
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid amount format");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const padded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${whole}${padded}`.replace(/^0+/, "") || "0");
};

const AjoAdvancedModules = ({ ajo }: { ajo: any }) => {
  const { address, isConnected } = useStarknetWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [bridgeRequestId, setBridgeRequestId] = useState("1");
  const [btcCommitmentId, setBtcCommitmentId] = useState("1");
  const [swapRequestId, setSwapRequestId] = useState("1");
  const [amount, setAmount] = useState("1");
  const [btcAddressOrHash, setBtcAddressOrHash] = useState("btc_addr_001");
  const [swapDestToken, setSwapDestToken] = useState(TOKEN_ADDRESSES.sepolia.STRK);
  const [memberAddressInput, setMemberAddressInput] = useState("");
  const [memberPositionInput, setMemberPositionInput] = useState("1");
  const [cycleInput, setCycleInput] = useState("1");
  const [memberStatusInput, setMemberStatusInput] = useState<
    "Active" | "Defaulted" | "Completed" | "Removed"
  >("Active");
  const [relayerInput, setRelayerInput] = useState("");
  const [status, setStatus] = useState<Record<string, string>>({});

  const tokenDecimals = ajo?.config?.paymentToken === "WBTC" ? 8 : 6;
  const coreAddress = ajo?.coreAddress || "";
  const membersAddress = ajo?.membersAddress || "";
  const collateralAddress = ajo?.collateralAddress || "";
  const paymentsAddress = ajo?.paymentsAddress || "";
  const governanceAddress = ajo?.governanceAddress || "";
  const scheduleAddress = ajo?.scheduleAddress || "";
  const bridgeAddress = CONTRACT_ADDRESSES.sepolia.bridgeAdapter;
  const swapRouterAddress = CONTRACT_ADDRESSES.sepolia.swapRouter;
  const btcAdapterAddress = CONTRACT_ADDRESSES.sepolia.btcCollateralAdapter;
  const sourceTokenAddress =
    ajo?.config?.paymentToken === "WBTC"
      ? TOKEN_ADDRESSES.sepolia.STRK
      : TOKEN_ADDRESSES.sepolia.USDC;

  const {
    getAdvancedFeatures,
    setBridgeAdapter,
    setSwapRouter,
    setBtcCollateralAdapter,
    setCollateralMode,
    enableBridge,
    disableBridge,
    enableSwap,
    disableSwap,
    enableBtcCommitment,
    disableBtcCommitment,
    processPayment,
    processCycle,
    handleDefault,
    exitAjo,
    finalizeAjo,
    setPaymentTokenAddress,
    emergencyDisableBridge,
    emergencyDisableSwap,
    emergencyDisableBtcCollateral,
    pause,
    unpause,
    loading: coreLoading,
  } = useStarknetAjoCore(coreAddress);

  const {
    getAuthorizedCore: getMembersAuthorizedCore,
    setAuthorizedCore: setMembersAuthorizedCore,
    addMember,
    removeMember,
    updateMemberStatus,
    markPayoutReceived,
  } = useStarknetAjoMembers(membersAddress);

  const {
    getAuthorizedCore: getPaymentsAuthorizedCore,
    setAuthorizedCore: setPaymentsAuthorizedCore,
    makePaymentFor,
    startCycle,
    endCycle,
    markDefault,
    seizePastPayments,
    setSwapRouter: setPaymentsSwapRouter,
    enableSwap: enablePaymentsSwap,
    disableSwap: disablePaymentsSwap,
    setTokenPreference,
  } = useStarknetAjoPayments(paymentsAddress);

  const {
    getAuthorizedCore: getCollateralAuthorizedCore,
    setAuthorizedCore: setCollateralAuthorizedCore,
    depositCollateralFor,
    withdrawCollateralFor,
    slashCollateral,
    seizeCollateral,
    setPaymentsContract,
    setMembersContract,
  } = useStarknetAjoCollateral(collateralAddress);

  const {
    getAuthorizedCore: getGovernanceAuthorizedCore,
    setAuthorizedCore: setGovernanceAuthorizedCore,
  } = useStarknetAjoGovernance(governanceAddress);

  const {
    getAuthorizedCore: getScheduleAuthorizedCore,
    setAuthorizedCore: setScheduleAuthorizedCore,
  } = useStarknetAjoSchedule(scheduleAddress);

  const {
    getAuthorizedCore: getBridgeAuthorizedCore,
    setAuthorizedCore: setBridgeAuthorizedCore,
    getBridgeRelayer,
    getRequestStatus,
    registerDeposit,
    finalizeDeposit,
    requestWithdrawal,
    finalizeWithdrawal,
    cancelWithdrawal,
    setBridgeRelayer,
    emergencyPause: pauseBridge,
    unpause: unpauseBridge,
    loading: bridgeLoading,
  } = useStarknetBridgeAdapter(bridgeAddress);

  const {
    getAuthorizedExecutor,
    setAuthorizedExecutor,
    getQuote,
    getSwapStatus,
    executeSwap,
    cancelSwap,
    loading: swapLoading,
  } = useStarknetSwapRouter(swapRouterAddress);

  const {
    getAuthorizedCore: getBtcAuthorizedCore,
    setAuthorizedCore: setBtcAuthorizedCore,
    getMemberCommitment,
    getCommitmentStatus,
    registerCommitment,
    verifyCommitment,
    startEnforcement,
    confirmEnforcement,
    releaseCommitment,
    loading: btcLoading,
  } = useStarknetBTCCollateralAdapter(btcAdapterAddress);

  const isBusy = coreLoading || bridgeLoading || swapLoading || btcLoading;

  const canRun = useMemo(
    () => Boolean(isConnected && address && coreAddress),
    [isConnected, address, coreAddress],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [
        features,
        membersCore,
        paymentsCore,
        collateralCore,
        governanceCore,
        scheduleCore,
        bridgeCore,
        bridgeRelayer,
        swapExecutor,
        btcCore,
        bridgeReqStatus,
        swapReqStatus,
        commitmentStatus,
      ] =
        await Promise.all([
          getAdvancedFeatures(),
          getMembersAuthorizedCore().catch(() => "N/A"),
          getPaymentsAuthorizedCore().catch(() => "N/A"),
          getCollateralAuthorizedCore().catch(() => "N/A"),
          getGovernanceAuthorizedCore().catch(() => "N/A"),
          getScheduleAuthorizedCore().catch(() => "N/A"),
          getBridgeAuthorizedCore().catch(() => "N/A"),
          getBridgeRelayer().catch(() => "N/A"),
          getAuthorizedExecutor().catch(() => "N/A"),
          getBtcAuthorizedCore().catch(() => "N/A"),
          getRequestStatus(Number(bridgeRequestId)).catch(() => "N/A"),
          getSwapStatus(Number(swapRequestId)).catch(() => "N/A"),
          getCommitmentStatus(Number(btcCommitmentId)).catch(() => "N/A"),
        ]);

      const memberCommitment = address
        ? await getMemberCommitment(address).catch(() => 0)
        : 0;

      setStatus({
        bridge: features.bridgeEnabled ? "Enabled" : "Disabled",
        swap: features.swapEnabled ? "Enabled" : "Disabled",
        btc: features.btcCommitmentEnabled ? "Enabled" : "Disabled",
        collateralMode: features.collateralMode || "L2Escrow",
        bridgeRequest: String(bridgeReqStatus),
        swapRequest: String(swapReqStatus),
        commitment: String(commitmentStatus),
        myCommitment: String(memberCommitment),
        membersCore: String(membersCore),
        paymentsCore: String(paymentsCore),
        collateralCore: String(collateralCore),
        governanceCore: String(governanceCore),
        scheduleCore: String(scheduleCore),
        bridgeCore: String(bridgeCore),
        bridgeRelayer: String(bridgeRelayer),
        swapExecutor: String(swapExecutor),
        btcCore: String(btcCore),
      });
    } catch (error: any) {
      console.error("Failed to refresh advanced data:", error);
      toast.error(error?.message || "Failed to refresh module data");
    } finally {
      setRefreshing(false);
    }
  }, [
    getAdvancedFeatures,
    getMembersAuthorizedCore,
    getPaymentsAuthorizedCore,
    getCollateralAuthorizedCore,
    getGovernanceAuthorizedCore,
    getScheduleAuthorizedCore,
    getBridgeAuthorizedCore,
    getBridgeRelayer,
    getAuthorizedExecutor,
    getBtcAuthorizedCore,
    getRequestStatus,
    bridgeRequestId,
    getSwapStatus,
    swapRequestId,
    getCommitmentStatus,
    btcCommitmentId,
    address,
    getMemberCommitment,
  ]);

  const runAction = async (action: () => Promise<any>, success: string) => {
    if (!canRun) {
      toast.error("Connect wallet and open a fully deployed Ajo first");
      return;
    }

    try {
      await action();
      toast.success(success);
      await onRefresh();
    } catch (error: any) {
      console.error("Advanced action failed:", error);
      toast.error(error?.message || "Action failed");
    }
  };

  const amountUnits = () => parseDecimalToUnits(amount, tokenDecimals);
  const selectedMember = memberAddressInput.trim() || address || "";
  const parsedCycle = Number(cycleInput || "1");
  const parsedPosition = Number(memberPositionInput || "1");
  const expectedCore = coreAddress.toLowerCase();
  const isExpectedCore = (value?: string) =>
    Boolean(value && value !== "N/A" && value.toLowerCase() === expectedCore);

  useEffect(() => {
    if (!canRun) return;
    onRefresh();
  }, [canRun, onRefresh]);

  if (!coreAddress || /^0x0+$/i.test(coreAddress)) {
    return (
      <div className="bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Core contract not initialized yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-card-foreground">
            Advanced Modules
          </h3>
          <button
            onClick={onRefresh}
            disabled={refreshing || isBusy}
            className="px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mb-6">
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Bridge</p>
            <p className="text-sm font-semibold mt-1">{status.bridge ?? "N/A"}</p>
          </div>
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Swap</p>
            <p className="text-sm font-semibold mt-1">{status.swap ?? "N/A"}</p>
          </div>
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">BTC Commitments</p>
            <p className="text-sm font-semibold mt-1">{status.btc ?? "N/A"}</p>
          </div>
          <div className="bg-background/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Collateral Mode</p>
            <p className="text-sm font-semibold mt-1">
              {status.collateralMode ?? "N/A"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">
              Module Authorization
            </h4>
            <p className="text-xs text-muted-foreground">
              Target core: <span className="font-mono">{coreAddress}</span>
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              <p className="text-xs">
                Members:{" "}
                <span
                  className={
                    isExpectedCore(status.membersCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.membersCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Payments:{" "}
                <span
                  className={
                    isExpectedCore(status.paymentsCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.paymentsCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Collateral:{" "}
                <span
                  className={
                    isExpectedCore(status.collateralCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.collateralCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Governance:{" "}
                <span
                  className={
                    isExpectedCore(status.governanceCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.governanceCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Schedule:{" "}
                <span
                  className={
                    isExpectedCore(status.scheduleCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.scheduleCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Bridge:{" "}
                <span
                  className={
                    isExpectedCore(status.bridgeCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.bridgeCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                BTC Adapter:{" "}
                <span
                  className={
                    isExpectedCore(status.btcCore)
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  {status.btcCore ?? "N/A"}
                </span>
              </p>
              <p className="text-xs">
                Swap Executor:{" "}
                <span className="font-mono">{status.swapExecutor ?? "N/A"}</span>
              </p>
              <p className="text-xs">
                Bridge Relayer:{" "}
                <span className="font-mono">{status.bridgeRelayer ?? "N/A"}</span>
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                onClick={() =>
                  runAction(
                    () => setAuthorizedExecutor(coreAddress),
                    "Swap executor updated",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Swap Executor
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Core Controls</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <button
                onClick={() => runAction(() => setBridgeAdapter(bridgeAddress), "Bridge adapter set")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Bridge Adapter
              </button>
              <button
                onClick={() => runAction(() => setSwapRouter(swapRouterAddress), "Swap router set")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Swap Router
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setBtcCollateralAdapter(btcAdapterAddress),
                    "BTC collateral adapter set",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set BTC Adapter
              </button>
              <button
                onClick={() => runAction(enableBridge, "Bridge enabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Enable Bridge
              </button>
              <button
                onClick={() => runAction(disableBridge, "Bridge disabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Disable Bridge
              </button>
              <button
                onClick={() => runAction(enableSwap, "Swap enabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Enable Swap
              </button>
              <button
                onClick={() => runAction(disableSwap, "Swap disabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Disable Swap
              </button>
              <button
                onClick={() => runAction(enableBtcCommitment, "BTC commitments enabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Enable BTC Commitments
              </button>
              <button
                onClick={() =>
                  runAction(disableBtcCommitment, "BTC commitments disabled")
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Disable BTC Commitments
              </button>
              <button
                onClick={() => runAction(() => setCollateralMode("L2Escrow"), "Collateral mode set to L2Escrow")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Collateral: L2Escrow
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setCollateralMode("BTCCommitment"),
                    "Collateral mode set to BTCCommitment",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Collateral: BTCCommitment
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">
              Core Lifecycle & Safety
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={cycleInput}
                onChange={(e) => setCycleInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Cycle number"
              />
              <input
                value={memberAddressInput}
                onChange={(e) => setMemberAddressInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Member address"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Amount"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                disabled
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Start Ajo (Auto)
              </button>
              <button
                onClick={() => runAction(processPayment, "Core payment processed")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Process Payment
              </button>
              <button
                onClick={() => runAction(() => processCycle(parsedCycle), "Cycle processed")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Process Cycle
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => handleDefault(selectedMember),
                    "Default handler executed",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Handle Default
              </button>
              <button
                onClick={() => runAction(exitAjo, "Exited Ajo")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Exit Ajo
              </button>
              <button
                onClick={() => runAction(finalizeAjo, "Ajo finalized")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Finalize Ajo
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setPaymentTokenAddress(sourceTokenAddress, tokenDecimals),
                    "Payment token address set",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Payment Token
              </button>
              <button
                onClick={() => runAction(pause, "Core paused")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Pause Core
              </button>
              <button
                onClick={() => runAction(unpause, "Core unpaused")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Unpause Core
              </button>
              <button
                onClick={() =>
                  runAction(emergencyDisableBridge, "Bridge emergency disabled")
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Emergency Disable Bridge
              </button>
              <button
                onClick={() =>
                  runAction(emergencyDisableSwap, "Swap emergency disabled")
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Emergency Disable Swap
              </button>
              <button
                onClick={() =>
                  runAction(
                    emergencyDisableBtcCollateral,
                    "BTC collateral emergency disabled",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Emergency Disable BTC
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Members Admin</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={memberAddressInput}
                onChange={(e) => setMemberAddressInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Member address"
              />
              <input
                value={memberPositionInput}
                onChange={(e) => setMemberPositionInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Position"
              />
              <select
                value={memberStatusInput}
                onChange={(e) =>
                  setMemberStatusInput(
                    e.target.value as
                      | "Active"
                      | "Defaulted"
                      | "Completed"
                      | "Removed",
                  )
                }
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Defaulted">Defaulted</option>
                <option value="Completed">Completed</option>
                <option value="Removed">Removed</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                onClick={() =>
                  runAction(
                    () => addMember(selectedMember, parsedPosition),
                    "Member added",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Add Member
              </button>
              <button
                onClick={() =>
                  runAction(() => removeMember(selectedMember), "Member removed")
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Remove Member
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => updateMemberStatus(selectedMember, memberStatusInput),
                    "Member status updated",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Update Status
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => markPayoutReceived(selectedMember),
                    "Payout marked received",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Mark Payout Received
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Payments Admin</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={cycleInput}
                onChange={(e) => setCycleInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Cycle number"
              />
              <input
                value={memberAddressInput}
                onChange={(e) => setMemberAddressInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Member address"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Amount"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                onClick={() =>
                  runAction(
                    () => makePaymentFor(selectedMember, parsedCycle, amountUnits().toString()),
                    "Payment made for member",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Make Payment For
              </button>
              <button
                onClick={() => runAction(() => startCycle(parsedCycle), "Cycle started")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Start Cycle
              </button>
              <button
                onClick={() => runAction(() => endCycle(parsedCycle), "Cycle ended")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                End Cycle
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => markDefault(selectedMember, parsedCycle),
                    "Member default marked",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Mark Default
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => seizePastPayments(selectedMember),
                    "Past payments seized",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Seize Past Payments
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setPaymentsSwapRouter(swapRouterAddress),
                    "Payments swap router set",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Payments Router
              </button>
              <button
                onClick={() => runAction(enablePaymentsSwap, "Payments swap enabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Enable Payments Swap
              </button>
              <button
                onClick={() => runAction(disablePaymentsSwap, "Payments swap disabled")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Disable Payments Swap
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setTokenPreference(swapDestToken),
                    "Token preference updated",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Token Preference
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Collateral Admin</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={memberAddressInput}
                onChange={(e) => setMemberAddressInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Member address"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Amount"
              />
              <input
                value={cycleInput}
                onChange={(e) => setCycleInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Cycle number"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                onClick={() =>
                  runAction(
                    () => depositCollateralFor(selectedMember, amountUnits().toString()),
                    "Collateral deposited for member",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Deposit For Member
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => withdrawCollateralFor(selectedMember, amountUnits().toString()),
                    "Collateral withdrawn for member",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Withdraw For Member
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => slashCollateral(selectedMember, amountUnits().toString()),
                    "Collateral slashed",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Slash Collateral
              </button>
              <button
                onClick={() =>
                  runAction(() => seizeCollateral(selectedMember), "Collateral seized")
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Seize Collateral
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setPaymentsContract(paymentsAddress),
                    "Collateral payments contract set",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Payments Contract
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setMembersContract(membersAddress),
                    "Collateral members contract set",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Members Contract
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Bridge Adapter</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder={`Amount (${ajo?.config?.paymentToken || "USDC"})`}
              />
              <input
                value={relayerInput}
                onChange={(e) => setRelayerInput(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Bridge relayer address"
              />
              <input
                value={btcAddressOrHash}
                onChange={(e) => setBtcAddressOrHash(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="BTC address or tx hash"
              />
              <input
                value={bridgeRequestId}
                onChange={(e) => setBridgeRequestId(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Request ID"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  runAction(
                    () =>
                      registerDeposit({
                        ajoId: Number(ajo?.id || 0),
                        member: selectedMember,
                        amount: amountUnits(),
                        btcTxHash: btcAddressOrHash,
                      }),
                    "Bridge deposit registered",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Register Deposit
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => finalizeDeposit(Number(bridgeRequestId)),
                    "Bridge deposit finalized",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Finalize Deposit
              </button>
              <button
                onClick={() =>
                  runAction(
                    () =>
                      requestWithdrawal({
                        ajoId: Number(ajo?.id || 0),
                        amount: amountUnits(),
                        btcAddress: btcAddressOrHash,
                      }),
                    "Bridge withdrawal requested",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Request Withdrawal
              </button>
              <button
                onClick={() =>
                  runAction(
                    () =>
                      finalizeWithdrawal(
                        Number(bridgeRequestId),
                        btcAddressOrHash || "btc_tx_hash",
                      ),
                    "Bridge withdrawal finalized",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Finalize Withdrawal
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => cancelWithdrawal(Number(bridgeRequestId)),
                    "Bridge withdrawal cancelled",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Cancel Withdrawal
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => setBridgeRelayer(relayerInput || address || "0x0"),
                    "Bridge relayer updated",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Set Relayer
              </button>
              <button
                onClick={() => runAction(pauseBridge, "Bridge paused")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Pause Bridge
              </button>
              <button
                onClick={() => runAction(unpauseBridge, "Bridge unpaused")}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Unpause Bridge
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Request #{bridgeRequestId}: {status.bridgeRequest ?? "N/A"} •
              Relayer: {status.bridgeRelayer ?? "N/A"}
            </p>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">Swap Router</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={swapDestToken}
                onChange={(e) => setSwapDestToken(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Destination token address"
              />
              <input
                value={swapRequestId}
                onChange={(e) => setSwapRequestId(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Swap request ID"
              />
              <button
                onClick={async () => {
                  try {
                    const quote = await getQuote(
                      sourceTokenAddress,
                      swapDestToken,
                      amountUnits(),
                    );
                    toast.success(`Quote: ${quote.toString()}`);
                  } catch (error: any) {
                    toast.error(error?.message || "Failed to fetch quote");
                  }
                }}
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Get Quote
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  runAction(
                    () =>
                      executeSwap({
                        ajoId: Number(ajo?.id || 0),
                        recipient: address || "0x0",
                        sourceToken: sourceTokenAddress,
                        destToken: swapDestToken,
                        sourceAmount: amountUnits(),
                        minDestAmount: amountUnits(),
                        deadline: Math.floor(Date.now() / 1000) + 3600,
                      }),
                    "Swap execution requested",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Execute Swap
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => cancelSwap(Number(swapRequestId)),
                    "Swap request cancelled",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Cancel Swap
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Request #{swapRequestId}: {status.swapRequest ?? "N/A"}
            </p>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background/20 space-y-3">
            <h4 className="font-semibold text-card-foreground">
              BTC Collateral Adapter
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={btcCommitmentId}
                onChange={(e) => setBtcCommitmentId(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="Commitment ID"
              />
              <input
                value={btcAddressOrHash}
                onChange={(e) => setBtcAddressOrHash(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                placeholder="BTC script hash / tx hash"
              />
              <button
                onClick={() =>
                  runAction(
                    () =>
                      registerCommitment({
                        ajoId: Number(ajo?.id || 0),
                        member: address || "0x0",
                        amount: amountUnits(),
                        btcScriptHash: btcAddressOrHash,
                      }),
                    "BTC commitment registered",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Register Commitment
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  runAction(
                    () => verifyCommitment(Number(btcCommitmentId), []),
                    "Commitment verified",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Verify
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => startEnforcement(Number(btcCommitmentId), []),
                    "Enforcement started",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Start Enforcement
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => confirmEnforcement(Number(btcCommitmentId), btcAddressOrHash),
                    "Enforcement confirmed",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Confirm Enforcement
              </button>
              <button
                onClick={() =>
                  runAction(
                    () => releaseCommitment(Number(btcCommitmentId)),
                    "Commitment released",
                  )
                }
                className="px-3 py-2 rounded-md border border-border text-sm hover:bg-primary/10"
              >
                Release
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Commitment #{btcCommitmentId}: {status.commitment ?? "N/A"} • Your
              commitment ID: {status.myCommitment ?? "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoAdvancedModules;
