/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { ethers } from "ethers";
import AjoMembersABI from "@/abi/ajoMembers.json";
import { useMembersStore } from "@/store/ajoMembersStore";

// Addresses from environment variables
const USDC_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HBAR_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_WHBAR_ADDRESS;

export type PaymentToken = 0 | 1;

export const PaymentToken = {
  USDC: 0,
  HBAR: 1,
} as const;

// ERC20 ABI for approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

const useAjoMembers = (ajoMembersAddress: string) => {
  const { setMembersDetails } = useMembersStore();
  /**
   * Get all Members Details
   */
  const getAllMembersDetails = useCallback(async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
          "https://testnet.hashio.io/api"
      );
      const ajoMembersContract = new ethers.Contract(
        ajoMembersAddress,
        AjoMembersABI.abi,
        provider
      );
      const membersDetails = await ajoMembersContract.getAllMembersDetails();
      setMembersDetails(membersDetails);
      return membersDetails;
    } catch (err) {
      console.log("Error getting members details:", err);
    }
  }, [ajoMembersAddress, setMembersDetails]);

  // ---------------- RETURN HOOK ----------------
  return {
    getAllMembersDetails,
    // getMembersDetailsPaginated,
    // getMemberActivity,
    // getMembersNeedingPayment,
    // getMembersWithDefaults,
    // getTopMembersByReputation,
    // getMembersByStatus,
  };
};

export default useAjoMembers;
