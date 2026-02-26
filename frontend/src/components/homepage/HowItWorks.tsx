import { Globe, Smartphone, Users } from "lucide-react";

const HowItWorks = () => {
  return (
    <section className="py-24 bg-[#070101]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-4">
            On-Chain Trust, Powered by Community
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            We’ve reimagined <span className="font-semibold">Ajo</span> for the
            digital age. Transparent, borderless, and built for Africans
            everywhere.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Mobile First */}
          <div className="text-center group">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/30 transition-colors border border-primary/30">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-4">
              Mobile-First Simplicity
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-lg">
              Whether you’re in Luanda, Kano, or Kigali—our platform is built
              for smartphones first. Easy to join, simple to contribute.
            </p>
          </div>

          {/* Real World Value */}
          <div className="text-center group">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-accent/30 transition-colors border border-accent/30">
              <Globe className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-4">
              Backed by Real Value
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-lg">
              Savings are secured on Hedera and tied to tokenized assets like
              gold and silver. No ponzi, no hype—just wealth that lasts.
            </p>
          </div>

          {/* Community */}
          <div className="text-center group">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-500/30 transition-colors border border-purple-500/30">
              <Users className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-sm lg:text-lg font-semibold text-foreground mb-4">
              Community Accountability
            </h3>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-lg">
              Every contribution and payout is visible on-chain. No more
              mistrust—your group keeps each other honest, just like traditional
              Ajo, but smarter.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
