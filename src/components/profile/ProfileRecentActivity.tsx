import { recentActivity } from "@/temp-data";
import { ChevronRight, TrendingUp } from "lucide-react";

const ProfileRecentActivity = () => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <span>Activity Timeline</span>
      </h3>
      <div className="space-y-6">
        {recentActivity.map((activity, index) => {
          const IconComponent = activity.icon;
          return (
            <div
              key={index}
              className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <IconComponent className="w-6 h-6 text-gray-600 group-hover:text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium mb-1">
                  {activity.text}
                </p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileRecentActivity;
