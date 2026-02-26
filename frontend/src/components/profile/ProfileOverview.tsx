import { achievements, recentActivity, userStats } from "@/temp-data";
import { ChevronRight, Shield, Trophy, Zap } from "lucide-react";

const ProfileOverview = () => {
  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Achievements */}
      <div className="lg:col-span-2">
        {/* <div className="bg-card rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <span>Achievements</span>
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {achievements.map((achievement, index) => {
              const IconComponent = achievement.icon;
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg border-2 border-primary/15 hover:border-primary/60 transition-all hover:scale-105 group cursor-pointer"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${achievement.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">
                        {achievement.title}
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-white/50">
                    {achievement.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div> */}

        {/* Recent Activity */}
        <div className="bg-card rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <Zap className="w-6 h-6 text-blue-600" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => {
              const IconComponent = activity.icon;
              return (
                <div
                  key={index}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-primary/15 transition-colors group"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <IconComponent className="w-5 h-5 text-gray-600 group-hover:text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{activity.text}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Profile Summary */}
        <div className="bg-card rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Profile Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-white/50">Communities</span>
              <span className="font-semibold text-primary">
                {userStats.communitiesJoined}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50">Total Savings</span>
              <span className="font-semibold text-green-600">
                {userStats.ajoContributions}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50">NFTs Owned</span>
              <span className="font-semibold text-purple-600">
                {userStats.nftsOwned}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/50">Exposures</span>
              <span className="font-semibold text-blue-600">
                {userStats.exposuresReported}
              </span>
            </div>
          </div>
        </div>

        {/* Transparency Score */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl shadow-lg p-6 text-white border border-primary/30">
          <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Transparency Score</span>
          </h3>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {userStats.transparencyScore}
            </div>
            <div className="text-green-100 mb-4">Exceptional Transparency</div>
            <div className="w-full bg-white rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-1000"
                style={{ width: `${userStats.transparencyScore}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full bg-primary/15 hover:bg-primary/20 text-primary p-3 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-between">
              <span>Join New Ajo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="w-full bg-primary/15 hover:bg-primary/20 text-primary p-3 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-between">
              <span>Report Corruption</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="w-full bg-primary/15 hover:bg-primary/20 text-primary p-3 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-between">
              <span>Browse NFTs</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
