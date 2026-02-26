import {
  DollarSign,
  ShieldCheckIcon,
  Users,
  Wallet,
} from "lucide-react";

interface AjoDetailsStatsGridProps {
  isVisible: boolean;
}

const AjoDetailsStatsGrid = ({ isVisible }: AjoDetailsStatsGridProps) => {
  // TODO: Integrate real data from Starknet contracts

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
          --
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
          --/--
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
          --
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
          --
        </div>
        <div className="text-sm text-muted-foreground">Current Cycle</div>
      </div>
    </div>
  );
};

export default AjoDetailsStatsGrid;
