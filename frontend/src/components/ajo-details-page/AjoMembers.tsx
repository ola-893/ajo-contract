import { Users, Database } from "lucide-react";
import { useState } from "react";

const AjoMembers = ({ ajo }: { ajo: any }) => {
  // TODO: Integrate useStarknetAjoMembers when contract addresses are available
  const [loadingMembers] = useState(false);

  if (loadingMembers)
    return (
      <div className=" bg-card rounded-xl shadow-lg p-8 border border-border text-center py-8 text-muted-foreground my-4">
        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Loading Members data...</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl shadow-lg p-4 sm:p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-card-foreground flex items-center space-x-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span>Members</span>
          </h3>
        </div>

        {/* Placeholder */}
        <div className="text-center py-8 text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">Members management coming soon</p>
          <p className="text-sm">
            Will display member list, positions, and payment status
          </p>
        </div>
      </div>
    </div>
  );
};

export default AjoMembers;
