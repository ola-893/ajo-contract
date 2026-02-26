import { BarChart3, Eye, Users, Vote, History } from "lucide-react";

const AjoDetailsNavigationTab = ({
  isVisible,
  activeTab,
  setActiveTab,
}: {
  isVisible: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) => {
  return (
    <div
      className={`bg-card rounded-xl shadow-lg mb-8 transform transition-all duration-1000 delay-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
    >
      <div className="flex overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: Eye },
          { id: "members", label: "Members", icon: Users },
          // { id: "payments", label: "Payment History", icon: History },
          { id: "governance", label: "Governance", icon: Vote },
          // { id: "analytics", label: "Analytics", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/15 rounded-xl"
                : "text-white hover:text-primary  rounded-sm"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AjoDetailsNavigationTab;
