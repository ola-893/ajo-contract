import { Award, Coins, TrendingUp, User } from "lucide-react";

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isVisible: boolean;
}

const ProfileNavigationTab = ({
  activeTab,
  isVisible,
  setActiveTab,
}: NavigationProps) => {
  return (
    <div
      className={`bg-card rounded-xl shadow-lg mb-8 transform transition-all duration-1000 delay-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="flex overflow-x-auto">
        {[
          { id: "ajo", label: "Ajo Groups", icon: Coins },
          { id: "nfts", label: "NFT Collection", icon: Award },
        ].map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/15 rounded-xl"
                  : "text-white hover:text-primary  rounded-sm"
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileNavigationTab;
