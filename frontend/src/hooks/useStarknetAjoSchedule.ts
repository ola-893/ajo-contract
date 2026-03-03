/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { CairoCustomEnum, Contract, RpcProvider, cairo } from 'starknet';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { ajoScheduleAbi } from '@/abi/placeholders';

const RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL ||
  'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/W7Jx4ZJo0o9FaoLXaNRG4';

const toBigIntValue = (value: any): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    if (!value.trim()) return 0n;
    return BigInt(value);
  }
  if (typeof value === 'object' && 'low' in value) {
    const low = BigInt((value as any).low ?? 0);
    const high = BigInt((value as any).high ?? 0);
    return low + (high << 128n);
  }
  if (typeof value?.toString === 'function') {
    const text = value.toString();
    if (!text || text === '[object Object]') return 0n;
    return BigInt(text);
  }
  return 0n;
};

const toBool = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value === 'true';
  if (typeof value === 'object' && value !== null) {
    if ('True' in value || 'true' in value) return true;
    if ('False' in value || 'false' in value) return false;
  }
  return toBigIntValue(value) === 1n;
};

const toAddress = (value: any): string => {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) return value.toLowerCase();
    try {
      return `0x${BigInt(value).toString(16)}`;
    } catch {
      return value;
    }
  }
  return `0x${toBigIntValue(value).toString(16)}`;
};

const parseEnum = (value: any, fallback: string): string => {
  if (!value || typeof value !== 'object') return fallback;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys[0] : fallback;
};

const extractSpanValues = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.snapshot)) return value.snapshot;
  if (Array.isArray(value?.[0])) return value[0];
  return [];
};

export type ScheduleTypeName =
  | 'Payment'
  | 'Payout'
  | 'CycleStart'
  | 'CycleEnd'
  | 'CollateralCheck';

const buildScheduleTypeEnum = (type: ScheduleTypeName) =>
  new CairoCustomEnum({ [type]: {} });

export interface ScheduledTaskView {
  id: number;
  scheduleType: string;
  executionTime: number;
  target: string;
  calldata: string;
  isExecuted: boolean;
  isCancelled: boolean;
}

const normalizeTask = (raw: any): ScheduledTaskView => ({
  id: Number(toBigIntValue(raw?.id)),
  scheduleType: parseEnum(raw?.schedule_type, 'Unknown'),
  executionTime: Number(raw?.execution_time ?? 0),
  target: toAddress(raw?.target),
  calldata: String(raw?.calldata ?? '0'),
  isExecuted: toBool(raw?.is_executed),
  isCancelled: toBool(raw?.is_cancelled),
});

const useStarknetAjoSchedule = (ajoScheduleAddress: string) => {
  const { account, isConnected } = useStarknetWallet();
  const [loading, setLoading] = useState(false);

  const getProvider = () =>
    new RpcProvider({
      nodeUrl: RPC_URL,
    });

  const getAuthorizedCore = useCallback(async (): Promise<string> => {
    if (!ajoScheduleAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const scheduleContract = new Contract(
      ajoScheduleAbi as any,
      ajoScheduleAddress,
      provider,
    );

    const coreAddress = await scheduleContract.get_authorized_core();
    return toAddress(coreAddress);
  }, [ajoScheduleAddress]);

  const setAuthorizedCore = useCallback(
    async (coreAddress: string) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const tx = await scheduleContract.set_authorized_core(coreAddress);
        await provider.waitForTransaction(tx.transaction_hash);

        return {
          transactionHash: tx.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error setting authorized core:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const scheduleTask = useCallback(
    async (
      scheduleType: ScheduleTypeName,
      executionTime: number,
      target: string,
      calldata: string,
    ) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const scheduleTypeEnum = buildScheduleTypeEnum(scheduleType);
        const result = await scheduleContract.schedule_task(
          scheduleTypeEnum,
          executionTime,
          target,
          calldata,
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error scheduling task:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const executeTask = useCallback(
    async (taskId: number) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const taskIdU256 = cairo.uint256(taskId);
        const result = await scheduleContract.execute_task(taskIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error executing task:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const cancelTask = useCallback(
    async (taskId: number) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const taskIdU256 = cairo.uint256(taskId);
        const result = await scheduleContract.cancel_task(taskIdU256);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error cancelling task:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const scheduleCyclePayments = useCallback(
    async (cycle: number, startTime: number) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);
        const result = await scheduleContract.schedule_cycle_payments(
          cycleU256,
          startTime,
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error scheduling cycle payments:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const schedulePayout = useCallback(
    async (cycle: number, recipient: string, payoutTime: number) => {
      if (!account || !isConnected || !ajoScheduleAddress) {
        throw new Error('Wallet not connected or contract address not available');
      }

      setLoading(true);
      try {
        const provider = getProvider();
        const scheduleContract = new Contract(
          ajoScheduleAbi as any,
          ajoScheduleAddress,
          provider,
        );

        scheduleContract.connect(account as any);

        const cycleU256 = cairo.uint256(cycle);
        const result = await scheduleContract.schedule_payout(
          cycleU256,
          recipient,
          payoutTime,
        );
        await provider.waitForTransaction(result.transaction_hash);

        return {
          transactionHash: result.transaction_hash,
          success: true,
        };
      } catch (error) {
        console.error('Error scheduling payout:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [account, isConnected, ajoScheduleAddress],
  );

  const getTask = useCallback(
    async (taskId: number): Promise<ScheduledTaskView> => {
      if (!ajoScheduleAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const scheduleContract = new Contract(
        ajoScheduleAbi as any,
        ajoScheduleAddress,
        provider,
      );

      const taskIdU256 = cairo.uint256(taskId);
      const result = await scheduleContract.get_task(taskIdU256);
      return normalizeTask(result);
    },
    [ajoScheduleAddress],
  );

  const getPendingTasks = useCallback(async (): Promise<ScheduledTaskView[]> => {
    if (!ajoScheduleAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const scheduleContract = new Contract(
      ajoScheduleAbi as any,
      ajoScheduleAddress,
      provider,
    );

    const result = await scheduleContract.get_pending_tasks();
    return extractSpanValues(result).map(normalizeTask);
  }, [ajoScheduleAddress]);

  const isTaskReady = useCallback(
    async (taskId: number): Promise<boolean> => {
      if (!ajoScheduleAddress) {
        throw new Error('Contract address not available');
      }

      const provider = getProvider();
      const scheduleContract = new Contract(
        ajoScheduleAbi as any,
        ajoScheduleAddress,
        provider,
      );

      const taskIdU256 = cairo.uint256(taskId);
      const result = await scheduleContract.is_task_ready(taskIdU256);
      return toBool(result);
    },
    [ajoScheduleAddress],
  );

  const getNextExecutionTime = useCallback(async (): Promise<number> => {
    if (!ajoScheduleAddress) {
      throw new Error('Contract address not available');
    }

    const provider = getProvider();
    const scheduleContract = new Contract(
      ajoScheduleAbi as any,
      ajoScheduleAddress,
      provider,
    );

    const result = await scheduleContract.get_next_execution_time();
    return Number(result ?? 0);
  }, [ajoScheduleAddress]);

  return {
    // View functions
    getAuthorizedCore,
    getTask,
    getPendingTasks,
    isTaskReady,
    getNextExecutionTime,

    // Write functions
    setAuthorizedCore,
    scheduleTask,
    executeTask,
    cancelTask,
    scheduleCyclePayments,
    schedulePayout,

    // State
    loading,
  };
};

export default useStarknetAjoSchedule;
