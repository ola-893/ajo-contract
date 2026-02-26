import { useEffect, useState } from "react";
import { ChevronRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-screen bg-[#070101] overflow-hidden">
      <div className="w-full h-screen flex items-center relative px-16">
        {/* Left side - AJO.save complete illustration - UNCHANGED */}
        <div className="absolute left-0 top-1/2 transform -translate-y-200/325">
          <div>
            <img src="/images/homepage/ajo-logo.png" alt="Ajo logo" />
          </div>
        </div>

        {/* Right side - African woman portrait - UNCHANGED */}
        <img
          src="/images/homepage/african-pattern.svg"
          alt="Portrait of a woman"
          className="absolute top-1/2 h-full w-full object-cover right-0  transform -translate-y-1/2 translate-x-[35%]"
        />

        {/* Hedera badge and tagline - positioned at top center */}
        <div
          className={`absolute top-8 left-1/2 transform -translate-x-1/2 z-10 text-center transition-all duration-1000 ${
            isVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-10 opacity-0"
          }`}
        >
          <div className="inline-flex text-sm items-center space-x-2 bg-primary/20 text-primary px-4 py-2 rounded-full font-medium border border-primary/30 mb-4">
            <Zap className="w-4 h-4" />
            <span>Powered by Hedera</span>
          </div>

          <h1 className="text-lg lg:text-xl text-gray-400 font-normal leading-tight">
            Africa's Trusted Savings Culture, Now On-Chain
          </h1>
        </div>

        {/* CTA - positioned at bottom left below the illustration */}
        <div
          className={`absolute bottom-[12vh] left-[8vw] z-10 transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          {/* Subtitle above CTA */}
          {/* <p className="text-sm text-primary-400 mb-4 max-w-[500px] leading-relaxed">
            From street corners to smart contracts: Build wealth, protect your
            community savings, and keep everyone accountable with Hedera's fast,
            low-cost blockchain.
          </p> */}

          {/* Single CTA - longer than illustration */}
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-4 rounded-full font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg flex items-center space-x-3  h-[7vh] w-fit justify-center cursor-pointer"
          >
            <span className="text-xl">Start Your Ajo Journey</span>
            <ChevronRight className="w-6 h-6 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:rotate-12 animate-ping" />
          </button>
        </div>

        {/* Scroll indicator at bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-4 h-8 lg:w-6 lg:h-10 border-2 border-primary rounded-full flex justify-center">
            <div className="w-1 h-3 bg-primary rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
