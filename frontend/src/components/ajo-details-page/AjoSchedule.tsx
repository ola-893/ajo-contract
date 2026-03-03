import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, Play, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import useStarknetAjoSchedule, {
  type ScheduleTypeName,
  type ScheduledTaskView,
} from '@/hooks/useStarknetAjoSchedule';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { formatAddress } from '@/utils/utils';

const formatDateTimeLocal = (timestampSeconds: number) => {
  if (!timestampSeconds || timestampSeconds <= 0) return '';
  const date = new Date(timestampSeconds * 1000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const toUnixSeconds = (datetimeLocal: string) => {
  const date = new Date(datetimeLocal);
  return Math.floor(date.getTime() / 1000);
};

const SCHEDULE_TYPES: ScheduleTypeName[] = [
  'Payment',
  'Payout',
  'CycleStart',
  'CycleEnd',
  'CollateralCheck',
];

const AjoSchedule = ({
  ajo,
  currentCycle = 1,
}: {
  ajo: any;
  currentCycle?: number;
}) => {
  const { isConnected } = useStarknetWallet();
  const scheduleAddress = ajo?.scheduleAddress || '';

  const {
    getPendingTasks,
    getNextExecutionTime,
    scheduleTask,
    executeTask,
    cancelTask,
    scheduleCyclePayments,
    schedulePayout,
    loading,
  } = useStarknetAjoSchedule(scheduleAddress);

  const [loadingData, setLoadingData] = useState(false);
  const [tasks, setTasks] = useState<ScheduledTaskView[]>([]);
  const [nextExecutionTime, setNextExecutionTime] = useState(0);

  const [scheduleType, setScheduleType] = useState<ScheduleTypeName>('Payment');
  const [executionTime, setExecutionTime] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [calldata, setCalldata] = useState<string>('0');

  const [taskIdInput, setTaskIdInput] = useState('');

  const [cycleForBatch, setCycleForBatch] = useState(String(currentCycle || 1));
  const [batchStartTime, setBatchStartTime] = useState('');
  const [payoutRecipient, setPayoutRecipient] = useState('');
  const [payoutTime, setPayoutTime] = useState('');

  useEffect(() => {
    if (!executionTime) {
      const inOneHour = Math.floor(Date.now() / 1000) + 3600;
      setExecutionTime(formatDateTimeLocal(inOneHour));
    }
    if (!batchStartTime) {
      const inOneHour = Math.floor(Date.now() / 1000) + 3600;
      setBatchStartTime(formatDateTimeLocal(inOneHour));
    }
    if (!payoutTime) {
      const inTwoHours = Math.floor(Date.now() / 1000) + 7200;
      setPayoutTime(formatDateTimeLocal(inTwoHours));
    }
  }, [executionTime, batchStartTime, payoutTime]);

  useEffect(() => {
    if (scheduleType === 'Payment' || scheduleType === 'Payout') {
      setTarget(ajo?.coreAddress || '');
      setCalldata(String(currentCycle || 1));
      return;
    }

    if (scheduleType === 'CycleStart' || scheduleType === 'CycleEnd') {
      setTarget(ajo?.paymentsAddress || '');
      setCalldata(String(currentCycle || 1));
      return;
    }

    setTarget(ajo?.coreAddress || '');
    setCalldata('0');
  }, [scheduleType, ajo?.coreAddress, ajo?.paymentsAddress, currentCycle]);

  const refreshSchedule = useCallback(async () => {
    if (!scheduleAddress || /^0x0+$/i.test(scheduleAddress)) return;

    setLoadingData(true);
    try {
      const [pending, nextTime] = await Promise.all([
        getPendingTasks(),
        getNextExecutionTime().catch(() => 0),
      ]);

      setTasks(pending.sort((a, b) => a.executionTime - b.executionTime));
      setNextExecutionTime(nextTime);
    } catch (error) {
      console.error('Failed to refresh schedule:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoadingData(false);
    }
  }, [scheduleAddress, getPendingTasks, getNextExecutionTime]);

  useEffect(() => {
    refreshSchedule();
  }, [refreshSchedule]);

  const handleScheduleTask = async () => {
    if (!isConnected) {
      toast.error('Connect wallet to schedule tasks');
      return;
    }

    if (!target || /^0x0+$/i.test(target)) {
      toast.error('Target address is required');
      return;
    }

    const execution = toUnixSeconds(executionTime);
    if (!execution || execution <= Math.floor(Date.now() / 1000)) {
      toast.error('Execution time must be in the future');
      return;
    }

    try {
      await scheduleTask(scheduleType, execution, target, calldata || '0');
      toast.success('Task scheduled');
      await refreshSchedule();
    } catch (error: any) {
      console.error('Scheduling task failed:', error);
      toast.error(error?.message || 'Failed to schedule task');
    }
  };

  const handleExecuteTask = async () => {
    const id = Number(taskIdInput);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Enter a valid task ID');
      return;
    }

    try {
      await executeTask(id);
      toast.success('Task executed');
      await refreshSchedule();
    } catch (error: any) {
      console.error('Execute task failed:', error);
      toast.error(error?.message || 'Failed to execute task');
    }
  };

  const handleCancelTask = async (taskId: number) => {
    try {
      await cancelTask(taskId);
      toast.success('Task cancelled');
      await refreshSchedule();
    } catch (error: any) {
      console.error('Cancel task failed:', error);
      toast.error(error?.message || 'Failed to cancel task');
    }
  };

  const handleScheduleCyclePayments = async () => {
    if (!isConnected) {
      toast.error('Connect wallet to schedule cycle payments');
      return;
    }

    const cycle = Number(cycleForBatch);
    const startTime = toUnixSeconds(batchStartTime);

    if (!Number.isFinite(cycle) || cycle <= 0) {
      toast.error('Enter a valid cycle number');
      return;
    }

    if (!startTime || startTime <= Math.floor(Date.now() / 1000)) {
      toast.error('Start time must be in the future');
      return;
    }

    try {
      await scheduleCyclePayments(cycle, startTime);
      toast.success('Cycle payment schedule created');
      await refreshSchedule();
    } catch (error: any) {
      console.error('Schedule cycle payments failed:', error);
      toast.error(error?.message || 'Failed to schedule cycle payments');
    }
  };

  const handleSchedulePayout = async () => {
    if (!isConnected) {
      toast.error('Connect wallet to schedule payout');
      return;
    }

    const cycle = Number(cycleForBatch);
    const execution = toUnixSeconds(payoutTime);

    if (!Number.isFinite(cycle) || cycle <= 0) {
      toast.error('Enter a valid cycle number');
      return;
    }

    if (!payoutRecipient || /^0x0+$/i.test(payoutRecipient)) {
      toast.error('Recipient address is required');
      return;
    }

    if (!execution || execution <= Math.floor(Date.now() / 1000)) {
      toast.error('Payout time must be in the future');
      return;
    }

    try {
      await schedulePayout(cycle, payoutRecipient, execution);
      toast.success('Payout schedule created');
      await refreshSchedule();
    } catch (error: any) {
      console.error('Schedule payout failed:', error);
      toast.error(error?.message || 'Failed to schedule payout');
    }
  };

  const nextExecutionText = useMemo(() => {
    if (!nextExecutionTime || nextExecutionTime <= 0) return 'No scheduled tasks';
    return new Date(nextExecutionTime * 1000).toLocaleString();
  }, [nextExecutionTime]);

  if (!scheduleAddress || /^0x0+$/i.test(scheduleAddress)) {
    return (
      <div className='bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4'>
        <CalendarClock className='w-12 h-12 mx-auto mb-2 opacity-50' />
        <p>Schedule contract not initialized yet.</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-xl font-bold text-card-foreground flex items-center space-x-2'>
            <CalendarClock className='w-6 h-6 text-primary' />
            <span>Automation & Scheduling</span>
          </h3>
          <button
            onClick={refreshSchedule}
            className='px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm flex items-center gap-2'
            disabled={loadingData}
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className='border border-border rounded-lg p-4 bg-background/20 mb-5'>
          <p className='text-xs text-muted-foreground'>Next execution time</p>
          <p className='text-lg font-semibold text-card-foreground mt-1 flex items-center gap-2'>
            <Clock3 className='w-4 h-4 text-accent' />
            {nextExecutionText}
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <div className='border border-border rounded-lg p-4 bg-background/20 space-y-3'>
            <h4 className='font-semibold text-card-foreground'>Schedule Generic Task</h4>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleTypeName)}
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            >
              {SCHEDULE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type='datetime-local'
              value={executionTime}
              onChange={(e) => setExecutionTime(e.target.value)}
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder='Target contract address'
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <input
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
              placeholder='Calldata (felt252)'
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <button
              onClick={handleScheduleTask}
              disabled={loading || !isConnected}
              className='bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50'
            >
              Schedule Task
            </button>
          </div>

          <div className='border border-border rounded-lg p-4 bg-background/20 space-y-3'>
            <h4 className='font-semibold text-card-foreground'>Core Scheduling Helpers</h4>
            <input
              value={cycleForBatch}
              onChange={(e) => setCycleForBatch(e.target.value)}
              placeholder='Cycle number'
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <input
              type='datetime-local'
              value={batchStartTime}
              onChange={(e) => setBatchStartTime(e.target.value)}
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <button
              onClick={handleScheduleCyclePayments}
              disabled={loading || !isConnected}
              className='w-full border border-primary text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/10 disabled:opacity-50'
            >
              Schedule Cycle Payments
            </button>

            <input
              value={payoutRecipient}
              onChange={(e) => setPayoutRecipient(e.target.value)}
              placeholder='Payout recipient address'
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <input
              type='datetime-local'
              value={payoutTime}
              onChange={(e) => setPayoutTime(e.target.value)}
              className='w-full bg-background border border-border rounded-md px-3 py-2 text-sm'
            />
            <button
              onClick={handleSchedulePayout}
              disabled={loading || !isConnected}
              className='w-full border border-primary text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/10 disabled:opacity-50'
            >
              Schedule Payout
            </button>
            <p className='text-xs text-muted-foreground'>
              Note: helper functions are core-authorized and may fail for non-owner users.
            </p>
          </div>
        </div>
      </div>

      <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
        <h4 className='font-semibold text-card-foreground mb-4'>Pending/Ready Tasks</h4>

        <div className='mb-4 flex flex-col sm:flex-row gap-2'>
          <input
            value={taskIdInput}
            onChange={(e) => setTaskIdInput(e.target.value)}
            placeholder='Task ID'
            className='w-full sm:max-w-[140px] bg-background border border-border rounded-md px-3 py-2 text-sm'
          />
          <button
            onClick={handleExecuteTask}
            disabled={loading || !isConnected}
            className='px-3 py-2 rounded-md text-xs border border-green-600 text-green-500 hover:bg-green-600/10 disabled:opacity-40 flex items-center gap-2'
          >
            <Play className='w-3 h-3' /> Execute by ID
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className='text-sm text-muted-foreground py-3'>No pending tasks.</div>
        ) : (
          <div className='space-y-3'>
            {tasks.map((task) => (
              <div
                key={task.id}
                className='border border-border rounded-lg p-4 bg-background/20'
              >
                <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                  <div>
                    <p className='font-semibold text-card-foreground'>
                      Task #{task.id} • {task.scheduleType}
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Executes: {new Date(task.executionTime * 1000).toLocaleString()}
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Target: {formatAddress(task.target)}
                    </p>
                  </div>
                  <div className='flex gap-2 flex-wrap'>
                    <button
                      onClick={() => setTaskIdInput(String(task.id))}
                      className='px-3 py-2 rounded-md text-xs border border-primary text-primary hover:bg-primary/10'
                    >
                      Load ID
                    </button>
                    <button
                      onClick={() => handleCancelTask(task.id)}
                      disabled={loading || !isConnected}
                      className='px-3 py-2 rounded-md text-xs border border-red-600 text-red-500 hover:bg-red-600/10 disabled:opacity-40 flex items-center gap-1'
                    >
                      <XCircle className='w-3 h-3' /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AjoSchedule;
