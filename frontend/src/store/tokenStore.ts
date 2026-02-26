import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TokenState {
  hbar: string | null;
  whbar: string | null;
  usdc: string | null;
  loading: boolean;
  nairaRate: number;
  address: string;
  error: string | null;
  setAddress: (add: string) => void;
  setHbar: (bal: string) => void;
  setWhbar: (bal: string) => void;
  setNaira: (bal: number) => void;
  setUsdc: (bal: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set) => ({
      hbar: null,
      whbar: null,
      usdc: null,
      nairaRate: 0,
      address: "",
      loading: false,
      error: null,
      setAddress: (add) => set({ address: add }),
      setHbar: (bal) => set({ hbar: bal }),
      setWhbar: (bal) => set({ whbar: bal }),
      setNaira: (bal) => set({ nairaRate: bal }),
      setUsdc: (bal) => set({ usdc: bal }),
      setLoading: (loading) => set({ loading }),
      setError: (err) => set({ error: err }),
      reset: () => set({ hbar: null, usdc: null, loading: false, error: null }),
    }),
    { name: "token-storage" } //persisted in local storage
  )
);
