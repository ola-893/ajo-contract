import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TokenState {
  strk: string | null;
  eth: string | null;
  usdc: string | null;
  loading: boolean;
  nairaRate: number;
  address: string;
  error: string | null;
  setAddress: (add: string) => void;
  setStrk: (bal: string) => void;
  setEth: (bal: string) => void;
  setNaira: (bal: number) => void;
  setUsdc: (bal: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set) => ({
      strk: null,
      eth: null,
      usdc: null,
      nairaRate: 0,
      address: "",
      loading: false,
      error: null,
      setAddress: (add) => set({ address: add }),
      setStrk: (bal) => set({ strk: bal }),
      setEth: (bal) => set({ eth: bal }),
      setNaira: (bal) => set({ nairaRate: bal }),
      setUsdc: (bal) => set({ usdc: bal }),
      setLoading: (loading) => set({ loading }),
      setError: (err) => set({ error: err }),
      reset: () => set({ strk: null, eth: null, usdc: null, loading: false, error: null }),
    }),
    { name: "token-storage" } //persisted in local storage
  )
);
