import {
  DollarSign,
  ShieldCheckIcon,
  Users,
  Wallet,
} from "lucide-react";

interface AjoDetailsStatsGridProps {
  isVisible: boolean;
  monthlyPayment?: number | null;
  memberCount?: number;
  totalParticipants?: number;
}

const AjoDetailsStatsGrid = ({
  isVisible,
  monthlyPayment = null,
  memberCount = 0,
  totalParticipants = 10,
}: AjoDetailsStatsGridProps) => {
  const paymentAmount =
    monthlyPayment !== null && monthlyPayment !== undefined
      ? `$${monthlyPayment.toFixed(2)}`
      : "$1.00";

  const poolValue =
    monthlyPayment !== null && monthlyPayment !== undefined
      ? `$${(monthlyPayment * totalParticipants).toFixed(2)}`
      : "$0.00";

  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 transform transition-all duration-1000 delay-200 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <DollarSign className="w-3 h-3 md:w-6 md:h-6 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Monthly</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {paymentAmount}
        </div>
        <div className="text-sm text-muted-foreground">Payment Amount</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <Users className="w-3 h-3 md:w-6 md:h-6 text-accent" />
          </div>
          <span className="text-xs text-muted-foreground">Progress</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {memberCount}/{totalParticipants}
        </div>
        <div className="text-sm text-muted-foreground">Members</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <Wallet className="w-3 h-3 md:w-6 md:h-6  text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          {poolValue}
        </div>
        <div className="text-sm text-muted-foreground">Pool Value</div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-6 md:w-10 md:h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <ShieldCheckIcon className="w-3 h-3 md:w-6 md:h-6 text-accent" />
          </div>
        </div>
        <div className="text-lg md:text-2xl font-bold text-card-foreground">
          0x0000...0000
        </div>
        <div className="text-sm text-muted-foreground">Guarantor address</div>
      </div>
    </div>
  );
};

export default AjoDetailsStatsGrid;
