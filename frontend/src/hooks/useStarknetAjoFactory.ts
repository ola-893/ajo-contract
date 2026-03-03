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

const normalizeAddressForCompare = (value: string): string => {
  try {
    return `0x${BigInt(value).toString(16)}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
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

  if (typeof value === "object" && value !== null) {
    if ("value" in value) {
      return toHexAddress((value as any).value);
    }

    if ("address" in value) {
      return toHexAddress((value as any).address);
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

const extractTupleValues = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const numericKeys = Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .map((key) => Number(key))
    .sort((a, b) => a - b);

  if (numericKeys.length === 0) return [];
  return numericKeys.map((index) => value[index]);
};

const tupleU256 = (tuple: any[], lowIndex: number, highIndex: number) => ({
  low: tuple[lowIndex] ?? 0,
  high: tuple[highIndex] ?? 0,
});

const normalizeAjoInfo = (raw: any, fallbackId = 0): StarknetAjoInfo => {
  const tuple = extractTupleValues(raw);
  const hasFlattenedTupleLayout = tuple.length >= 17;
  const hasStructuredTupleLayout =
    !hasFlattenedTupleLayout && tuple.length >= 10;
  const hasNamedStructLayout =
    raw &&
    typeof raw === "object" &&
    ("config" in raw ||
      "core_address" in raw ||
      "members_address" in raw ||
      "collateral_address" in raw ||
      "payments_address" in raw ||
      "governance_address" in raw ||
      "schedule_address" in raw);

  const configRaw = raw?.config ?? {};
  const configTuple = extractTupleValues(configRaw);

  const fromFlattened = () => {
    const createdAtIndex = tuple.length - 1;
    const initializedIndex = tuple.length - 2;
    const scheduleIndex = tuple.length - 3;
    const governanceIndex = tuple.length - 4;
    const paymentsIndex = tuple.length - 5;
    const collateralIndex = tuple.length - 6;
    const membersIndex = tuple.length - 7;
    const coreIndex = tuple.length - 8;
    const creatorIndex = tuple.length - 9;

    return {
      idRaw: tupleU256(tuple, 0, 1),
      nameRaw: tuple[2] ?? "",
      monthlyRaw: tupleU256(tuple, 3, 4),
      participantsRaw: tupleU256(tuple, 5, 6),
      cycleRaw: tuple[7] ?? 0,
      tokenRaw: tuple[8] ?? {},
      creatorRaw: tuple[creatorIndex] ?? 0,
      coreRaw: tuple[coreIndex] ?? 0,
      membersRaw: tuple[membersIndex] ?? 0,
      collateralRaw: tuple[collateralIndex] ?? 0,
      paymentsRaw: tuple[paymentsIndex] ?? 0,
      governanceRaw: tuple[governanceIndex] ?? 0,
      scheduleRaw: tuple[scheduleIndex] ?? 0,
      initializedRaw: tuple[initializedIndex] ?? false,
      createdAtRaw: tuple[createdAtIndex] ?? 0,
    };
  };

  const fromStructured = () => {
    const structConfig = tuple[1] ?? {};
    const structConfigTuple = extractTupleValues(structConfig);

    return {
      idRaw: tuple[0] ?? fallbackId,
      nameRaw:
        (structConfigTuple.length > 0
          ? structConfigTuple[0]
          : structConfig?.name ?? configRaw?.name) ?? "",
      monthlyRaw:
        structConfigTuple.length >= 3
          ? tupleU256(structConfigTuple, 1, 2)
          : (structConfig?.monthly_contribution ??
            structConfig?.monthlyContribution ??
            configRaw?.monthly_contribution ??
            configRaw?.monthlyContribution ??
            0),
      participantsRaw:
        structConfigTuple.length >= 5
          ? tupleU256(structConfigTuple, 3, 4)
          : (structConfig?.total_participants ??
            structConfig?.totalParticipants ??
            configRaw?.total_participants ??
            configRaw?.totalParticipants ??
            0),
      cycleRaw:
        (structConfigTuple.length > 5
          ? structConfigTuple[5]
          : structConfig?.cycle_duration ??
            structConfig?.cycleDuration ??
            configRaw?.cycle_duration ??
            configRaw?.cycleDuration) ?? 0,
      tokenRaw:
        (structConfigTuple.length > 6
          ? structConfigTuple[6]
          : structConfig?.payment_token ??
            structConfig?.paymentToken ??
            configRaw?.payment_token ??
            configRaw?.paymentToken) ?? {},
      creatorRaw:
        (structConfigTuple.length > 0
          ? structConfigTuple[structConfigTuple.length - 1]
          : structConfig?.creator ?? configRaw?.creator) ?? 0,
      coreRaw: tuple[2] ?? 0,
      membersRaw: tuple[3] ?? 0,
      collateralRaw: tuple[4] ?? 0,
      paymentsRaw: tuple[5] ?? 0,
      governanceRaw: tuple[6] ?? 0,
      scheduleRaw: tuple[7] ?? 0,
      initializedRaw: tuple[8] ?? false,
      createdAtRaw: tuple[9] ?? 0,
    };
  };

  const fromNamed = () => ({
    idRaw: raw?.id ?? fallbackId,
    nameRaw: configRaw?.name ?? raw?.name ?? configTuple[0] ?? "",
    monthlyRaw:
      configRaw?.monthly_contribution ??
      configRaw?.monthlyContribution ??
      raw?.monthly_contribution ??
      (configTuple.length >= 3 ? tupleU256(configTuple, 1, 2) : 0),
    participantsRaw:
      configRaw?.total_participants ??
      configRaw?.totalParticipants ??
      raw?.total_participants ??
      (configTuple.length >= 5 ? tupleU256(configTuple, 3, 4) : 0),
    cycleRaw:
      configRaw?.cycle_duration ??
      configRaw?.cycleDuration ??
      raw?.cycle_duration ??
      (configTuple.length > 5 ? configTuple[5] : 0),
    tokenRaw:
      configRaw?.payment_token ??
      configRaw?.paymentToken ??
      raw?.payment_token ??
      (configTuple.length > 6 ? configTuple[6] : {}),
    creatorRaw:
      configRaw?.creator ??
      raw?.creator ??
      (configTuple.length > 0 ? configTuple[configTuple.length - 1] : 0),
    coreRaw: raw?.core_address ?? raw?.coreAddress ?? 0,
    membersRaw: raw?.members_address ?? raw?.membersAddress ?? 0,
    collateralRaw: raw?.collateral_address ?? raw?.collateralAddress ?? 0,
    paymentsRaw: raw?.payments_address ?? raw?.paymentsAddress ?? 0,
    governanceRaw: raw?.governance_address ?? raw?.governanceAddress ?? 0,
    scheduleRaw: raw?.schedule_address ?? raw?.scheduleAddress ?? 0,
    initializedRaw: raw?.is_initialized ?? raw?.isInitialized ?? raw?.is_active ?? false,
    createdAtRaw: raw?.created_at ?? raw?.createdAt ?? 0,
  });

  const parsed = hasNamedStructLayout
    ? fromNamed()
    : hasFlattenedTupleLayout
    ? fromFlattened()
    : hasStructuredTupleLayout
      ? fromStructured()
      : fromNamed();

  return {
    id: toNumberValue(parsed.idRaw),
    config: {
      name: decodeFeltToString(parsed.nameRaw),
      monthlyContribution: toBigIntValue(parsed.monthlyRaw),
      totalParticipants: toNumberValue(parsed.participantsRaw),
      cycleDuration: toNumberValue(parsed.cycleRaw),
      paymentToken: parsePaymentToken(parsed.tokenRaw),
      creator: toHexAddress(parsed.creatorRaw),
    },
    coreAddress: toHexAddress(parsed.coreRaw),
    membersAddress: toHexAddress(parsed.membersRaw),
    collateralAddress: toHexAddress(parsed.collateralRaw),
    paymentsAddress: toHexAddress(parsed.paymentsRaw),
    governanceAddress: toHexAddress(parsed.governanceRaw),
    scheduleAddress: toHexAddress(parsed.scheduleRaw),
    isInitialized: parseBool(parsed.initializedRaw),
    createdAt: toNumberValue(parsed.createdAtRaw),
  };
};

const useStarknetAjoFactory = () => {
  const { account, isConnected, address } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () => new RpcProvider({ nodeUrl: RPC_URL });

  const getReadFactoryContract = () => {
    const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
    if (!factoryAddress) throw new Error("Factory contract not deployed yet");
    const provider = getProvider();
    return new Contract(ajoFactoryAbi as any, factoryAddress, provider);
  };

  const getWriteFactoryContract = () => {
    if (!account || !isConnected) {
      throw new Error("Wallet not connected");
    }
    const factoryAddress = CONTRACT_ADDRESSES.sepolia.ajoFactory;
    if (!factoryAddress) throw new Error("Factory contract not deployed yet");
    const provider = getProvider();
    const contract = new Contract(ajoFactoryAbi as any, factoryAddress, account);
    return { contract, provider };
  };

  const withWrite = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

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

        let deploymentTxs: Array<{ method: string; txHash: string }> = [];
        let deploymentWarning: string | undefined;

        try {
          const ownerAddressRaw = await factoryContract.owner();
          const ownerAddress = normalizeAddressForCompare(
            toHexAddress(ownerAddressRaw),
          );
          const callerAddress = normalizeAddressForCompare(address);
          const callerIsFactoryOwner = ownerAddress === callerAddress;

          if (callerIsFactoryOwner) {
            deploymentTxs = await runPhaseDeployments(
              factoryContract,
              provider,
              ajoIdU256,
            );
          } else {
            deploymentWarning =
              "Ajo created, but module deployment is owner-restricted on this factory. Ask factory owner to deploy phases for this Ajo.";
          }
        } catch (deploymentError: any) {
          const message = String(deploymentError?.message || deploymentError || "");
          if (
            message.toLowerCase().includes("caller is not the owner") ||
            message.toLowerCase().includes("not the owner")
          ) {
            deploymentWarning =
              "Ajo created, but module deployment is owner-restricted on this factory. Ask factory owner to deploy phases for this Ajo.";
          } else {
            throw deploymentError;
          }
        }

        return {
          transactionHash: tx.transaction_hash,
          ajoId,
          deploymentTxs,
          deploymentWarning,
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
      const factoryContract = getReadFactoryContract();
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
      const factoryContract = getReadFactoryContract();
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
      const factoryContract = getReadFactoryContract();
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

  const deployMembers = useCallback(
    async (ajoId: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.deploy_members(cairo.uint256(ajoId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const deployCollateralAndPayments = useCallback(
    async (ajoId: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.deploy_collateral_and_payments(cairo.uint256(ajoId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const deployGovernanceAndSchedule = useCallback(
    async (ajoId: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.deploy_governance_and_schedule(cairo.uint256(ajoId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const deployCore = useCallback(
    async (ajoId: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.deploy_core(cairo.uint256(ajoId));
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const getUsdcTokenAddress = useCallback(async () => {
    const factoryContract = getReadFactoryContract();
    return toHexAddress(await factoryContract.get_usdc_token_address());
  }, []);

  const getBtcTokenAddress = useCallback(async () => {
    const factoryContract = getReadFactoryContract();
    return toHexAddress(await factoryContract.get_btc_token_address());
  }, []);

  const isPaused = useCallback(async () => {
    const factoryContract = getReadFactoryContract();
    return parseBool(await factoryContract.is_paused());
  }, []);

  const setUsdcTokenAddress = useCallback(
    async (tokenAddress: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_usdc_token_address(tokenAddress);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setBtcTokenAddress = useCallback(
    async (tokenAddress: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_btc_token_address(tokenAddress);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setCoreClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_core_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setMembersClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_members_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setCollateralClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_collateral_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setPaymentsClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_payments_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setGovernanceClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_governance_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const setScheduleClassHash = useCallback(
    async (classHash: string) =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.set_schedule_class_hash(classHash);
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const pause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.pause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  const unpause = useCallback(
    async () =>
      withWrite(async () => {
        const { contract, provider } = getWriteFactoryContract();
        const tx = await contract.unpause();
        await provider.waitForTransaction(tx.transaction_hash);
        return { success: true, transactionHash: tx.transaction_hash };
      }),
    [account, isConnected],
  );

  return {
    createAjo,
    getAjoInfo,
    getUserAjos,
    getTotalAjos,
    getAllAjos,
    deployAjoContracts,
    deployMembers,
    deployCollateralAndPayments,
    deployGovernanceAndSchedule,
    deployCore,
    getUsdcTokenAddress,
    getBtcTokenAddress,
    isPaused,
    setUsdcTokenAddress,
    setBtcTokenAddress,
    setCoreClassHash,
    setMembersClassHash,
    setCollateralClassHash,
    setPaymentsClassHash,
    setGovernanceClassHash,
    setScheduleClassHash,
    pause,
    unpause,
    loading,
  };
};

export default useStarknetAjoFactory;
