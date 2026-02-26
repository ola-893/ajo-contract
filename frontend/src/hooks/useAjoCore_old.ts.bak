/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";
import {
  ContractId,
  AccountAllowanceApproveTransaction,
  Client,
  TokenId,
  AccountId,
  TransactionId,
} from "@hashgraph/sdk";
import { ethers } from "ethers";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import { dappConnector } from "@/services/wallets/walletconnect/walletConnectClient";
import { ContractFunctionParameterBuilder } from "@/services/wallets/contractFunctionParameterBuilder";
import AjoCoreABI from "@/abi/ajoCore.json";
import { toast } from "sonner";
import { BigNumber } from "ethers";
import { useMemberStore } from "@/store/memberInfoStore";

// 💡 Define V5 BigNumber constants for common operations
const ONE_MILLION_BN = BigNumber.from(1000000);

// Addresses from environment variables
const USDC_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HBAR_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_WHBAR_ADDRESS;
const AJO_CORE_ADDRESS_EVM = import.meta.env.VITE_AJO_CORE_CONTRACT_ADDRESS_EVM;
const AJO_CORE_ADDRESS_HEDERA = import.meta.env
  .VITE_AJO_CORE_CONTRACT_ADDRESS_HEDERA;

export type PaymentToken = 0 | 1;

export const PaymentToken = {
  USDC: 0,
  HBAR: 1,
} as const;

// ERC20 ABI for approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

export const useAjoCore = (ajoCoreAddress?: string) => {
  const { accountId, walletInterface } = useWalletInterface();
  const [loading, setLoading] = useState(false);
  const { setMemberData } = useMemberStore();

  // Helper to determine if using MetaMask
  const isMetaMask = accountId?.startsWith("0x");
  const contractAddress =
    ajoCoreAddress ||
    (isMetaMask ? AJO_CORE_ADDRESS_EVM : AJO_CORE_ADDRESS_HEDERA);

  // Helper to check if an address is an HTS token (starts with many zeros)
  const isHtsToken = (address: string): boolean => {
    if (!address.startsWith("0x")) return false;
    // HTS tokens have the format 0x000000000000000000000000000000000XXXXXXX
    // They have at least 32 leading zeros after 0x
    return address.toLowerCase().startsWith("0x" + "0".repeat(30));
  };

  // Helper to convert EVM address to Hedera using mirror node
  const convertEvmToHederaAddress = useCallback(
    async (evmAddress: string): Promise<string> => {
      if (!evmAddress.startsWith("0x")) return evmAddress;

      // If it's an HTS token, extract the token ID directly
      if (isHtsToken(evmAddress)) {
        const tokenNum = BigInt(evmAddress);
        const hederaId = `0.0.${tokenNum.toString()}`;
        console.log(`✅ HTS Token ${evmAddress} -> ${hederaId}`);
        return hederaId;
      }

      try {
        const mirrorNodeUrl =
          import.meta.env.VITE_HEDERA_MIRROR_NODE_URL ||
          "https://testnet.mirrornode.hedera.com";

        // Query mirror node for account/contract by EVM address
        const response = await fetch(
          `${mirrorNodeUrl}/api/v1/accounts/${evmAddress}`
        );

        if (!response.ok) {
          throw new Error(`Mirror node query failed: ${response.statusText}`);
        }

        const data = await response.json();
        const hederaId = data.account;
        console.log(`✅ Converted ${evmAddress} to ${hederaId}`);
        return hederaId;
      } catch (error) {
        console.error("Failed to convert EVM to Hedera address:", error);
        throw new Error(
          `Could not convert address ${evmAddress} to Hedera format`
        );
      }
    },
    []
  );

  // Helper to convert Hedera address to EVM (for reading data via JSON-RPC)
  const convertToEvmAddress = (address: string): string => {
    if (address.startsWith("0x")) return address;
    const parts = address.split(".");
    if (parts.length === 3) {
      const accountNum = BigInt(parts[2]);
      return "0x" + accountNum.toString(16).padStart(40, "0");
    }
    return address;
  };

  /**
   * Approve token spending for collateral contract
   */
  const approveCollateral = useCallback(
    async (
      collateralAddress: string,
      tokenChoice: PaymentToken,
      amount?: string
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const tokenAddress =
          tokenChoice === PaymentToken.USDC
            ? USDC_TOKEN_ADDRESS
            : HBAR_TOKEN_ADDRESS;
        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;

        // Default to max uint256 if no amount specified
        const approvalAmount = amount
          ? ethers.utils.parseUnits(amount, decimals)
          : ethers.constants.MaxUint256;

        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            signer
          );

          const tx = await tokenContract.approve(
            collateralAddress,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          toast.success("Collateral approval successful!");
          return tx.hash;
        } else {
          // HashPack/WalletConnect: Use AccountAllowanceApproveTransaction for HTS
          const hederaCollateralAddress = await convertEvmToHederaAddress(
            collateralAddress
          );
          const hederaTokenAddress = await convertEvmToHederaAddress(
            tokenAddress
          );

          // Convert approval amount to int64 (Hedera's max allowance)
          // Max int64: 9,223,372,036,854,775,807
          const MAX_INT64 = BigInt("9223372036854775807");
          const approvalBigInt = approvalAmount.toBigInt();
          const hederaAllowanceAmount =
            approvalBigInt > MAX_INT64 ? MAX_INT64 : approvalBigInt;

          console.log("Approving HTS token:", hederaTokenAddress);
          console.log("For spender:", hederaCollateralAddress);
          console.log("Amount:", hederaAllowanceAmount.toString());

          // Get the signer from dappConnector
          const signer = dappConnector.signers?.[0];
          if (!signer) {
            throw new Error("No signer available from wallet");
          }

          // Create approval transaction using AccountAllowanceApproveTransaction
          const hederaClient = Client.forTestnet();

          const approveTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
              TokenId.fromString(hederaTokenAddress),
              AccountId.fromString(accountId),
              AccountId.fromString(hederaCollateralAddress),
              Number(hederaAllowanceAmount)
            )
            .setTransactionId(
              TransactionId.generate(AccountId.fromString(accountId))
            )
            .setNodeAccountIds([AccountId.fromString("0.0.3")]);

          // Freeze the transaction
          await approveTx.freezeWith(hederaClient);

          // Execute with signer
          const txResponse = await approveTx.executeWithSigner(signer);
          const txId = txResponse.transactionId;

          toast.success("Collateral approval successful!");
          console.log("✅ Collateral approved, tx ID:", txId.toString());
          return txId.toString();
        }
      } catch (error: any) {
        console.error("Approve collateral failed:", error);
        toast.error("Collateral approval failed");
        throw new Error(error.message || "Failed to approve collateral");
      } finally {
        setLoading(false);
      }
    },
    [walletInterface, accountId, isMetaMask, convertEvmToHederaAddress]
  );

  /**
   * Approve token spending for payments contract
   */
  const approvePayments = useCallback(
    async (
      paymentsAddress: string,
      tokenChoice: PaymentToken,
      amount?: string
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        const tokenAddress =
          tokenChoice === PaymentToken.USDC
            ? USDC_TOKEN_ADDRESS
            : HBAR_TOKEN_ADDRESS;
        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;

        const approvalAmount = amount
          ? ethers.utils.parseUnits(amount, decimals)
          : ethers.constants.MaxUint256;

        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            signer
          );

          const tx = await tokenContract.approve(
            paymentsAddress,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          toast.success("Payments approval successful!");
          return tx.hash;
        } else {
          // HashPack/WalletConnect: Use AccountAllowanceApproveTransaction for HTS
          const hederaPaymentsAddress = await convertEvmToHederaAddress(
            paymentsAddress
          );
          const hederaTokenAddress = await convertEvmToHederaAddress(
            tokenAddress
          );

          // Convert approval amount to int64 (Hedera's max allowance)
          const MAX_INT64 = BigInt("9223372036854775807");
          const approvalBigInt = approvalAmount.toBigInt();
          const hederaAllowanceAmount =
            approvalBigInt > MAX_INT64 ? MAX_INT64 : approvalBigInt;

          console.log("Approving HTS token:", hederaTokenAddress);
          console.log("For spender:", hederaPaymentsAddress);
          console.log("Amount:", hederaAllowanceAmount.toString());

          // Get the signer from dappConnector
          const signer = dappConnector.signers?.[0];
          if (!signer) {
            throw new Error("No signer available from wallet");
          }

          // Create approval transaction using AccountAllowanceApproveTransaction
          const hederaClient = Client.forTestnet();

          const approveTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
              TokenId.fromString(hederaTokenAddress),
              AccountId.fromString(accountId),
              AccountId.fromString(hederaPaymentsAddress),
              Number(hederaAllowanceAmount)
            )
            .setTransactionId(
              TransactionId.generate(AccountId.fromString(accountId))
            )
            .setNodeAccountIds([AccountId.fromString("0.0.3")]);

          // Freeze the transaction
          await approveTx.freezeWith(hederaClient);

          // Execute with signer
          const txResponse = await approveTx.executeWithSigner(signer);
          const txId = txResponse.transactionId;

          console.log("✅ Payments approved, tx ID:", txId.toString());
          toast.success("Payments approval successful!");
          return txId.toString();
        }
      } catch (error: any) {
        console.error("Approve payments failed:", error);
        toast.error("Payments approval failed");
        throw new Error(error.message || "Failed to approve payments");
      } finally {
        setLoading(false);
      }
    },
    [walletInterface, accountId, isMetaMask, convertEvmToHederaAddress]
  );

  /**
   * Check token allowances
   */
  const checkAllowances = useCallback(
    async (
      collateralAddress: string,
      paymentsAddress: string,
      tokenChoice: PaymentToken
    ) => {
      if (!accountId) {
        throw new Error("Wallet not connected");
      }

      try {
        const tokenAddress =
          tokenChoice === PaymentToken.USDC
            ? USDC_TOKEN_ADDRESS
            : HBAR_TOKEN_ADDRESS;
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          provider
        );

        const [collateralAllowance, paymentsAllowance, balance] =
          await Promise.all([
            tokenContract.allowance(
              convertToEvmAddress(accountId),
              collateralAddress
            ),
            tokenContract.allowance(
              convertToEvmAddress(accountId),
              paymentsAddress
            ),
            tokenContract.balanceOf(convertToEvmAddress(accountId)),
          ]);

        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;
        return {
          collateralAllowance: ethers.utils.formatUnits(
            collateralAllowance,
            decimals
          ),
          paymentsAllowance: ethers.utils.formatUnits(
            paymentsAllowance,
            decimals
          ),
          balance: ethers.utils.formatUnits(balance, decimals),
        };
      } catch (error: any) {
        console.error("Check allowances failed:", error);
        throw new Error(error.message || "Failed to check allowances");
      }
    },
    [accountId]
  );

  /**
   * Join an Ajo with collateral
   */
  const joinAjo = useCallback(
    async (
      collateralAddress: string,
      paymentsAddress: string,
      tokenChoice: PaymentToken
    ) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        // Step 1: Check current allowances
        const allowances = await checkAllowances(
          collateralAddress,
          paymentsAddress,
          tokenChoice
        );
        const requiredCollateral = await getRequiredCollateral(tokenChoice);

        const collateralNeeded = parseFloat(requiredCollateral);
        const paymentsNeeded = parseFloat(requiredCollateral);

        console.log("💰 Pre-join checks:");
        console.log("- Collateral allowance:", allowances.collateralAllowance);
        console.log("- Payments allowance:", allowances.paymentsAllowance);
        console.log("- Balance:", allowances.balance);
        console.log("- Required:", requiredCollateral);

        // Check sufficient balance
        if (parseFloat(allowances.balance) < collateralNeeded) {
          toast.error(
            `Insufficient balance! Need ${collateralNeeded} but have ${allowances.balance}`
          );
          throw new Error("Insufficient token balance");
        }

        // Step 2: Approve if needed (with proper waiting)
        if (parseFloat(allowances.collateralAllowance) < collateralNeeded) {
          toast.info("Approving collateral...");
          await approveCollateral(
            collateralAddress,
            tokenChoice,
            requiredCollateral === "0" ? "1000" : requiredCollateral
          );

          // Wait for approval to be confirmed on-chain
          console.log("⏳ Waiting for collateral approval to confirm...");
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Verify the approval went through
          const newAllowances = await checkAllowances(
            collateralAddress,
            paymentsAddress,
            tokenChoice
          );
          console.log(
            "✅ New collateral allowance:",
            newAllowances.collateralAllowance
          );

          if (
            parseFloat(newAllowances.collateralAllowance) < collateralNeeded
          ) {
            throw new Error(
              "Collateral approval did not complete successfully"
            );
          }
        }

        if (parseFloat(allowances.paymentsAllowance) < paymentsNeeded) {
          toast.info("Approving payments...");
          await approvePayments(
            paymentsAddress,
            tokenChoice,
            requiredCollateral === "0" ? "1000" : requiredCollateral
          );

          // Wait for approval to be confirmed on-chain
          console.log("⏳ Waiting for payments approval to confirm...");
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Verify the approval went through
          const newAllowances = await checkAllowances(
            collateralAddress,
            paymentsAddress,
            tokenChoice
          );
          console.log(
            "✅ New payments allowance:",
            newAllowances.paymentsAllowance
          );

          if (parseFloat(newAllowances.paymentsAllowance) < paymentsNeeded) {
            throw new Error("Payments approval did not complete successfully");
          }
        }

        // Step 3: Final verification before joining
        console.log("🔍 Final pre-join verification...");
        const finalAllowances = await checkAllowances(
          collateralAddress,
          paymentsAddress,
          tokenChoice
        );

        console.log("Final state:");
        console.log(
          "- Collateral allowance:",
          finalAllowances.collateralAllowance
        );
        console.log("- Payments allowance:", finalAllowances.paymentsAllowance);
        console.log("- Balance:", finalAllowances.balance);

        if (
          parseFloat(finalAllowances.collateralAllowance) < collateralNeeded
        ) {
          throw new Error(
            `Collateral allowance still insufficient: ${finalAllowances.collateralAllowance} < ${collateralNeeded}`
          );
        }

        if (parseFloat(finalAllowances.paymentsAllowance) < paymentsNeeded) {
          throw new Error(
            `Payments allowance still insufficient: ${finalAllowances.paymentsAllowance} < ${paymentsNeeded}`
          );
        }

        // Step 4: Join Ajo
        toast.info("Joining Ajo...");

        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            contractAddress,
            AjoCoreABI.abi,
            signer
          );

          const tx = await contract.joinAjo(tokenChoice, {
            gasLimit: ethers.utils.hexlify(3_000_000),
          });
          const receipt = await tx.wait();
          toast.success("Successfully joined Ajo!");
          return receipt.transactionHash;
        } else {
          // HashPack/WalletConnect
          const hederaContractAddress = await convertEvmToHederaAddress(
            contractAddress
          );

          console.log("🎯 Joining Ajo on contract:", hederaContractAddress);
          console.log("🔢 Token choice:", tokenChoice);

          const params = new ContractFunctionParameterBuilder().addParam({
            type: "uint8",
            name: "tokenChoice",
            value: tokenChoice,
          });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaContractAddress),
            "joinAjo",
            params,
            3_000_000
          );

          console.log("📝 Join Ajo transaction ID:", txId?.toString());
          toast.success("Successfully joined Ajo!");
          return txId?.toString() || null;
        }
      } catch (error: any) {
        console.error("❌ Join Ajo failed:", error);

        let errorMessage = "Failed to join Ajo";
        if (error.message) {
          if (error.message.includes("CollateralNotTransferred")) {
            errorMessage =
              "Collateral transfer failed. Your approvals may not have been confirmed yet. Please try again in a few seconds.";
          } else if (error.message.includes("Insufficient")) {
            errorMessage = error.message;
          } else if (error.message.includes("allowance")) {
            errorMessage = error.message;
          } else {
            errorMessage = error.message;
          }
        }

        toast.error(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      contractAddress,
      isMetaMask,
      approveCollateral,
      approvePayments,
      checkAllowances,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Check payment token allowance
   */
  const checkPaymentAllowance = useCallback(
    async (ajoPaymentAddress: string, tokenChoice: PaymentToken) => {
      if (!accountId) {
        throw new Error("Wallet not connected");
      }

      try {
        const tokenAddress =
          tokenChoice === PaymentToken.USDC
            ? USDC_TOKEN_ADDRESS
            : HBAR_TOKEN_ADDRESS;

        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          provider
        );

        const [allowance, balance] = await Promise.all([
          tokenContract.allowance(
            convertToEvmAddress(accountId),
            ajoPaymentAddress
          ),
          tokenContract.balanceOf(convertToEvmAddress(accountId)),
        ]);

        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;
        return {
          allowance: ethers.utils.formatUnits(allowance, decimals),
          balance: ethers.utils.formatUnits(balance, decimals),
        };
      } catch (error: any) {
        console.error("Check payment allowance failed:", error);
        throw new Error(error.message || "Failed to check payment allowance");
      }
    },
    [accountId]
  );

  /**
   * Process monthly payment
   */
  const processPayment = useCallback(
    async (
      ajoPaymentAddress: string,
      tokenChoice: PaymentToken = PaymentToken.USDC
    ) => {
      if (!walletInterface || !accountId) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      try {
        // Step 1: Get monthly payment amount from contract
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );

        const paymentContract = new ethers.Contract(
          ajoPaymentAddress,
          AjoCoreABI.abi,
          provider
        );
        const tokenConfig = await paymentContract.getTokenConfig(tokenChoice);
        const monthlyPayment = tokenConfig.monthlyPayment;
        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;
        const monthlyPaymentFormatted = ethers.utils.formatUnits(
          monthlyPayment,
          decimals
        );

        console.log(`💵 Monthly payment required: ${monthlyPaymentFormatted}`);

        // Step 2: Check allowance and balance
        const { allowance, balance } = await checkPaymentAllowance(
          ajoPaymentAddress,
          tokenChoice
        );

        console.log("💳 Current allowance:", allowance);
        console.log("💵 Current balance:", balance);

        if (parseFloat(balance) < parseFloat(monthlyPaymentFormatted)) {
          toast.error(
            `Insufficient balance! Need ${monthlyPaymentFormatted} but have ${balance}`
          );
          throw new Error("Insufficient token balance");
        }
        // Step 3: Approve if needed
        if (parseFloat(allowance) < parseFloat(monthlyPaymentFormatted)) {
          toast.info("Approving payment...");
          await approvePayments(
            ajoPaymentAddress,
            tokenChoice,
            monthlyPaymentFormatted
          );

          // Wait for approval to be confirmed on-chain
          console.log("⏳ Waiting for payment approval to confirm...");
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Verify the approval went through
          const newAllowanceData = await checkPaymentAllowance(
            ajoPaymentAddress,
            tokenChoice
          );
          console.log("✅ New payment allowance:", newAllowanceData.allowance);
          if (
            parseFloat(newAllowanceData.allowance) <
            parseFloat(monthlyPaymentFormatted)
          ) {
            throw new Error("Payment approval did not complete successfully");
          }
        }

        // Step 4: Process payment
        toast.info("Processing payment...");
        if (isMetaMask) {
          const provider = new ethers.providers.Web3Provider(
            (window as any).ethereum
          );
          const signer = provider.getSigner();
          const contract = new ethers.Contract(
            contractAddress,
            AjoCoreABI.abi,
            signer
          );

          const tx = await contract.processPayment({
            gasLimit: ethers.utils.hexlify(3_000_000),
          });
          const receipt = await tx.wait();
          return receipt.transactionHash;
        } else {
          const hederaContractAddress = await convertEvmToHederaAddress(
            contractAddress
          );
          const params = new ContractFunctionParameterBuilder();
          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaContractAddress),
            "processPayment",
            params,
            3_000_000
          );
          return txId?.toString() || null;
        }
      } catch (error: any) {
        console.error("❌ Process payment failed:", error);

        let errorMessage = "Failed to process payment";
        if (error.message) {
          if (error.message.includes("Insufficient")) {
            errorMessage = error.message;
          } else if (error.message.includes("allowance")) {
            errorMessage = error.message;
          } else if (error.message.includes("already paid")) {
            errorMessage = "You have already paid for this cycle";
          } else {
            errorMessage = error.message;
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      contractAddress,
      isMetaMask,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Distribute payout to current cycle receiver
   */
  const distributePayout = useCallback(async () => {
    if (!walletInterface || !accountId) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    try {
      if (isMetaMask) {
        const provider = new ethers.providers.Web3Provider(
          (window as any).ethereum
        );
        const signer = provider.getSigner();
        const contract = new ethers.Contract(
          contractAddress,
          AjoCoreABI.abi,
          signer
        );

        const tx = await contract.distributePayout({
          gasLimit: ethers.utils.hexlify(3_000_000),
        });
        const receipt = await tx.wait();
        return receipt.transactionHash;
      } else {
        const hederaContractAddress = await convertEvmToHederaAddress(
          contractAddress
        );
        const params = new ContractFunctionParameterBuilder();
        const txId = await walletInterface.executeContractFunction(
          ContractId.fromString(hederaContractAddress),
          "distributePayout",
          params,
          3_000_000
        );
        console.log("Distributed");
        return txId?.toString() || null;
      }
    } catch (error: any) {
      console.error("Distribute payout failed:", error);
      throw new Error(error.message || "Failed to distribute payout");
    } finally {
      setLoading(false);
    }
  }, [
    walletInterface,
    accountId,
    contractAddress,
    isMetaMask,
    convertEvmToHederaAddress,
  ]);

  /**
   * Exit from Ajo (withdraw collateral and exit)
   */
  const exitAjo = useCallback(async () => {
    if (!walletInterface || !accountId) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    try {
      if (isMetaMask) {
        const provider = new ethers.providers.Web3Provider(
          (window as any).ethereum
        );
        const signer = provider.getSigner();
        const contract = new ethers.Contract(
          contractAddress,
          AjoCoreABI.abi,
          signer
        );

        const tx = await contract.exitAjo({
          gasLimit: ethers.utils.hexlify(3_000_000),
        });
        const receipt = await tx.wait();
        return receipt.transactionHash;
      } else {
        const hederaContractAddress = await convertEvmToHederaAddress(
          contractAddress
        );
        const params = new ContractFunctionParameterBuilder();
        const txId = await walletInterface.executeContractFunction(
          ContractId.fromString(hederaContractAddress),
          "exitAjo",
          params,
          3_000_000
        );
        return txId?.toString() || null;
      }
    } catch (error: any) {
      console.error("Exit Ajo failed:", error);
      throw new Error(error.message || "Failed to exit Ajo");
    } finally {
      setLoading(false);
    }
  }, [
    walletInterface,
    accountId,
    contractAddress,
    isMetaMask,
    convertEvmToHederaAddress,
  ]);

  /**
   * Get member information
   */
  const getMemberInfo = useCallback(
    async (memberAddress?: string) => {
      if (!accountId && !memberAddress) {
        throw new Error("No address provided");
      }

      const addressToQuery = memberAddress || accountId;

      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const contract = new ethers.Contract(
          convertToEvmAddress(contractAddress),
          AjoCoreABI.abi,
          provider
        );

        const result = await contract.getMemberInfo(
          convertToEvmAddress(addressToQuery!)
        );
        const rawMember = result[0];

        const member: MemberStruct = {
          queueNumber: rawMember.queueNumber.toString(),
          joinedCycle: rawMember.joinedCycle.toString(),
          totalPaid: rawMember.totalPaid.div(ONE_MILLION_BN).toString(),
          requiredCollateral: rawMember.requiredCollateral
            .div(ONE_MILLION_BN)
            .toString(),
          lockedCollateral: rawMember.lockedCollateral
            .div(ONE_MILLION_BN)
            .toString(),
          lastPaymentCycle: rawMember.lastPaymentCycle.toString(),
          defaultCount: rawMember.defaultCount.toString(),
          hasReceivedPayout: rawMember.hasReceivedPayout,
          isActive: rawMember.isActive,
          guarantor: rawMember.guarantor,
          preferredToken: rawMember.preferredToken,
          reputationScore: rawMember.reputationScore.toString(),
          pastPayments: Array.isArray(rawMember.pastPayments)
            ? rawMember.pastPayments.map((x: any) => x.toString())
            : [],
          guaranteePosition: rawMember.guaranteePosition.toString(),
          isHtsAssociated: rawMember.isHtsAssociated,
          isFrozen: rawMember.isFrozen,
        };

        const data: MemberInfoResponse = {
          memberInfo: member,
          pendingPenalty: result[1].toString(),
          effectiveVotingPower: result[2].toString(),
        };
        setMemberData(data);
        return data;
      } catch (error: any) {
        console.error("Get member info failed:", error);
        throw new Error(error.message || "Failed to get member info");
      }
    },
    [accountId, contractAddress]
  );

  /**
   * Get contract statistics
   */
  const getContractStats = useCallback(async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_JSON_RPC_URL || "https://testnet.hashio.io/api"
      );
      const contract = new ethers.Contract(
        convertToEvmAddress(contractAddress),
        AjoCoreABI.abi,
        provider
      );

      const stats = await contract.getContractStats();
      return {
        totalMembers: stats.totalMembers.toNumber(),
        activeMembers: stats.activeMembers.toNumber(),
        totalCollateralUSDC: ethers.utils.formatUnits(
          stats.totalCollateralUSDC,
          6
        ),
        totalCollateralHBAR: ethers.utils.formatUnits(
          stats.totalCollateralHBAR,
          8
        ),
        contractBalanceUSDC: ethers.utils.formatUnits(
          stats.contractBalanceUSDC,
          6
        ),
        contractBalanceHBAR: ethers.utils.formatUnits(
          stats.contractBalanceHBAR,
          8
        ),
        currentQueuePosition: stats.currentQueuePosition.toNumber(),
        activeToken: stats.activeToken,
        usesHtsTokens: stats._usesHtsTokens,
      };
    } catch (error: any) {
      console.error("Get contract stats failed:", error);
      throw new Error(error.message || "Failed to get contract stats");
    }
  }, [contractAddress]);

  /**
   * Get required collateral for joining
   */
  const getRequiredCollateral = useCallback(
    async (tokenChoice: PaymentToken) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_JSON_RPC_URL || "https://testnet.hashio.io/api"
        );
        const contract = new ethers.Contract(
          convertToEvmAddress(contractAddress),
          AjoCoreABI.abi,
          provider
        );

        const collateral = await contract.getRequiredCollateralForJoin(
          tokenChoice
        );
        console.log("Required collateral (raw):", collateral.toString());
        return ethers.utils.formatUnits(
          collateral,
          tokenChoice === PaymentToken.USDC ? 6 : 8
        );
      } catch (error: any) {
        console.error("Get required collateral failed:", error);
        throw new Error(error.message || "Failed to get required collateral");
      }
    },
    [contractAddress]
  );

  /**
   * Get Token configuration
   */
  const getTokenConfig = useCallback(
    async (token: number) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_JSON_RPC_URL || "https://testnet.hashio.io/api"
        );
        const contract = new ethers.Contract(
          convertToEvmAddress(contractAddress),
          AjoCoreABI.abi,
          provider
        );
        const tokenConfig = await contract.getTokenConfig(token);
        const formattedTokenConfig = {
          isActive: tokenConfig.isActive,
          monthlyPayment: tokenConfig.monthlyPayment.toString(),
        };
        return formattedTokenConfig;
      } catch (error: any) {
        console.error("Get token config failed:", error);
        throw new Error(error.message || "Failed to get token config");
      }
    },
    [contractAddress]
  );

  /**
   * Get Collateral demo
   */
  const getCollateralDemo = useCallback(
    async (participants: number, monthlyPayment: string) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_JSON_RPC_URL || "https://testnet.hashio.io/api"
        );
        const contract = new ethers.Contract(
          convertToEvmAddress(contractAddress),
          AjoCoreABI.abi,
          provider
        );
        const collateralDemo = await contract.getCollateralDemo(
          participants,
          monthlyPayment
        );
        const positions = Array.isArray(collateralDemo[0])
          ? collateralDemo[0].map((p: any) => p.toString())
          : [];
        const collaterals = Array.isArray(collateralDemo[1])
          ? collateralDemo[1].map((c: any) => c.toString())
          : [];
        return { positions, collaterals };
      } catch (error: any) {
        console.error("Get required collateral demo failed:", error);
        throw new Error(
          error.message || "Failed to get required collateral demo"
        );
      }
    },
    [contractAddress]
  );

  return {
    loading,
    joinAjo,
    processPayment,
    distributePayout,
    exitAjo,
    getMemberInfo,
    getTokenConfig,
    getContractStats,
    getCollateralDemo,
    getRequiredCollateral,
    isConnected: !!accountId,
    accountId,
  };
};
