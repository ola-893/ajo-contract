import {
  CheckCircle,
  Download,
  History,
  Database,
  TrendingUp,
  Zap,
} from "lucide-react";

const AjoPaymentHistory = () => {
  // TODO: Integrate useStarknetAjoPayments when contract addresses are available
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-card-foreground flex items-center space-x-2">
            <History className="w-6 h-6 text-accent" />
            <span>Payment History</span>
          </h3>
        </div>

        {/* Placeholder */}
        <div className="text-center py-8 text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">Payment history coming soon</p>
          <p className="text-sm">
            Track all contributions and payouts on-chain
          </p>
        </div>
      </div>

      {/* Payment Statistics Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Total Paid Out
            </h4>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-primary">--</div>
          <div className="text-sm text-muted-foreground">Coming soon</div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Current Cycle
            </h4>
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div className="text-2xl font-bold text-card-foreground">--</div>
          <div className="text-sm text-muted-foreground">
            Coming soon
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">Success Rate</h4>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-500">--</div>
          <div className="text-sm text-muted-foreground">
            Coming soon
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoPaymentHistory;
