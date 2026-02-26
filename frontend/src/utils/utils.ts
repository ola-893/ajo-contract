import { useParams } from "react-router-dom";
import { useAjoStore } from "./../store/ajoStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMembersStore, type MemberDetail } from "@/store/ajoMembersStore";

export const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getNaira = async () => {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=ngn";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch rate from CoinGecko");
  }

  const data = await res.json();
  // CoinGecko responds like: { usd: { ngn: 1500.23 } }
  const rate = data.usd.ngn;
  console.log("rate", rate);
  return rate;
};

export const useAjoDetails = () => {
  const { ajoId, ajoCore } = useParams<{ ajoId: string; ajoCore: string }>();
  const { ajoInfos } = useAjoStore();

  const ajo = useMemo(() => {
    if (!ajoId && !ajoCore) return null;

    const found = ajoInfos.find((item) => {
      const matchesId = ajoId && String(item.ajoId) === String(ajoId); // match by ID
      const matchesCore =
        ajoCore && item.ajoCore.toLowerCase() === ajoCore.toLowerCase(); // match by core
      return matchesId || matchesCore;
    });
    return found ?? null;
  }, [ajoId, ajoCore, ajoInfos]);

  return ajo;
};

export const useIndividualMemberDetails = (memberAddress: string) => {
  const { membersDetails } = useMembersStore();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to check if an address is an HTS token (starts with many zeros)
  const isHtsToken = (address: string): boolean => {
    if (!address.startsWith("0x")) return false;
    return address.toLowerCase().startsWith("0x" + "0".repeat(30));
  };

  // Helper to convert EVM address to Hedera using mirror node
  const convertEvmToHederaAddress = useCallback(
    async (evmAddress: string): Promise<string> => {
      if (!evmAddress.startsWith("0x")) return evmAddress;

      // If it's an HTS token, extract the token ID directly
      if (isHtsToken(evmAddress)) {
        const tokenNum = BigInt(evmAddress);
        const hederaId = `0.0.${tokenNum.toString()}`;
        // console.log(`✅ HTS Token ${evmAddress} -> ${hederaId}`);
        return hederaId;
      }

      try {
        const mirrorNodeUrl =
          import.meta.env.VITE_HEDERA_MIRROR_NODE_URL ||
          "https://testnet.mirrornode.hedera.com";

        const response = await fetch(
          `${mirrorNodeUrl}/api/v1/accounts/${evmAddress}`
        );

        if (!response.ok) {
          throw new Error(`Mirror node query failed: ${response.statusText}`);
        }

        const data = await response.json();
        const hederaId = data.account;
        // console.log(`✅ Converted ${evmAddress} to ${hederaId}`);
        return hederaId;
      } catch (error) {
        console.error("Failed to convert EVM to Hedera address:", error);
        throw new Error(
          `Could not convert address ${evmAddress} to Hedera format`
        );
      }
    },
    []
  );

  useEffect(() => {
    const findMember = async () => {
      if (!memberAddress || membersDetails.length === 0) {
        setMember(null);
        return;
      }

      setIsLoading(true);
      try {
        // Check each member's address
        for (const memberDetail of membersDetails) {
          const hederaAddress = await convertEvmToHederaAddress(
            memberDetail.userAddress
          );

          if (hederaAddress === memberAddress) {
            setMember(memberDetail);
            setIsLoading(false);
            return;
          }
        }

        // No match found
        setMember(null);
      } catch (error) {
        console.error("Error finding member:", error);
        setMember(null);
      } finally {
        setIsLoading(false);
      }
    };

    findMember();
  }, [memberAddress, membersDetails, convertEvmToHederaAddress]);
  // console.log("individual member details---", member);
  return { member, isLoading };
};

// utils/formatTimestamp.ts
export function formatTimestamp(timestamp: string | number): string {
  if (!timestamp) return "N/A";

  // Ensure timestamp is a number
  const seconds =
    typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;

  // Convert seconds → milliseconds
  const date = new Date(seconds * 1000);

  // Format options
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  // Example output: "25 July, 10:30 PM"
  return date.toLocaleString("en-US", options).replace(",", "");
}

// Utility function to convert a Hedera Account ID (0.0.X) to a long-zero EVM address (0x...)
export const hederaAccountToEvmAddress = (accountId: string): string => {
  // Extract the account number (e.g., '6976876' from '0.0.6976876')
  const accountNum = accountId.split(".").pop();
  if (!accountNum) {
    throw new Error("Invalid Hedera account ID format.");
  }

  // Convert the decimal account number to a hex string
  // 6976876 (decimal) is 6a86c4 (hex)
  const hexAccountNum = BigInt(accountNum).toString(16);

  // Pad the hex string with leading zeros to 40 characters (20 bytes)
  // The address format is 0x + 20 bytes (40 hex chars)
  // The account number is padded to the *rightmost* part of the address.
  const paddedAddress = hexAccountNum.padStart(40, "0");

  return `0x${paddedAddress}`;
};

// Helper to check if an address is an HTS token (starts with many zeros)
const isHtsToken = (address: string): boolean => {
  if (!address.startsWith("0x")) return false;
  // HTS tokens have the format 0x000000000000000000000000000000000XXXXXXX
  // They have at least 32 leading zeros after 0x
  return address.toLowerCase().startsWith("0x" + "0".repeat(30));
};

export const convertEvmToHederaAddress = async (
  evmAddress: string
): Promise<string> => {
  if (!evmAddress.startsWith("0x")) return evmAddress;

  // If it's an HTS token, extract the token ID directly
  if (isHtsToken(evmAddress)) {
    const tokenNum = BigInt(evmAddress);
    const hederaId = `0.0.${tokenNum.toString()}`;
    console.log(`✅ HTS Token ${evmAddress} -> ${hederaId}`);
    return hederaId;
  }

  try {
    const mirrorNodeUrl =
      import.meta.env.VITE_HEDERA_MIRROR_NODE_URL ||
      "https://testnet.mirrornode.hedera.com";

    // Query mirror node for account/contract by EVM address
    const response = await fetch(
      `${mirrorNodeUrl}/api/v1/accounts/${evmAddress}`
    );

    if (!response.ok) {
      throw new Error(`Mirror node query failed: ${response.statusText}`);
    }

    const data = await response.json();
    const hederaId = data.account;
    console.log(`✅ Converted ${evmAddress} to ${hederaId}`);
    return hederaId;
  } catch (error) {
    console.error("Failed to convert EVM to Hedera address:", error);
    throw new Error(`Could not convert address ${evmAddress} to Hedera format`);
  }
};

export const convertToEvmAddress = (address: string): string => {
  if (address.startsWith("0x")) return address;
  const parts = address.split(".");
  if (parts.length === 3) {
    const accountNum = BigInt(parts[2]);
    return "0x" + accountNum.toString(16).padStart(40, "0");
  }
  return address;
};
