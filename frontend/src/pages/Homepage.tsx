import HomePageHeader from "@/components/homepage/HomePageHeader";
import Hero from "@/components/homepage/Hero";
import Features from "@/components/homepage/Features";
import Heritage from "@/components/homepage/Heritage";
import HowItWorks from "@/components/homepage/HowItWorks";
import Testimonials from "@/components/homepage/Testimonials";
import Footer from "@/components/homepage/Footer";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/auth/WalletContext";

function Homepage() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  // console.log("Authentication Status:", connected);

  useEffect(() => {
    if (connected) navigate("/dashboard");
  }, [connected, navigate]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50">
      <HomePageHeader />
      <Hero />
      <Features />
      <Heritage />
      <HowItWorks />
      <Testimonials />
      <Footer />
    </div>
  );
}

export default Homepage;
