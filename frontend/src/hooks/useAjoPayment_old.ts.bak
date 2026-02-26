/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { BigNumber, ethers } from "ethers";
import {
  ContractId,
  AccountAllowanceApproveTransaction,
  Client,
  TokenId,
  AccountId,
  TransactionId,
} from "@hashgraph/sdk";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";
import { dappConnector } from "@/services/wallets/walletconnect/walletConnectClient";
import { ContractFunctionParameterBuilder } from "@/services/wallets/contractFunctionParameterBuilder";
import AjoPaymentABI from "@/abi/ajoPayments.json";
import {
  usePaymentStore,
  type MembersPaymentStatus,
} from "@/store/ajoPaymentStore";
import { toast } from "sonner";

export type PaymentToken = 0 | 1;

export const PaymentToken = {
  USDC: 0,
  HBAR: 1,
} as const;

// Token addresses from environment
const USDC_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HBAR_TOKEN_ADDRESS = import.meta.env.VITE_MOCK_WHBAR_ADDRESS;

// ERC20 ABI for approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

const useAjoPayment = (ajoPaymentAddress: string) => {
  const { accountId, walletInterface } = useWalletInterface();
  const { setCycleConfig, setPaymentStatus } = usePaymentStore();
  const [loading, setLoading] = useState(false);

  // Helper to determine if using MetaMask
  const isMetaMask = accountId?.startsWith("0x");

  // Helper to check if an address is an HTS token
  const isHtsToken = (address: string): boolean => {
    if (!address.startsWith("0x")) return false;
    return address.toLowerCase().startsWith("0x" + "0".repeat(30));
  };

  // Helper to convert EVM address to Hedera
  const convertEvmToHederaAddress = useCallback(
    async (evmAddress: string): Promise<string> => {
      if (!evmAddress.startsWith("0x")) return evmAddress;

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

  // Helper to convert Hedera address to EVM
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
   * Approve token spending for payments contract
   */
  const approvePaymentToken = useCallback(
    async (tokenChoice: PaymentToken, amount?: string) => {
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
            ajoPaymentAddress,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          toast.success("Payment token approval successful!");
          return tx.hash;
        } else {
          // HashPack/WalletConnect: Use AccountAllowanceApproveTransaction for HTS
          const hederaPaymentsAddress = await convertEvmToHederaAddress(
            ajoPaymentAddress
          );
          const hederaTokenAddress = await convertEvmToHederaAddress(
            tokenAddress
          );

          // Convert approval amount to int64 (Hedera's max allowance)
          const MAX_INT64 = BigInt("9223372036854775807");
          const approvalBigInt = approvalAmount.toBigInt();
          const hederaAllowanceAmount =
            approvalBigInt > MAX_INT64 ? MAX_INT64 : approvalBigInt;

          console.log("Approving HTS token for payments:", hederaTokenAddress);
          console.log("For spender:", hederaPaymentsAddress);
          console.log("Amount:", hederaAllowanceAmount.toString());

          const signer = dappConnector.signers?.[0];
          if (!signer) {
            throw new Error("No signer available from wallet");
          }

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

          await approveTx.freezeWith(hederaClient);
          const txResponse = await approveTx.executeWithSigner(signer);
          const txId = txResponse.transactionId;

          console.log("✅ Payment token approved, tx ID:", txId.toString());
          toast.success("Payment token approval successful!");
          return txId.toString();
        }
      } catch (error: any) {
        console.error("Approve payment token failed:", error);
        toast.error("Payment token approval failed");
        throw new Error(error.message || "Failed to approve payment token");
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      isMetaMask,
      ajoPaymentAddress,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Check payment token allowance
   */
  const checkPaymentAllowance = useCallback(
    async (tokenChoice: PaymentToken) => {
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
    [accountId, ajoPaymentAddress]
  );

  /**
   * Process monthly payment
   * This pulls the payment from the member's account
   */
  const processPayment = useCallback(
    async (tokenChoice: PaymentToken = PaymentToken.USDC) => {
      if (!walletInterface || !accountId) {
        toast.error("Wallet not connected");
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
          AjoPaymentABI.abi,
          provider
        );

        const tokenConfig = await paymentContract.getTokenConfig(tokenChoice);
        const monthlyPayment = tokenConfig.monthlyPayment;
        const decimals = tokenChoice === PaymentToken.USDC ? 6 : 8;
        const monthlyPaymentFormatted = ethers.utils.formatUnits(
          monthlyPayment,
          decimals
        );

        console.log("💰 Monthly payment required:", monthlyPaymentFormatted);

        // Step 2: Check current allowance
        const { allowance, balance } = await checkPaymentAllowance(tokenChoice);

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
          toast.info("Approving payment token...");
          await approvePaymentToken(tokenChoice, monthlyPaymentFormatted);

          // Wait for approval to be confirmed
          console.log("⏳ Waiting for approval to confirm...");
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Verify approval
          const newAllowance = await checkPaymentAllowance(tokenChoice);
          console.log("✅ New allowance:", newAllowance.allowance);

          if (
            parseFloat(newAllowance.allowance) <
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
            ajoPaymentAddress,
            AjoPaymentABI.abi,
            signer
          );

          // Call processPayment with member address, amount, and token
          const tx = await contract.processPayment(
            accountId,
            monthlyPayment,
            tokenChoice,
            {
              gasLimit: ethers.utils.hexlify(2_000_000),
            }
          );
          const receipt = await tx.wait();
          toast.success("Payment processed successfully!");
          return receipt.transactionHash;
        } else {
          // HashPack/WalletConnect
          const hederaPaymentAddress = await convertEvmToHederaAddress(
            ajoPaymentAddress
          );
          const evmAccountId = convertToEvmAddress(accountId);

          console.log(
            "🎯 Processing payment on contract:",
            hederaPaymentAddress
          );
          console.log("👤 Member:", evmAccountId);
          console.log("💰 Amount:", monthlyPayment.toString());
          console.log("🪙 Token:", tokenChoice);

          const params = new ContractFunctionParameterBuilder()
            .addParam({
              type: "address",
              name: "member",
              value: evmAccountId,
            })
            .addParam({
              type: "uint256",
              name: "amount",
              value: monthlyPayment.toString(),
            })
            .addParam({
              type: "uint8",
              name: "token",
              value: tokenChoice,
            });

          const txId = await walletInterface.executeContractFunction(
            ContractId.fromString(hederaPaymentAddress),
            "processPayment",
            params,
            2_000_000
          );

          console.log("📝 Payment processed, tx ID:", txId?.toString());
          toast.success("Payment processed successfully!");
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

        toast.error(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [
      walletInterface,
      accountId,
      isMetaMask,
      ajoPaymentAddress,
      checkPaymentAllowance,
      approvePaymentToken,
      convertEvmToHederaAddress,
    ]
  );

  /**
   * Get Payout for a given cycle
   */
  const getPayOut = useCallback(
    async (cycle: number) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const ajoPaymentContract = new ethers.Contract(
          ajoPaymentAddress,
          AjoPaymentABI.abi,
          provider
        );
        const payout = await ajoPaymentContract.getPayout(cycle);
        setCycleConfig({
          recipient: payout.recipient,
          amount: ethers.utils.formatUnits(payout.amount, 6), // USDC has 6 decimals
          cycle: payout.cycle.toNumber(),
          timeStamp: new Date(payout.timestamp.toNumber() * 1000),
        });
        return {
          recipient: payout.recipient,
          amount: ethers.utils.formatUnits(payout.amount, 6),
          cycle: payout.cycle.toNumber(),
          timestamp: new Date(payout.timestamp.toNumber() * 1000),
        };
      } catch (err) {
        console.log("Error getting payout info:", err);
      }
    },
    [ajoPaymentAddress]
  );

  /**
   * Get current cycle
   */
  const getCurrentCycle = useCallback(async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
          "https://testnet.hashio.io/api"
      );
      const ajoPaymentContract = new ethers.Contract(
        ajoPaymentAddress,
        AjoPaymentABI.abi,
        provider
      );
      const currentCycle: BigNumber =
        await ajoPaymentContract.getCurrentCycle();
      return currentCycle.toNumber();
    } catch (err) {
      console.log("Error getting current cycle:", err);
    }
  }, [ajoPaymentAddress]);

  /**
   * Check if member needs to pay this cycle
   */
  const needsToPayThisCycle = useCallback(
    async (memberAddress: string) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const ajoPaymentContract = new ethers.Contract(
          ajoPaymentAddress,
          AjoPaymentABI.abi,
          provider
        );
        const needsToPay = await ajoPaymentContract.needsToPayThisCycle(
          convertToEvmAddress(memberAddress)
        );
        return needsToPay;
      } catch (err) {
        console.log("Error checking payment status:", err);
        return false;
      }
    },
    [ajoPaymentAddress]
  );

  /**
   * Get cycle payment status
   */
  const getCyclePaymentStatus = useCallback(
    async (cycle: number) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
            "https://testnet.hashio.io/api"
        );
        const ajoPaymentContract = new ethers.Contract(
          ajoPaymentAddress,
          AjoPaymentABI.abi,
          provider
        );
        const value = await ajoPaymentContract.getCyclePaymentStatus(cycle);
        setPaymentStatus(value);
        console.log("Cycle payment status value:", value);
        const memberPaymentStatus: MembersPaymentStatus = {
          paidMembers: value.paidMembers || [],
          unpaidMembers: value.unpaidMembers || [],
          totalCollected: value.totalCollected?.toString() || "0",
        };
        return memberPaymentStatus;
      } catch (err) {
        console.log("Error getting cycle payment status:", err);
      }
    },
    [ajoPaymentAddress]
  );

  /**
   * Get current cycle dashboard
   */
  const getCurrentCycleDashboard = useCallback(async () => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        import.meta.env.VITE_HEDERA_JSON_RPC_RELAY_URL ||
          "https://testnet.hashio.io/api"
      );
      const ajoPaymentContract = new ethers.Contract(
        ajoPaymentAddress,
        AjoPaymentABI.abi,
        provider
      );
      const dashboard = await ajoPaymentContract.getCurrentCycleDashboard();
      const cycleDashboard = {
        currentCycle: dashboard.currentCycle.toString(),
        nextPayoutPosition: dashboard.nextPayoutPosition.toString(),
        nextRecipient: dashboard.nextRecipient,
        expectedPayout: dashboard.expectedPayout.toString(),
        totalPaidThisCycle: dashboard.totalPaidThisCycle.toString(),
        remainingToPay: dashboard.remainingToPay.toString(),
        membersPaid: dashboard.membersPaid,
        membersUnpaid: dashboard.membersUnpaid,
        isPayoutReady: dashboard.isPayoutReady,
        hasScheduledPayment: dashboard.hasScheduledPayment,
        scheduledPaymentAddress: dashboard.scheduledPaymentAddress,
      };
      // console.log("Cycle Dashboard:", cycleDashboard);
      return cycleDashboard;
    } catch (err) {
      console.log("Error getting cycle dashboard :", err);
    }
  }, []);

  return {
    loading,
    processPayment,
    approvePaymentToken,
    checkPaymentAllowance,
    getPayOut,
    getCurrentCycle,
    needsToPayThisCycle,
    getCyclePaymentStatus,
    getCurrentCycleDashboard,
  };
};

export default useAjoPayment;
