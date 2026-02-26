/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";
// import { BigNumber } from "ethers";

export interface MemberDetail {
  userAddress: string;
  hasReceivedPayout: boolean;
  queuePosition: string; // stringified BigNumber
  hasPaidThisCycle: boolean;
  collateralLocked: string; // stringified BigNumber
  guarantorAddress: string;
  guarantorQueuePosition: string; // stringified BigNumber
  totalPaid: string; // stringified BigNumber
  defaultCount: string; // stringified BigNumber
  reputationScore: string; // stringified BigNumber
  isHtsAssociated: boolean;
  isFrozen: boolean;
}

interface MembersStoreState {
  membersDetails: MemberDetail[];
  setMembersDetails: (members: any[]) => void;
  clearMembersDetails: () => void;
}

// helper to convert BigNumbers → strings safely
const serializeMembers = (members: any[]): MemberDetail[] =>
  members.map((m) => ({
    userAddress: m.userAddress,
    hasReceivedPayout: m.hasReceivedPayout,
    queuePosition: m.queuePosition?.toString?.() || "0",
    hasPaidThisCycle: m.hasPaidThisCycle,
    collateralLocked: m.collateralLocked?.toString?.() || "0",
    guarantorAddress: m.guarantorAddress,
    guarantorQueuePosition: m.guarantorQueuePosition?.toString?.() || "0",
    totalPaid: m.totalPaid?.toString?.() || "0",
    defaultCount: m.defaultCount?.toString?.() || "0",
    reputationScore: m.reputationScore?.toString?.() || "0",
    isHtsAssociated: m.isHtsAssociated || false,
    isFrozen: m.isFrozen || false,
  }));

// helper to restore strings → BigNumbers if needed later
export const deserializeMembers = (members: MemberDetail[]) =>
  members.map((m) => ({
    ...m,
    queuePosition: BigInt(m.queuePosition),
    collateralLocked: BigInt(m.collateralLocked),
    guarantorQueuePosition: BigInt(m.guarantorQueuePosition),
    totalPaid: BigInt(m.totalPaid),
    defaultCount: BigInt(m.defaultCount),
    reputationScore: BigInt(m.reputationScore),
  }));

export const useMembersStore = create<MembersStoreState>()(
  // persist(
  (set) => ({
    membersDetails: [],
    setMembersDetails: (members: any[]) => {
      const serialized = serializeMembers(members);
      set({ membersDetails: serialized });
    },
    clearMembersDetails: () => set({ membersDetails: [] }),
  })
  // {
  //   name: "ajo-members-storage", // localStorage key
  //   version: 1,
  // }
  // )
);
