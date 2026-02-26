import { nftCollection } from "@/temp-data";
import { Award } from "lucide-react";

const ProfileNftPage = () => {
  return (
    <div className="bg-card rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
        <Award className="w-6 h-6 text-purple-600" />
        <span>Cultural NFT Collection (Coming Soon !)</span>
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {nftCollection.map((nft, index) => (
          <div key={index} className="group cursor-pointer">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-8 mb-4 hover:from-green-100 hover:to-yellow-100 transition-all hover:scale-105 group-hover:shadow-lg">
              <div className="text-6xl text-center mb-4">{nft.image}</div>
              <div
                className={`text-xs font-medium px-2 py-1 rounded-full text-center ${
                  nft.rarity === "Legendary"
                    ? "bg-yellow-200 text-yellow-800"
                    : nft.rarity === "Epic"
                    ? "bg-purple-200 text-purple-800"
                    : nft.rarity === "Rare"
                    ? "bg-blue-200 text-blue-800"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {nft.rarity}
              </div>
            </div>
            <h4 className="font-semibold text-white/60 group-hover:text-green-600 transition-colors">
              {nft.name}
            </h4>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileNftPage;
