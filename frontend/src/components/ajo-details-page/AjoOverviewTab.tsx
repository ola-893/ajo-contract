import { Calendar, DollarSign, Shield, TrendingUp, Users, Database } from "lucide-react";

const AjoOverviewTab = ({ ajo }: { ajo: any }) => {
  // TODO: Integrate real data from Starknet contracts

  return (
    <div className="space-y-6">
      {/* Main Stats - Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">Total Pool</h4>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-primary">--</div>
          <div className="text-sm text-muted-foreground mt-2">Coming soon</div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Active Members
            </h4>
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div className="text-3xl font-bold text-card-foreground">--</div>
          <div className="text-sm text-muted-foreground mt-2">Coming soon</div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Current Cycle
            </h4>
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-500">--</div>
          <div className="text-sm text-muted-foreground mt-2">Coming soon</div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">Status</h4>
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="text-3xl font-bold text-accent">--</div>
          <div className="text-sm text-muted-foreground mt-2">Coming soon</div>
        </div>
      </div>

      {/* Details Placeholder */}
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <h3 className="text-xl font-bold text-card-foreground mb-6">
          Ajo Details
        </h3>
        <div className="text-center py-8 text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">Ajo details coming soon</p>
          <p className="text-sm">
            View cycle duration, payments, and payout schedule
          </p>
        </div>
      </div>
    </div>
  );
};

export default AjoOverviewTab;
