import type { BigNumber } from "ethers";

export {};
declare global {
  type MemberStruct = {
    queueNumber: string; // ✅ BigInt stored as string
    joinedCycle: string;
    totalPaid: string;
    requiredCollateral: string;
    lockedCollateral: string;
    lastPaymentCycle: string;
    defaultCount: string;
    hasReceivedPayout: boolean;
    isActive: boolean;
    guarantor: string;
    preferredToken: number;
    reputationScore: string;
    pastPayments: string[];
    guaranteePosition: string;
    isHtsAssociated: boolean;
    isFrozen: boolean;
  };

  export type MemberInfoResponse = {
    memberInfo: MemberStruct;
    pendingPenalty: string; // bigint -> string
    effectiveVotingPower: string; // bigint -> string
  };

  export type ContractStats = {
    totalMembers: string;
    activeMembers: string;
    totalCollateralUSDC: string;
    totalCollateralHBAR: string;
    contractBalanceUSDC: string;
    contractBalanceHBAR: string;
    currentQueuePosition: string;
    activeToken: number;
  };
  interface AjoGroup {
    id: string;
    name: string;
    description: string;
    monthlyPayment: number;
    totalMembers: number;
    currentMembers: number;
    paymentToken: "USDC" | "HBAR";
    cycleLength: number;
    collateralRequired: number;
    nextPayout: string;
    status: "active" | "forming" | "completed";
    creator: string;
    reputation: number;
    totalSaved: number;
    completedCycles: number;
  }

  interface Organization {
    id: string;
    name: string;
    type: "NGO" | "Charity" | "Religious";
    impactScore: number;
    totalDonations: number;
    activeProjects: number;
    transparency: "High" | "Medium" | "Low";
  }

  interface AjoOperationalStatus {
    totalMembers: BigNumber;
    activeMembers: BigNumber;
    totalCollateralUSDC: BigNumber;
    totalCollateralHBAR: BigNumber;
    contractBalanceUSDC: BigNumber;
    contractBalanceHBAR: BigNumber;
    currentCycle: BigNumber;
    activeToken: string | number;
    canAcceptMembers: boolean;
    canProcessPayments: boolean;
    canDistributePayouts: boolean;
  }
}
