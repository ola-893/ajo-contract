/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { Contract, cairo, RpcProvider, CairoCustomEnum } from "starknet";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import { ajoFactoryAbi } from "@/abi/placeholders";
import { CONTRACT_ADDRESSES } from "@/config/constants";

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4";

const PHASE_METHODS = [
  "deploy_members",
  "deploy_collateral_and_payments",
  "deploy_governance_and_schedule",
  "deploy_core",
] as const;

const parseTokenAmountToUnits = (amount: string, decimals: number): bigint => {
  const normalized = amount.trim();
  if (!normalized) throw new Error("Contribution amount is required");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid contribution amount format");
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  const safeFraction = fraction.slice(0, decimals).padEnd(decimals, "0");
  const combined = `${whole}${safeFraction}`.replace(/^0+/, "") || "0";
  return BigInt(combined);
};

const buildPaymentTokenEnum = (token: "USDC" | "BTC") =>
  token === "BTC"
    ? new CairoCustomEnum({ BTC: {} })
    : new CairoCustomEnum({ USDC: {} });

const useStarknetAjoFactory = () => {
  const { account, isConnected, address } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const runPhaseDeployments = useCallback(
    async (factoryContract: Contract, provider: RpcProvider, ajoIdU256: any) => {
      const deploymentTxs: Array<{ method: string; txHash: string }> = [];

      for (const method of PHASE_METHODS) {
        console.log(`Running ${method}...`);
        const tx = await (factoryContract as any)[method](ajoIdU256);
        await provider.waitForTransaction(tx.transaction_hash);
        deploymentTxs.push({ method, txHash: tx.transaction_hash });
      }

      return deploymentTxs;
    },
    [],
  );

  const createAjo = useCallback(
    async (params: {
      name: string;
      monthlyContribution: string;
      totalParticipants: number;
      cycleDuration: number;
      paymentToken: "USDC" | "BTC";
    }) => {
      if (!account || !isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        if (!factoryAddress) {
          throw new Error("Factory contract address not configured");
        }

        const provider = getProvider();
        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          account,
        );

        const shortName = params.name.trim();
        if (!shortName || shortName.length > 31) {
          throw new Error("Ajo name must be 1-31 characters");
        }

        if (params.totalParticipants < 3) {
          throw new Error("Total participants must be at least 3");
        }

        const cycleDurationSeconds = params.cycleDuration * 24 * 60 * 60;
        if (cycleDurationSeconds < 86400 || cycleDurationSeconds > 5356800) {
          throw new Error("Cycle duration must be between 1 and 62 days");
        }

        const decimals = params.paymentToken === "BTC" ? 8 : 6;
        const contributionUnits = parseTokenAmountToUnits(
          params.monthlyContribution,
          decimals,
        );

        const contributionAmount = cairo.uint256(contributionUnits.toString());
        const totalParticipants = cairo.uint256(params.totalParticipants);
        const paymentToken = buildPaymentTokenEnum(params.paymentToken);

        const totalBefore = Number(await factoryContract.get_total_ajos());

        const tx = await factoryContract.create_ajo(
          shortName,
          contributionAmount,
          totalParticipants,
          cycleDurationSeconds,
          paymentToken,
        );

        await provider.waitForTransaction(tx.transaction_hash);

        const totalAfter = Number(await factoryContract.get_total_ajos());
        const ajoId = totalAfter > totalBefore ? totalAfter : totalBefore + 1;
        const ajoIdU256 = cairo.uint256(ajoId);

        const deploymentTxs = await runPhaseDeployments(
          factoryContract,
          provider,
          ajoIdU256,
        );

        return {
          transactionHash: tx.transaction_hash,
          ajoId,
          deploymentTxs,
          success: true,
        };
      } catch (error: any) {
        console.error("Error creating Ajo:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, address, runPhaseDeployments],
  );

  const getAjoInfo = useCallback(async (ajoId: string) => {
    try {
      const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
      if (!factoryAddress) throw new Error("Factory contract not deployed yet");

      const provider = getProvider();
      const factoryContract = new Contract(
        ajoFactoryAbi as any,
        factoryAddress,
        provider,
      );

      const ajoIdU256 = cairo.uint256(ajoId);
      return await factoryContract.get_ajo_info(ajoIdU256);
    } catch (error) {
      console.error("Error fetching Ajo info:", error);
      throw error;
    }
  }, []);

  const getUserAjos = useCallback(async (userAddress: string) => {
    try {
      const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
      if (!factoryAddress) throw new Error("Factory contract not deployed yet");

      const provider = getProvider();
      const factoryContract = new Contract(
        ajoFactoryAbi as any,
        factoryAddress,
        provider,
      );

      return await factoryContract.get_user_ajos(userAddress);
    } catch (error) {
      console.error("Error fetching user Ajos:", error);
      throw error;
    }
  }, []);

  const deployAjoContracts = useCallback(
    async (ajoId: string) => {
      if (!account || !isConnected) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
        if (!factoryAddress) throw new Error("Factory contract not deployed yet");

        const provider = getProvider();
        const factoryContract = new Contract(
          ajoFactoryAbi as any,
          factoryAddress,
          account,
        );

        const ajoIdU256 = cairo.uint256(ajoId);
        const deploymentTxs = await runPhaseDeployments(
          factoryContract,
          provider,
          ajoIdU256,
        );

        return {
          success: true,
          deploymentTxs,
        };
      } catch (error) {
        console.error("Error deploying Ajo contracts:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, runPhaseDeployments],
  );

  return {
    createAjo,
    getAjoInfo,
    getUserAjos,
    deployAjoContracts,
    loading,
  };
};

export default useStarknetAjoFactory;
