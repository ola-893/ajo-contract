/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/ajoDetailsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
// import { BigNumber } from "ethers";

export interface AjoDetailsState {
  ajoId: number | null;
  ajoCore?: string;
  totalMembers: string;
  activeMembers: string;
  totalCollateralUSDC: string;
  totalCollateralHBAR: string;
  contractBalanceUSDC: string;
  contractBalanceHBAR: string;
  currentCycle: string;
  activeToken: string;
  canAcceptMembers: boolean;
  canProcessPayments: boolean;
  canDistributePayouts: boolean;
  setAjoDetails: (details: Partial<AjoDetailsState>) => void;
  resetAjoDetails: () => void;
  loadNewAjo: (ajoId: number) => void;
}

const initialState: Omit<
  AjoDetailsState,
  "setAjoDetails" | "resetAjoDetails" | "loadNewAjo"
> = {
  ajoId: null,
  ajoCore: "",
  totalMembers: "0",
  activeMembers: "0",
  totalCollateralUSDC: "0",
  totalCollateralHBAR: "0",
  contractBalanceUSDC: "0",
  contractBalanceHBAR: "0",
  currentCycle: "0",
  activeToken: "0",
  canAcceptMembers: false,
  canProcessPayments: false,
  canDistributePayouts: false,
};

export const useAjoDetailsStore = create<AjoDetailsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAjoDetails: (details) =>
        set((state) => ({
          ...state,
          ...details,
        })),

      resetAjoDetails: () => set({ ...initialState }),

      // 🔹 Reset when new ajoId is loaded
      loadNewAjo: (ajoId: number) => {
        const currentId = get().ajoId;
        if (currentId !== ajoId) {
          set({ ...initialState, ajoId });
        }
      },
    }),
    {
      name: "ajo-details-storage", // key in localStorage
    }
  )
);

export const bnToString = (val: any) =>
  BigInt(val) ? val.toString() : String(val);
