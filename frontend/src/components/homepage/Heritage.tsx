import { Coins, Heart, Star } from "lucide-react";

const Heritage = () => {
  return (
    <section className="py-24 bg-[#070101] relative">
      {/* Background Illustration */}
      <div className="absolute inset-0 opacity-20">
        <img
          src="/images/homepage/natives.svg"
          alt="Natives"
          className="object-cover"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-4">
            Celebrating African Heritage
          </h2>
          <p className="ttext-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            From *Ajo* savings to timeless sayings, we’re immortalizing African
            culture with digital collectibles that carry both pride and purpose.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group border border-border">
            <div className="w-8 h-8 lg:w-16 lg:h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Coins className=" w-4 h-4 lg:w-8 lg:h-8 text-white" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-3">
              Sapa Survivor Badges
            </h3>
            <p className="text-muted-foreground text-sm lg:text-lg">
              Special NFTs for consistent *Ajo* contributors. Showcase your
              financial discipline and earn cultural bragging rights.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group border border-border">
            <div className="w-8 h-8 lg:w-16 lg:h-16 bg-gradient-to-br from-accent to-orange-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Star className="w-4 h-4 lg:w-8 lg:h-8 text-white" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-3">
              Wazobia Unity Collection
            </h3>
            <p className="text-muted-foreground text-sm lg:text-lg">
              Digital art celebrating african culture. A symbol of unity in
              diversity, and wealth in community.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group sm:col-span-2 lg:col-span-1 border border-border">
            <div className="w-8 h-8 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Heart className="w-4 h-4 lg:w-8 lg:h-8 text-white" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-3">
              Cultural Meme Drops
            </h3>
            <p className="text-muted-foreground text-sm lg:text-lg">
              Own iconic african sayings like “Dey Play” and “Problem no dey
              finish” as fun cultural NFTs that live forever on-chain.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Heritage;
