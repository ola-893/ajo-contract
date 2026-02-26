import { useMemberStore } from "@/store/memberInfoStore";
import { useTokenStore } from "@/store/tokenStore";
import formatCurrency from "@/utils/formatCurrency";
import { Coins, Shield } from "lucide-react";
import { useEffect } from "react";

const StatsCard = ({ isVisible }: { isVisible: boolean }) => {
  const { memberData } = useMemberStore();
  const { nairaRate } = useTokenStore();
  useEffect(() => {
    console.log("MemberData", memberData);
  }, []);
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 transform transition-all duration-1000 delay-200 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      {/* <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-primary/15 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {memberData?.memberInfo.reputationScore}
            </div>
            <div className="text-sm text-white">Transparency Score</div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full"
            style={{ width: `${100}%` }}
          ></div>
        </div>
      </div> */}

      {/* <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-primary/15 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(
                Number(memberData?.memberInfo.lockedCollateral) * nairaRate
              )}
            </div>
            <div className="text-sm text-white">Ajo Contributions</div>
          </div>
        </div>
        <div className="text-sm text-white"> this month</div>
      </div> */}

      {/* <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-primary/15 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {userStats.nftsOwned}
            </div>
            <div className="text-sm text-white">Cultural NFTs</div>
          </div>
        </div>
        <div className="text-sm text-white">3 rare items</div>
      </div> */}

      {/* <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-primary/15 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Eye className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {userStats.exposuresReported}
            </div>
            <div className="text-sm text-white">Exposures Reported</div>
          </div>
        </div>
        <div className="text-sm text-white">Community hero</div>
      </div> */}
    </div>
  );
};

export default StatsCard;
