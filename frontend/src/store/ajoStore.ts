/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Helper to check if value is a BigInt-like object
const isBigNumberLike = (value: any): boolean => {
  return value && typeof value === 'object' && 'toString' in value;
};

export interface AjoInfo {
  ajoId: number;
  ajoCore: string;
  ajoMembers: string;
  ajoCollateral: string;
  ajoPayments: string;
  ajoGovernance: string;
  ajoSchedule: string;
  creator: string;
  createdAt: string; // stored as string (timestamp or block number)
  name: string;
  isActive: boolean;
  usesHtsTokens: boolean;
  usdcToken: string;
  hbarToken: string;
  hcsTopicId: string;
  usesScheduledPayments: boolean;
  scheduledPaymentsCount: string;
  ajoCycleDuration: string;
  ajoMonthlyPaymentUSDC: string;
  ajoMonthlyPaymentHBAR: string;
}

interface AjoStore {
  ajoInfos: AjoInfo[];
  hasMore: boolean;
  setAjoInfos: (data: any[]) => void;
  clearAjoInfos: () => void;
}

const mapAjoStruct = (ajo: any[], index: number): AjoInfo => {
  const createdAtValue = isBigNumberLike(ajo[7])
    ? ajo[7].toString()
    : String(ajo[7]);

  const scheduledPaymentsCountValue = isBigNumberLike(ajo[15])
    ? ajo[15].toString()
    : String(ajo[15]);

  const ajoCycleDurationValue = isBigNumberLike(ajo[16])
    ? ajo[16].toString()
    : String(ajo[16]);

  const ajoMonthlyPaymentUSDCValue = isBigNumberLike(ajo[17])
    ? ajo[17].toString()
    : String(ajo[17]);

  const ajoMonthlyPaymentHBARValue = isBigNumberLike(ajo[18])
    ? ajo[18].toString()
    : String(ajo[18]);

  return {
    ajoId: index + 1,
    ajoCore: ajo[0],
    ajoMembers: ajo[1],
    ajoCollateral: ajo[2],
    ajoPayments: ajo[3],
    ajoGovernance: ajo[4],
    ajoSchedule: ajo[5], // Index 5
    creator: ajo[6], // Index 6
    createdAt: createdAtValue, // Index 7
    name: ajo[8], // Index 8
    isActive: ajo[9], // Index 9
    usesHtsTokens: ajo[10],
    usdcToken: ajo[11], // Index 11
    hbarToken: ajo[12], // Index 12
    hcsTopicId: ajo[13], // Index 13
    usesScheduledPayments: ajo[14], // Index 14
    scheduledPaymentsCount: scheduledPaymentsCountValue,
    ajoCycleDuration: ajoCycleDurationValue,
    ajoMonthlyPaymentUSDC: ajoMonthlyPaymentUSDCValue,
    ajoMonthlyPaymentHBAR: ajoMonthlyPaymentHBARValue,
  };
};

export const useAjoStore = create<AjoStore>()(
  persist(
    (set) => ({
      ajoInfos: [],
      hasMore: false,
      setAjoInfos: (data) =>
        set({
          ajoInfos: data.map((ajo: any, index: number) =>
            mapAjoStruct(ajo, index)
          ),
        }),
      clearAjoInfos: () => set({ ajoInfos: [], hasMore: false }),
    }),
    {
      name: "ajo-storage", // key in localStorage
    }
  )
);
