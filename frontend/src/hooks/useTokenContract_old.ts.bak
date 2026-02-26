/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useTokenContract.ts
import { useMemo } from "react";
import { ethers, Contract } from "ethers";
import ERC20_ABI from "../abi/erc20ABI";
import { useWallet } from "@/auth/WalletContext";

type ERC20Contract = Contract & {
  allowance(owner: string, spender: string): Promise<any>;
  approve(spender: string, amount: any): Promise<any>;
  balanceOf(owner: string): Promise<any>;
  transfer(to: string, amount: any): Promise<any>;
  transferFrom(from: string, to: string, amount: any): Promise<any>;
  decimals(): Promise<number>;
  mint?(amount: any): Promise<any>; // some test tokens expose mint
  faucet?: () => Promise<any>; // faucet function if available
};

export const useTokenContract = (tokenAddress: string) => {
  const { address } = useWallet();

  const provider = new ethers.providers.Web3Provider((window as any).ethereum);

  const contract = useMemo(() => {
    if (!provider || !tokenAddress) return null;
    return new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    ) as ERC20Contract;
  }, [provider, tokenAddress]);

  // ----------------- Read -----------------
  const getAllowance = async (owner: string, spender: string) => {
    if (!contract) throw new Error("Contract not ready");
    return contract.allowance(owner, spender);
  };

  const getBalance = async (owner: string) => {
    if (!contract) throw new Error("Contract not ready");
    return contract.balanceOf(owner);
  };

  // ----------------- Write -----------------
  const approve = async (spender: string, amount: any) => {
    if (!contract || !provider) throw new Error("Contract not ready");
    const signer = provider.getSigner();
    const writeable = contract.connect(signer) as ERC20Contract;
    const tx = await writeable.approve(spender, amount);
    return tx.wait();
  };

  const mint = async (amount: any) => {
    if (!contract || !provider) throw new Error("Contract not ready");
    const signer = provider.getSigner();
    const writeable = contract.connect(signer) as ERC20Contract;

    if (!writeable.mint) throw new Error("This token does not support minting");

    const tx = await writeable.mint(amount);
    return tx.wait();
  };

  const faucet = async () => {
    if (!contract || !provider || !address)
      throw new Error("Contract or wallet not ready");

    const signer = provider.getSigner();
    const writeable = contract.connect(signer) as ERC20Contract;

    // ✅ Explicitly check that faucet exists
    if (typeof writeable.faucet !== "function") {
      throw new Error("This token does not have a faucet function");
    }

    const tx = await writeable.faucet();
    await tx.wait();

    // Refresh balance after faucet
    const decimals = await writeable.decimals();
    const newBalance = await writeable.balanceOf(address);

    return ethers.utils.formatUnits(newBalance, decimals);
  };
  return { contract, getAllowance, getBalance, approve, mint, faucet };
};
