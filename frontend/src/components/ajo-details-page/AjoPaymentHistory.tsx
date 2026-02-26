import { paymentHistory } from "@/temp-data";
import formatCurrency from "@/utils/formatCurrency";
import { formatAddress } from "@/utils/utils";
import {
  CheckCircle,
  Download,
  History,
  Link,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";

const AjoPaymentHistory = () => {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-card-foreground flex items-center space-x-2">
            <History className="w-6 h-6 text-accent" />
            <span>Payment History</span>
          </h3>
          <div className="flex items-center space-x-2">
            <button className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
              <Download className="w-4 h-4 mr-2 inline" />
              Export
            </button>
            <select className="px-3 py-2 bg-background border border-border rounded-lg text-card-foreground">
              <option>All Cycles</option>
              <option>Cycle 1</option>
              <option>Cycle 2</option>
              <option>Cycle 3</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Cycle
                </th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Date
                </th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Recipient
                </th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Amount
                </th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border/50 hover:bg-background/30 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {payment.cycle}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-card-foreground">
                    {payment.date}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-accent" />
                      </div>
                      <span className="font-medium text-card-foreground">
                        {payment.recipient}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-primary">
                      {formatCurrency(payment.amount)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payment.status === "completed"
                          ? "bg-green-600 text-white"
                          : payment.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <button className="flex items-center space-x-1 text-accent hover:text-accent/80 transition-colors">
                        <Link className="w-4 h-4" />
                        <span className="text-sm font-mono">
                          {formatAddress(payment.txHash)}
                        </span>
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Block: {payment.blockNumber.toLocaleString()} • Gas:{" "}
                      {payment.gasUsed.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Total Paid Out
            </h4>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-primary">$1,800.00</div>
          <div className="text-sm text-muted-foreground">Across 3 cycles</div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">
              Average Gas Cost
            </h4>
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div className="text-2xl font-bold text-card-foreground">21,000</div>
          <div className="text-sm text-muted-foreground">
            ~$0.28 per transaction
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-card-foreground">Success Rate</h4>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-500">100%</div>
          <div className="text-sm text-muted-foreground">
            All payments successful
          </div>
        </div>
      </div>
    </div>
  );
};

export default AjoPaymentHistory;
