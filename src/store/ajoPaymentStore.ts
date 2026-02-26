/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

interface CycleConfig {
  amount: string;
  cycle: number;
  recipient: string;
  timeStamp: any;
}

export interface MembersPaymentStatus {
  paidMembers: string[];
  unpaidMembers: string[];
  totalCollected: string;
}

interface PaymentStore {
  monthlyPayment: number | null;
  paymentStatus: MembersPaymentStatus | null;
  setPaymentStatus: (status: MembersPaymentStatus | null) => void;
  cycleConfig: CycleConfig | null;
  setCycleConfig: (config: CycleConfig | null) => void;
  setMonthlyPayment: (amount: number) => void;
}

export const usePaymentStore = create<PaymentStore>()((set) => ({
  monthlyPayment: null,
  paymentStatus: null,
  cycleConfig: null,
  setCycleConfig: (config) => set({ cycleConfig: config }),
  setMonthlyPayment: (amount) => set({ monthlyPayment: amount }),
  setPaymentStatus: (value) => {
    if (!value) {
      set({ paymentStatus: null });
      return;
    }

    // The contract returns a struct with named properties
    // Access them directly by name, not by index
    const memberPaymentStatus: MembersPaymentStatus = {
      paidMembers: value.paidMembers || [],
      unpaidMembers: value.unpaidMembers || [],
      totalCollected: value.totalCollected?.toString() || "0",
    };
    set({ paymentStatus: memberPaymentStatus });
  },
}));
