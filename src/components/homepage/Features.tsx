"use client";

import { CheckCircle, Coins, Shield, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

const Features = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <section id="features" className="py-24 bg-[#070101]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-4">
            Ajo for the Digital Age
          </h2>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-3xl mx-auto">
            Powered by Hedera, we’re reinventing Africa's traditional savings
            culture with on-chain accountability, cultural pride, and real
            wealth opportunities.
          </p>
        </div>

        {/* Features + Highlight */}
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Features List */}
          <div className="space-y-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className={`p-6 rounded-xl cursor-pointer transition-all duration-300 border ${
                    activeFeature === index
                      ? "bg-primary/10 border-primary scale-105"
                      : "bg-card border-border hover:bg-card/80"
                  }`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-8 h-8 p-2 lg:w-12 lg:h-12 rounded-sm lg:rounded-lg ${feature.color} flex items-center justify-center`}
                    >
                      <IconComponent className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm sm:text-lg text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Highlight Box */}
          <div className="relative">
            <div className="absolute -top-10 -right-10 opacity-30">
              <img
                src="/images/homepage/coins-illustration.png"
                alt="Coins"
                width={100}
                height={100}
                className="animate-spin-slow"
              />
            </div>

            <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-8 text-white border border-primary/30">
              <h3 className="text-xl font-bold mb-4">
                Why Ajo.Save Stands Out
              </h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm lg:text-lg space-x-3">
                  <CheckCircle className="w-5 h-5" />
                  <span>Every transaction tracked immutably on Hedera</span>
                </div>
                <div className="flex items-center text-sm lg:text-lg space-x-3">
                  <CheckCircle className="w-5 h-5" />
                  <span>No middlemen — smart contracts handle payouts</span>
                </div>
                <div className="flex items-center text-sm lg:text-lg space-x-3">
                  <CheckCircle className="w-5 h-5" />
                  <span>Collective savings that empower every member</span>
                </div>
                <div className="flex items-center text-sm lg:text-lg space-x-3">
                  <CheckCircle className="w-5 h-5" />
                  <span>Celebrate culture with on-chain cultural NFTs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;

// Updated Features Data
const features = [
  {
    icon: Shield,
    title: "Blockchain Transparency",
    description:
      "No excuses, no lies. Contributions and payouts are publicly verifiable on Hedera.",
    color: "bg-primary",
  },
  {
    icon: Coins,
    title: "Digital Ajo Savings",
    description:
      "Bring the trusted rotation savings model on-chain — secure, fast, and borderless.",
    color: "bg-accent",
  },
  {
    icon: Users,
    title: "Community First",
    description:
      "Empowering groups to save together, build trust, and celebrate African heritage.",
    color: "bg-blue-500",
  },
  {
    icon: TrendingUp,
    title: "Wealth That Works",
    description:
      "Turn contributions into opportunities. Your money builds wealth while strengthening community bonds.",
    color: "bg-purple-500",
  },
];
