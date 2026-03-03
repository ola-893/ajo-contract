import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  History,
  RefreshCw,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import useStarknetAjoPayments from '@/hooks/useStarknetAjoPayments';
import { useStarknetWallet } from '@/contexts/StarknetWalletContext';
import { formatAddress } from '@/utils/utils';

const formatTokenAmount = (value: bigint, decimals: number) => {
  if (value === 0n) return '0';
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return `${whole.toString()}.${fractionStr}`;
};

const AjoPaymentHistory = ({
  ajo,
}: {
  ajo: any;
}) => {
  const { address, isConnected } = useStarknetWallet();
  const paymentsAddress = ajo?.paymentsAddress || '';
  const tokenSymbol = ajo?.config?.paymentToken || 'USDC';
  const tokenDecimals = tokenSymbol === 'BTC' ? 8 : 6;
  const monthlyContributionRaw = BigInt(ajo?.config?.monthlyContribution ?? 0);

  const {
    getCurrentCycle,
    getCycleStartTime,
    getNextPayoutPosition,
    hasPaidForCycle,
    getTotalPaid,
    getCycleContributions,
    getPayoutRecipient,
    calculatePayoutAmount,
    makePayment,
    distributePayout,
    advanceCycle,
    loading,
  } = useStarknetAjoPayments(paymentsAddress);

  const [loadingData, setLoadingData] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [cycleStartTime, setCycleStartTime] = useState(0);
  const [nextPayoutPosition, setNextPayoutPosition] = useState(1);
  const [cycleContributions, setCycleContributions] = useState<bigint>(0n);
  const [payoutAmount, setPayoutAmount] = useState<bigint>(0n);
  const [payoutRecipient, setPayoutRecipient] = useState('0x0');
  const [hasPaidCurrentCycle, setHasPaidCurrentCycle] = useState(false);
  const [totalPaid, setTotalPaid] = useState<bigint>(0n);

  const refreshPayments = useCallback(async () => {
    if (!paymentsAddress || /^0x0+$/i.test(paymentsAddress)) return;

    setLoadingData(true);
    try {
      const cycle = await getCurrentCycle();
      setCurrentCycle(cycle || 1);

      const [startTime, payoutPos, contributions, payout, recipient] =
        await Promise.all([
          getCycleStartTime().catch(() => 0),
          getNextPayoutPosition().catch(() => 1),
          getCycleContributions(cycle || 1).catch(() => 0n),
          calculatePayoutAmount(cycle || 1).catch(() => 0n),
          getPayoutRecipient(cycle || 1).catch(() => '0x0'),
        ]);

      setCycleStartTime(startTime);
      setNextPayoutPosition(payoutPos);
      setCycleContributions(contributions);
      setPayoutAmount(payout);
      setPayoutRecipient(recipient);

      if (address) {
        const [paidThisCycle, total] = await Promise.all([
          hasPaidForCycle(address, cycle || 1).catch(() => false),
          getTotalPaid(address).catch(() => 0n),
        ]);
        setHasPaidCurrentCycle(paidThisCycle);
        setTotalPaid(total);
      }
    } catch (error) {
      console.error('Failed to refresh payments:', error);
      toast.error('Failed to load payment data');
    } finally {
      setLoadingData(false);
    }
  }, [
    paymentsAddress,
    getCurrentCycle,
    getCycleStartTime,
    getNextPayoutPosition,
    getCycleContributions,
    calculatePayoutAmount,
    getPayoutRecipient,
    address,
    hasPaidForCycle,
    getTotalPaid,
  ]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const handlePayCurrentCycle = async () => {
    if (!isConnected || !address) {
      toast.error('Connect wallet to make payment');
      return;
    }

    try {
      await makePayment(currentCycle, monthlyContributionRaw.toString());
      toast.success('Payment submitted');
      await refreshPayments();
    } catch (error: any) {
      console.error('Payment failed:', error);
      toast.error(error?.message || 'Payment failed');
    }
  };

  const handleDistributePayout = async () => {
    if (!isConnected || !address) {
      toast.error('Connect wallet to distribute payout');
      return;
    }

    if (!payoutRecipient || /^0x0+$/i.test(payoutRecipient)) {
      toast.error('Payout recipient not available');
      return;
    }

    try {
      await distributePayout(currentCycle, payoutRecipient);
      toast.success('Payout distributed');
      await refreshPayments();
    } catch (error: any) {
      console.error('Distribute payout failed:', error);
      toast.error(error?.message || 'Failed to distribute payout');
    }
  };

  const handleAdvanceCycle = async () => {
    if (!isConnected || !address) {
      toast.error('Connect wallet to advance cycle');
      return;
    }

    try {
      await advanceCycle();
      toast.success('Cycle advanced');
      await refreshPayments();
    } catch (error: any) {
      console.error('Advance cycle failed:', error);
      toast.error(error?.message || 'Failed to advance cycle');
    }
  };

  const successRate = useMemo(() => {
    const expected = monthlyContributionRaw * BigInt(ajo?.config?.totalParticipants ?? 0);
    if (expected === 0n) return 0;
    return Number((cycleContributions * 100n) / expected);
  }, [cycleContributions, monthlyContributionRaw, ajo?.config?.totalParticipants]);

  if (!paymentsAddress || /^0x0+$/i.test(paymentsAddress)) {
    return (
      <div className='bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4'>
        <History className='w-12 h-12 mx-auto mb-2 opacity-50' />
        <p>Payments contract not initialized yet.</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-xl font-bold text-card-foreground flex items-center space-x-2'>
            <History className='w-6 h-6 text-accent' />
            <span>Payment History</span>
          </h3>
          <button
            onClick={refreshPayments}
            className='px-3 py-2 rounded-md border border-border hover:bg-primary/10 text-sm flex items-center gap-2'
            disabled={loadingData}
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='border border-border rounded-lg p-4 bg-background/20'>
            <p className='text-xs text-muted-foreground'>Current Cycle</p>
            <p className='text-lg font-semibold text-card-foreground mt-1'>
              {currentCycle}
            </p>
            <p className='text-xs text-muted-foreground mt-2'>
              Started:{' '}
              {cycleStartTime > 0
                ? new Date(cycleStartTime * 1000).toLocaleString()
                : 'N/A'}
            </p>
          </div>
          <div className='border border-border rounded-lg p-4 bg-background/20'>
            <p className='text-xs text-muted-foreground'>Next Payout</p>
            <p className='text-lg font-semibold text-card-foreground mt-1'>
              Position #{nextPayoutPosition}
            </p>
            <p className='text-xs text-muted-foreground mt-2'>
              Recipient: {formatAddress(payoutRecipient)}
            </p>
          </div>
        </div>

        <div className='mt-5 border border-border rounded-lg p-4 bg-background/20'>
          <h4 className='font-semibold text-card-foreground mb-3'>Actions</h4>
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={handlePayCurrentCycle}
              disabled={loading || loadingData || hasPaidCurrentCycle}
              className='px-3 py-2 rounded-md text-xs border border-primary text-primary hover:bg-primary/10 disabled:opacity-40'
            >
              {hasPaidCurrentCycle
                ? 'Paid This Cycle'
                : `Pay ${formatTokenAmount(monthlyContributionRaw, tokenDecimals)} ${tokenSymbol}`}
            </button>
            <button
              onClick={handleDistributePayout}
              disabled={loading || loadingData}
              className='px-3 py-2 rounded-md text-xs border border-green-600 text-green-500 hover:bg-green-600/10 disabled:opacity-40'
            >
              Distribute Payout
            </button>
            <button
              onClick={handleAdvanceCycle}
              disabled={loading || loadingData}
              className='px-3 py-2 rounded-md text-xs border border-border text-muted-foreground hover:bg-background disabled:opacity-40'
            >
              Advance Cycle
            </button>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
          <div className='flex items-center justify-between mb-4'>
            <h4 className='font-semibold text-card-foreground'>Cycle Contributions</h4>
            <TrendingUp className='w-5 h-5 text-green-500' />
          </div>
          <div className='text-2xl font-bold text-primary'>
            {formatTokenAmount(cycleContributions, tokenDecimals)} {tokenSymbol}
          </div>
          <div className='text-sm text-muted-foreground'>Current cycle inflow</div>
        </div>

        <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
          <div className='flex items-center justify-between mb-4'>
            <h4 className='font-semibold text-card-foreground'>Payout Amount</h4>
            <Zap className='w-5 h-5 text-accent' />
          </div>
          <div className='text-2xl font-bold text-card-foreground'>
            {formatTokenAmount(payoutAmount, tokenDecimals)} {tokenSymbol}
          </div>
          <div className='text-sm text-muted-foreground'>Expected distribution</div>
        </div>

        <div className='bg-card rounded-xl shadow-lg p-6 border border-border'>
          <div className='flex items-center justify-between mb-4'>
            <h4 className='font-semibold text-card-foreground'>Your Total Paid</h4>
            <Wallet className='w-5 h-5 text-primary' />
          </div>
          <div className='text-2xl font-bold text-green-500'>
            {formatTokenAmount(totalPaid, tokenDecimals)} {tokenSymbol}
          </div>
          <div className='text-sm text-muted-foreground flex items-center gap-2'>
            <CheckCircle className='w-4 h-4' />
            Cycle success rate: {Math.max(0, Math.min(100, successRate))}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoPaymentHistory;
