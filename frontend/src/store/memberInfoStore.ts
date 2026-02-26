/* eslint-disable @typescript-eslint/no-explicit-any */
// store/memberInfoStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

// -----------------------------
// Interfaces
// -----------------------------
export interface MemberStruct {
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
}

export interface MemberInfoResponse {
  memberInfo: MemberStruct;
  pendingPenalty: string;
  effectiveVotingPower: string;
}

interface QueueInfo {
  position: string;
  estimatedCyclesWait: string;
}

interface TokenConfig {
  monthlyPayment: string;
  isActive: boolean;
}

interface CycleConfig {
  amount: string;
  cycle: number;
  recipient: string;
  timeStamp: any;
}

interface MemberStore {
  memberData: MemberInfoResponse | null;
  needsToPayThisCycle: boolean | null;
  queueInfo: QueueInfo | null;
  tokenConfig: TokenConfig | null;
  cycleConfig: CycleConfig | null;
  loading: boolean;
  error: string | null;

  // setters
  setMemberData: (data: MemberInfoResponse | null) => void;
  setNeedsToPay: (value: boolean | null) => void;
  setQueueInfo: (info: QueueInfo | null) => void;
  setTokenConfig: (config: TokenConfig | null) => void;
  setCycleConfig: (config: CycleConfig | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// -----------------------------
// Store
// -----------------------------
export const useMemberStore = create<MemberStore>()(
  persist(
    (set) => ({
      memberData: null,
      needsToPayThisCycle: null,
      queueInfo: null,
      tokenConfig: null,
      cycleConfig: null,
      loading: false,
      error: null,
      isHydrated: false,

      setMemberData: (data) => {
        // ✅ Ensure BigInts are strings before persisting
        if (data) {
          const safeMember = {
            ...data,
            memberInfo: {
              ...data.memberInfo,
              queueNumber: data.memberInfo.queueNumber.toString(),
              joinedCycle: data.memberInfo.joinedCycle.toString(),
              totalPaid: data.memberInfo.totalPaid.toString(),
              requiredCollateral: data.memberInfo.requiredCollateral.toString(),
              lockedCollateral: data.memberInfo.lockedCollateral.toString(),
              lastPaymentCycle: data.memberInfo.lastPaymentCycle.toString(),
              defaultCount: data.memberInfo.defaultCount.toString(),
              reputationScore: data.memberInfo.reputationScore.toString(),
              pastPayments: data.memberInfo.pastPayments.map((p) =>
                p.toString()
              ),
              guaranteePosition: data.memberInfo.guaranteePosition.toString(),
            },
          };
          set({ memberData: safeMember });
        } else {
          set({ memberData: null });
        }
      },
      setNeedsToPay: (value) => set({ needsToPayThisCycle: value }),
      setQueueInfo: (info) => set({ queueInfo: info }),
      setTokenConfig: (config) => set({ tokenConfig: config }),
      setCycleConfig: (config) => set({ cycleConfig: config }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: "member-info-storage",
    }
  )
);
