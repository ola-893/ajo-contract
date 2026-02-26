import { useState, useEffect } from "react";
import Header from "@/components/header/Header";
import formatCurrency from "@/utils/formatCurrency";
import { TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AjoGroup {
  id: string;
  name: string;
  members: number;
  totalPool: number;
  nextPayout: string;
  myTurn: number;
  yieldGenerated: number;
}

const Ajo = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Page header */}
          <div
            className={`flex items-center justify-between transform transition-all duration-1000 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">
                Digital Ajo Groups
              </h2>
              <p className="text-muted-foreground">
                Traditional savings, modern yields
              </p>
            </div>
            <button
              onClick={() => navigate("/ajo/create-ajo")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Create New Ajo
            </button>
          </div>

          {/* Highlight card */}
          <div
            className={`bg-gradient-to-br from-primary to-accent text-primary-foreground p-6 rounded-xl transform transition-all duration-1000 delay-200 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <h3 className="text-lg font-semibold mb-2">
              AI-Powered Yield Optimization
            </h3>
            <p className="text-sm text-white/80 mb-3">
              Your idle Ajo funds are earning 8.5% APY through smart staking
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-background/20 px-3 py-1 rounded-full">
                <Zap className="h-3 w-3 inline mr-1" />
                Auto-staked
              </div>
              <div className="bg-background/20 px-3 py-1 rounded-full">
                Risk: Low
              </div>
            </div>
          </div>

          {/* Groups grid */}
          <div
            className={`grid gap-4 transform transition-all duration-1000 delay-300 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            {mockAjoGroups.map((ajo, index) => (
              <div
                key={ajo.id}
                className={`bg-card/60 rounded-xl shadow-sm border border-border/30 p-6 transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
                style={{ transitionDelay: `${400 + index * 150}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-card-foreground">
                      {ajo.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {ajo.members} members • Next payout: {ajo.nextPayout}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Pool Size</p>
                    <p className="text-xl font-bold text-card-foreground">
                      {formatCurrency(ajo.totalPool)}
                    </p>
                  </div>
                </div>

                <div className="bg-accent/10 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-accent">Yield Generated</p>
                      <p className="text-lg font-semibold text-card-foreground">
                        {formatCurrency(ajo.yieldGenerated)}
                      </p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Your Turn</p>
                    <p className="text-lg font-bold text-card-foreground">
                      #{ajo.myTurn}
                    </p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      Expected Amount
                    </p>
                    <p className="text-lg font-bold text-card-foreground">
                      {formatCurrency(
                        (ajo.totalPool + ajo.yieldGenerated) / ajo.members
                      )}
                    </p>
                  </div>
                </div>

                <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                  Make Monthly Contribution
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ajo;

const mockAjoGroups: AjoGroup[] = [
  {
    id: "1",
    name: "Tech Bros Ajo",
    members: 10,
    totalPool: 5000000,
    nextPayout: "Dec 15, 2024",
    myTurn: 3,
    yieldGenerated: 125000,
  },
  {
    id: "2",
    name: "Market Vendors Union",
    members: 25,
    totalPool: 12500000,
    nextPayout: "Jan 5, 2025",
    myTurn: 8,
    yieldGenerated: 312500,
  },
];
