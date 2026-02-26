import { ajoData } from "@/temp-data";
import formatCurrency from "@/utils/formatCurrency";
import {
  Activity,
  BarChart3,
  CheckCircle,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react";

const AjoDetailAnalytics = () => {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <span>Performance Metrics</span>
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
              <span className="text-muted-foreground">
                Total Yield Generated
              </span>
              <span className="font-bold text-primary">
                {formatCurrency(ajoData.yieldGenerated)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
              <span className="text-muted-foreground">
                Average Monthly Return
              </span>
              <span className="font-bold text-accent">2.4%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
              <span className="text-muted-foreground">
                Payment Success Rate
              </span>
              <span className="font-bold text-green-400">100%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
              <span className="text-muted-foreground">Member Retention</span>
              <span className="font-bold text-secondary-foreground">95%</span>
            </div>
          </div>
        </div>

        {/* Growth Analytics */}
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-accent" />
            <span>Growth Analytics</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  Pool Growth
                </span>
                <span className="text-sm font-semibold text-primary">
                  +15.2%
                </span>
              </div>
              <div className="w-full bg-background/50 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: "75%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  Member Engagement
                </span>
                <span className="text-sm font-semibold text-accent">+8.7%</span>
              </div>
              <div className="w-full bg-background/50 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full"
                  style={{ width: "87%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  Yield Efficiency
                </span>
                <span className="text-sm font-semibold text-secondary-foreground">
                  +12.3%
                </span>
              </div>
              <div className="w-full bg-background/50 rounded-full h-2">
                <div
                  className="bg-secondary/70 h-2 rounded-full"
                  style={{ width: "92%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
          <Activity className="w-6 h-6 text-secondary-foreground" />
          <span>Monthly Breakdown</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              month: "Sep 2024",
              collected: 400000,
              payout: 600000,
              yield: 12000,
            },
            {
              month: "Oct 2024",
              collected: 400000,
              payout: 600000,
              yield: 15000,
            },
            {
              month: "Nov 2024",
              collected: 400000,
              payout: 600000,
              yield: 18000,
            },
            {
              month: "Dec 2024",
              collected: 200000,
              payout: 0,
              yield: 3000,
            },
          ].map((data, index) => (
            <div
              key={index}
              className="p-4 bg-background/30 rounded-lg border border-border"
            >
              <div className="text-sm font-semibold text-card-foreground mb-2">
                {data.month}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collected:</span>
                  <span className="text-primary">
                    {formatCurrency(data.collected)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payout:</span>
                  <span className="text-accent">
                    {data.payout > 0 ? formatCurrency(data.payout) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Yield:</span>
                  <span className="text-secondary-foreground">
                    {formatCurrency(data.yield)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <h3 className="text-xl font-bold text-card-foreground mb-4 flex items-center space-x-2">
          <Shield className="w-6 h-6 text-primary" />
          <span>Risk Assessment</span>
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-green-400">Low Risk</span>
            </div>
            <div className="text-sm text-muted-foreground">
              All members have strong payment history and sufficient collateral
            </div>
          </div>

          <div className="p-4 bg-background/30 rounded-lg border border-border">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-5 h-5 text-accent" />
              <span className="font-semibold text-card-foreground">
                Collateral Ratio
              </span>
            </div>
            <div className="text-2xl font-bold text-accent">110%</div>
            <div className="text-sm text-muted-foreground">
              Above minimum requirement
            </div>
          </div>

          <div className="p-4 bg-background/30 rounded-lg border border-border">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-5 h-5 text-secondary-foreground" />
              <span className="font-semibold text-card-foreground">
                Avg. Reputation
              </span>
            </div>
            <div className="text-2xl font-bold text-secondary-foreground">
              89.5
            </div>
            <div className="text-sm text-muted-foreground">
              Excellent member quality
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoDetailAnalytics;
