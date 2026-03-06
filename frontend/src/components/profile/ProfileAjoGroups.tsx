/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Coins, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory, {
  type StarknetAjoInfo,
} from "@/hooks/useStarknetAjoFactory";

const ProfileAjoGroups = () => {
  const navigate = useNavigate();
  const { address } = useStarknetWallet();
  const { getUserAjos, getAjoInfo } = useStarknetAjoFactory();
  const [userAjos, setUserAjos] = useState<StarknetAjoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAjos = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log("Fetching Ajos for address:", address);
        const ajoIds = await getUserAjos(address);
        console.log("getUserAjos returned:", ajoIds);
        const ajoDetails = await Promise.all(
          ajoIds.map((id) => getAjoInfo(String(id))),
        );
        console.log("Ajo details:", ajoDetails);
        setUserAjos(ajoDetails);
      } catch (error) {
        console.error("Failed to fetch user Ajos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAjos();
  }, [address, getUserAjos, getAjoInfo]);

  const handleRoute = () => {
    navigate("/ajo/create-ajo");
  };

  return (
    <div className="grid md:grid-cols-1 gap-6">
      <div className="bg-card rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
          <Coins className="w-6 h-6 text-yellow-600" />
          <span>My Created Ajo Groups</span>
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : userAjos.length === 0 ? (
          <>
            <p className="text-gray-400">
              You haven't created any Ajo groups yet.
            </p>
            <Button
              onClick={handleRoute}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-sm font-semibold cursor-pointer my-3"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create ajo
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            {userAjos.map((ajo) => (
              <div
                key={ajo.id}
                onClick={() => navigate(`/ajo/${ajo.id}/${ajo.coreAddress}`)}
                className="p-4 border-2 border-gray-100/10 rounded-lg hover:border-yellow-300 transition-all hover:scale-105 group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-white group-hover:text-yellow-600 transition-colors">
                    {ajo.config.name}
                  </h4>
                  <span className="text-sm bg-primary/35 text-white px-2 py-1 rounded-full">
                    {ajo.isInitialized ? "Active" : "Pending"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Contribution:</span>
                    <div className="font-semibold text-white">
                      {(Number(ajo.config.monthlyContribution) / 1e6).toFixed(
                        2,
                      )}{" "}
                      {ajo.config.paymentToken}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Participants:</span>
                    <div className="font-semibold text-white">
                      {ajo.config.totalParticipants}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Cycle:</span>
                    <div className="font-semibold text-white">
                      {formatCycleDuration(ajo.config.cycleDuration)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">ID:</span>
                    <div className="font-semibold text-white">#{ajo.id}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileAjoGroups;

const formatCycleDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) return `${safeSeconds}s`;
  return parts.join(" ");
};
