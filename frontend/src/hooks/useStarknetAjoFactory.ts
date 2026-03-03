/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import {
  Contract,
  cairo,
  RpcProvider,
  CairoCustomEnum,
  shortString,
} from "starknet";
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

export type AjoPaymentToken = "USDC" | "BTC";

export interface StarknetAjoConfig {
  name: string;
  monthlyContribution: bigint;
  totalParticipants: number;
  cycleDuration: number;
  paymentToken: AjoPaymentToken;
  creator: string;
}

export interface StarknetAjoInfo {
  id: number;
  config: StarknetAjoConfig;
  coreAddress: string;
  membersAddress: string;
  collateralAddress: string;
  paymentsAddress: string;
  governanceAddress: string;
  scheduleAddress: string;
  isInitialized: boolean;
  createdAt: number;
}

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

const toNumberValue = (value: any): number => Number(toBigIntValue(value));

const toHexAddress = (value: any): string => {
  if (typeof value === "string") {
    if (value.startsWith("0x")) return value.toLowerCase();
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }

  return `0x${toBigIntValue(value).toString(16)}`;
};

const decodeFeltToString = (value: any): string => {
  if (typeof value === "string" && !value.startsWith("0x")) return value;

  const hex =
    typeof value === "string" && value.startsWith("0x")
      ? value
      : `0x${toBigIntValue(value).toString(16)}`;

  try {
    return shortString.decodeShortString(hex);
  } catch {
    return hex;
  }
};

const parsePaymentToken = (value: any): AjoPaymentToken => {
  if (typeof value === "string") {
    return value.toUpperCase() === "BTC" ? "BTC" : "USDC";
  }
  if (typeof value === "number") {
    return value === 1 ? "BTC" : "USDC";
  }
  if (typeof value === "object" && value !== null) {
    if ("BTC" in value) return "BTC";
    if ("USDC" in value) return "USDC";
    const keys = Object.keys(value);
    if (keys.includes("BTC")) return "BTC";
    if (keys.includes("USDC")) return "USDC";
  }
  return "USDC";
};

const parseBool = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value === "true";
  if (typeof value === "object" && value !== null) {
    if ("True" in value || "true" in value) return true;
    if ("False" in value || "false" in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const extractSpanValues = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.snapshot)) return value.snapshot;
  if (Array.isArray(value?.[0])) return value[0];
  return [];
};

const normalizeAjoInfo = (raw: any, fallbackId = 0): StarknetAjoInfo => {
  const configRaw = raw?.config ?? {};

  const idRaw = raw?.id ?? fallbackId;
  const coreRaw = raw?.core_address ?? raw?.coreAddress ?? 0;
  const membersRaw = raw?.members_address ?? raw?.membersAddress ?? 0;
  const collateralRaw = raw?.collateral_address ?? raw?.collateralAddress ?? 0;
  const paymentsRaw = raw?.payments_address ?? raw?.paymentsAddress ?? 0;
  const governanceRaw = raw?.governance_address ?? raw?.governanceAddress ?? 0;
  const scheduleRaw = raw?.schedule_address ?? raw?.scheduleAddress ?? 0;
  const initializedRaw =
    raw?.is_initialized ?? raw?.isInitialized ?? raw?.is_active ?? false;
  const createdAtRaw = raw?.created_at ?? raw?.createdAt ?? 0;

  const nameRaw = configRaw?.name ?? raw?.name ?? "";
  const monthlyRaw =
    configRaw?.monthly_contribution ?? configRaw?.monthlyContribution ?? raw?.monthly_contribution ?? 0;
  const participantsRaw =
    configRaw?.total_participants ?? configRaw?.totalParticipants ?? raw?.total_participants ?? 0;
  const cycleRaw =
    configRaw?.cycle_duration ?? configRaw?.cycleDuration ?? raw?.cycle_duration ?? 0;
  const tokenRaw =
    configRaw?.payment_token ?? configRaw?.paymentToken ?? raw?.payment_token ?? {};
  const creatorRaw = configRaw?.creator ?? raw?.creator ?? 0;

  return {
    id: toNumberValue(idRaw),
    config: {
      name: decodeFeltToString(nameRaw),
      monthlyContribution: toBigIntValue(monthlyRaw),
      totalParticipants: toNumberValue(participantsRaw),
      cycleDuration: toNumberValue(cycleRaw),
      paymentToken: parsePaymentToken(tokenRaw),
      creator: toHexAddress(creatorRaw),
    },
    coreAddress: toHexAddress(coreRaw),
    membersAddress: toHexAddress(membersRaw),
    collateralAddress: toHexAddress(collateralRaw),
    paymentsAddress: toHexAddress(paymentsRaw),
    governanceAddress: toHexAddress(governanceRaw),
    scheduleAddress: toHexAddress(scheduleRaw),
    isInitialized: parseBool(initializedRaw),
    createdAt: toNumberValue(createdAtRaw),
  };
};

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

        if (!Number.isInteger(params.totalParticipants)) {
          throw new Error("Total participants must be a whole number");
        }

        if (params.totalParticipants < 3 || params.totalParticipants > 100) {
          throw new Error("Total participants must be between 3 and 100");
        }

        if (!Number.isInteger(params.cycleDuration)) {
          throw new Error("Cycle duration must be a whole number of days");
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

        const totalBefore = toNumberValue(await factoryContract.get_total_ajos());

        const tx = await factoryContract.create_ajo(
          shortName,
          contributionAmount,
          totalParticipants,
          cycleDurationSeconds,
          paymentToken,
        );

        await provider.waitForTransaction(tx.transaction_hash);

        const totalAfter = toNumberValue(await factoryContract.get_total_ajos());
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
      const response = await factoryContract.get_ajo_info(ajoIdU256);
      return normalizeAjoInfo(response, Number(ajoId));
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

      const response = await factoryContract.get_user_ajos(userAddress);
      const ids = extractSpanValues(response)
        .map((item) => toNumberValue(item))
        .filter((id) => Number.isFinite(id) && id > 0);

      return [...new Set(ids)];
    } catch (error) {
      console.error("Error fetching user Ajos:", error);
      throw error;
    }
  }, []);

  const getTotalAjos = useCallback(async () => {
    try {
      const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
      if (!factoryAddress) throw new Error("Factory contract not deployed yet");

      const provider = getProvider();
      const factoryContract = new Contract(
        ajoFactoryAbi as any,
        factoryAddress,
        provider,
      );

      const total = await factoryContract.get_total_ajos();
      return toNumberValue(total);
    } catch (error) {
      console.error("Error fetching total Ajos:", error);
      throw error;
    }
  }, []);

  const getAllAjos = useCallback(async () => {
    const total = await getTotalAjos();
    if (!Number.isFinite(total) || total <= 0) return [];

    const ids = Array.from({ length: total }, (_, idx) => idx + 1);
    const details = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getAjoInfo(String(id));
        } catch (error) {
          console.error(`Failed to load Ajo ${id}:`, error);
          return null;
        }
      }),
    );

    return details.filter((item): item is StarknetAjoInfo => Boolean(item));
  }, [getAjoInfo, getTotalAjos]);

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
    getTotalAjos,
    getAllAjos,
    deployAjoContracts,
    loading,
  };
};

export default useStarknetAjoFactory;
