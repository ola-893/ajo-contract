import { Shield, RefreshCw } from "lucide-react";

interface AjoDetailsCardProps {
  ajo: any;
  member?: any;
  memberLoading?: boolean;
  monthlyPayment?: number;
  isVisible: boolean;
  lastUpdated: Date;
}

const AjoDetailsCard = ({
  ajo,
  isVisible,
  lastUpdated,
}: AjoDetailsCardProps) => {
  // TODO: Integrate real data from Starknet contracts

  return (
    <div
      className={`bg-gradient-to-br from-primary/90 via-primary to-accent text-primary-foreground rounded-2xl shadow-2xl p-6 md:p-8 mb-8 transform transition-all duration-1000 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Ajo Details
          </h1>
          <p className="text-primary-foreground/80">
            On Starknet Sepolia
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Blockchain Verified</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-primary-foreground/70 mb-1">Status</p>
          <p className="text-xl font-bold">Active</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-primary-foreground/70 mb-1">Network</p>
          <p className="text-xl font-bold">Starknet</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-primary-foreground/70 mb-1">Last Updated</p>
          <p className="text-sm font-medium">{lastUpdated.toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="mt-4 text-sm text-primary-foreground/60">
        <p>⚠️ Full details will be available once contract addresses are deployed</p>
      </div>
    </div>
  );
};

export default AjoDetailsCard;
