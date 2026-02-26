/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAjoStore } from "@/store/ajoStore";
import { useTokenStore } from "@/store/tokenStore";
import formatCurrency from "@/utils/formatCurrency";
import { convertToEvmAddress, formatTimestamp } from "@/utils/utils";
import { Coins, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";

const ProfileAjoGroups = () => {
  const navigate = useNavigate();
  const { nairaRate } = useTokenStore();
  const { ajoInfos } = useAjoStore();
  const { accountId } = useWalletInterface(); // logged-in user’s wallet

  // Filter only Ajos created by the logged-in user
  const userAjos = ajoInfos.filter(
    (ajo) =>
      ajo.creator.toLowerCase() ===
      convertToEvmAddress(accountId ? accountId : "")?.toLowerCase()
  );
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

        {userAjos.length === 0 ? (
          <>
            <p className="text-gray-400">
              You haven’t created any Ajo groups yet.
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
                key={ajo.ajoId}
                onClick={() => navigate(`/ajo/${ajo.ajoId}/${ajo.ajoCore}`)}
                className="p-4 border-2 border-gray-100/10 rounded-lg hover:border-yellow-300 transition-all hover:scale-105 group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-white group-hover:text-yellow-600 transition-colors">
                    {ajo.name}
                  </h4>
                  <span className="text-sm bg-primary/35 text-white px-2 py-1 rounded-full">
                    {ajo.isActive ? "Active" : "Closed"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <div className="font-semibold text-white">
                      {formatTimestamp(ajo.createdAt)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">ID:</span>
                    <div className="font-semibold text-white">#{ajo.ajoId}</div>
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
