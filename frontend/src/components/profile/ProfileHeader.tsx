import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfileHeader = () => {
  const naviagte = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-background backdrop-blur-md border-b border-primary/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => naviagte("/dashboard")}
          className="flex items-center space-x-2 text-white hover:primary/90 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </button>

        {/* <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-700 hover:text-green-600 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-700 hover:text-green-600 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div> */}
      </div>
    </header>
  );
};

export default ProfileHeader;
