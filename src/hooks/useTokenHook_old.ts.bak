/* eslint-disable @typescript-eslint/no-explicit-any */
import erc20ABI from "@/abi/erc20ABI";
import { ethers } from "ethers";
import { useTokenStore } from "@/store/tokenStore";

const getContract = (
  address: string,
  provider: ethers.providers.Web3Provider
) => new ethers.Contract(address, erc20ABI, provider);

export const useTokenHook = () => {
  const { setWhbar, setUsdc, setLoading, setError } = useTokenStore();

  const getWhbarBalance = async () => {
    try {
      if (!(window as any).ethereum) {
        setError("MetaMask not detected");
        return;
      }

      setLoading(true);

      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum,
        "any"
      );
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      const whbar = getContract(
        import.meta.env.VITE_MOCK_WHBAR_ADDRESS,
        provider
      );

      const [balance, decimals] = await Promise.all([
        whbar.balanceOf(userAddress),
        // decimals might exist on the contract
        (async () => {
          try {
            return await whbar.decimals();
          } catch {
            return 18; // fallback
          }
        })(),
      ]);

      const formatted = ethers.utils.formatUnits(balance, decimals);
      setWhbar(formatted);
      setLoading(false);
      console.log("Whbar Balance:", formatted);
      return formatted; // readable
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch WHBAR balance");
      setLoading(false);
      return;
    }
  };

  const getUsdcBalance = async () => {
    try {
      if (!(window as any).ethereum) {
        setError("MetaMask not detected");
        return;
      }
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum,
        "any"
      );
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      const usdc = getContract(
        import.meta.env.VITE_MOCK_USDC_ADDRESS,
        provider
      );
      const [balance, decimals] = await Promise.all([
        usdc.balanceOf(userAddress),
        (async () => {
          try {
            return await usdc.decimals();
          } catch {
            return 6; // fallback to 6 for USDC
          }
        })(),
      ]);

      const formatted = ethers.utils.formatUnits(balance, decimals);
      setUsdc(formatted);
      setLoading(false);
      return formatted;
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch USDC balance");
      setLoading(false);
      return;
    }
  };

  return {
    getWhbarBalance,
    getUsdcBalance,
  };
};

export default useTokenHook;
