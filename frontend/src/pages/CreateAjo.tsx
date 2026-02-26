/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Coins,
  Info,
  CheckCircle,
  AlertCircle,
  Plus,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
import { toast } from "sonner";
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import Header from "@/components/header/Header";

const CreateAjo = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { createAjo, deployAjoContracts, loading } = useStarknetAjoFactory();
  const { address, isConnected } = useStarknetWallet();

  // Form state - Updated for Starknet
  const [formData, setFormData] = useState({
    name: "",
    cycleDuration: "30", // days (1-62 allowed)
    monthlyContribution: "",
    totalParticipants: "3", // minimum 3 participants required
    paymentToken: "USDC" as 'USDC' | 'BTC',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Ajo name is required";
    } else if (formData.name.length < 3) {
      errors.name = "Name must be at least 3 characters";
    } else if (formData.name.length > 31) {
      errors.name = "Name must be 31 characters or less (Cairo felt252 limit)";
    }

    const cycleDays = parseInt(formData.cycleDuration);
    if (isNaN(cycleDays) || cycleDays < 1) {
      errors.cycleDuration = "Cycle duration must be at least 1 day";
    } else if (cycleDays > 62) {
      errors.cycleDuration = "Cycle duration cannot exceed 62 days (Cairo contract limit)";
    }

    const contribution = parseFloat(formData.monthlyContribution);
    if (!formData.monthlyContribution || isNaN(contribution) || contribution <= 0) {
      errors.monthlyContribution = "Monthly contribution must be greater than 0";
    } else if (contribution > 1000000) {
      errors.monthlyContribution = "Contribution amount is too large";
    }

    const participants = parseInt(formData.totalParticipants);
    if (isNaN(participants) || participants < 3) {
      errors.totalParticipants = "Must have at least 3 participants (Cairo contract requirement)";
    } else if (participants > 100) {
      errors.totalParticipants = "Cannot exceed 100 participants";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!validateForm()) return;

    try {
      toast.info("Creating Ajo on Starknet...");

      const result = await createAjo({
        name: formData.name,
        monthlyContribution: formData.monthlyContribution,
        totalParticipants: parseInt(formData.totalParticipants),
        cycleDuration: parseInt(formData.cycleDuration),
        paymentToken: formData.paymentToken,
      });

      console.log("✅ Ajo created successfully!", result);
      
      toast.success(
        `🎉 Ajo created successfully! Transaction: ${result.transactionHash.slice(0, 10)}...`
      );

      setShowSuccess(true);

      // Reset form after success
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          name: "",
          cycleDuration: "30",
          monthlyContribution: "",
          totalParticipants: "10",
          paymentToken: "USDC",
        });
        navigate("/dashboard");
      }, 3000);
    } catch (err: any) {
      console.error("Failed to create Ajo:", err);
      toast.error(err?.message || "Failed to create Ajo. Please try again.");
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <Coins className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Ajo.Save</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div
          className={`text-center mb-8 transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4">
            Digital Ajo Platform
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl mx-auto">
            Create a transparent, blockchain-powered savings group. Build wealth
            with your community.
          </p>
        </div>

        {/* Tab Content */}
        <div
          className={`transform transition-all duration-500 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Create Form */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-xl shadow-lg p-8 border border-border">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-card-foreground">
                    Create Your Ajo Group
                  </h2>
                </div>

                {showSuccess && (
                  <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="font-semibold text-primary">
                        Ajo Created Successfully!
                      </h3>
                      <p className="text-primary/80">
                        Your Ajo group is now live and accepting members.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading Indicator */}
                {loading && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Creating Ajo on Starknet
                      </span>
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        Processing...
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500 animate-pulse w-full"></div>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                      Please approve the transaction in your wallet
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground flex items-center space-x-2">
                      <Info className="w-5 h-5 text-accent" />
                      <span>Basic Information</span>
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-2">
                        Ajo Group Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., Tech Bros Savings Circle"
                        className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                          formErrors.name
                            ? "border-destructive"
                            : "border-border"
                        }`}
                        disabled={loading}
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                          <AlertCircle className="w-4 h-4" />
                          <span>{formErrors.name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Cycle Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-accent" />
                      <span>Cycle Configuration</span>
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-2">
                        Cycle Duration (days) *
                      </label>
                      <input
                        type="number"
                        name="cycleDuration"
                        value={formData.cycleDuration}
                        onChange={handleInputChange}
                        placeholder="30"
                        min="1"
                        max="365"
                        className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                          formErrors.cycleDuration
                            ? "border-destructive"
                            : "border-border"
                        }`}
                        disabled={loading}
                      />
                      {formErrors.cycleDuration && (
                        <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                          <AlertCircle className="w-4 h-4" />
                          <span>{formErrors.cycleDuration}</span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        How often members contribute and receive payouts
                      </p>
                    </div>
                  </div>

                  {/* Payment Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-accent" />
                      <span>Payment Configuration</span>
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                          Monthly Contribution *
                        </label>
                        <input
                          type="number"
                          name="monthlyContribution"
                          value={formData.monthlyContribution}
                          onChange={handleInputChange}
                          placeholder="100.00"
                          step="0.01"
                          min="0"
                          className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                            formErrors.monthlyContribution
                              ? "border-destructive"
                              : "border-border"
                          }`}
                          disabled={loading}
                        />
                        {formErrors.monthlyContribution && (
                          <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                            <AlertCircle className="w-4 h-4" />
                            <span>{formErrors.monthlyContribution}</span>
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Amount each member contributes per cycle
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                          Payment Token *
                        </label>
                        <select
                          name="paymentToken"
                          value={formData.paymentToken}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground"
                          disabled={loading}
                        >
                          <option value="USDC">USDC</option>
                          <option value="BTC">BTC</option>
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Token used for contributions
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-card-foreground mb-2">
                        Total Participants *
                      </label>
                      <input
                        type="number"
                        name="totalParticipants"
                        value={formData.totalParticipants}
                        onChange={handleInputChange}
                        placeholder="3"
                        min="3"
                        max="100"
                        className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                          formErrors.totalParticipants
                            ? "border-destructive"
                            : "border-border"
                        }`}
                        disabled={loading}
                      />
                      {formErrors.totalParticipants && (
                        <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                          <AlertCircle className="w-4 h-4" />
                          <span>{formErrors.totalParticipants}</span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Maximum number of members in the Ajo
                      </p>
                    </div>
                  </div>


                  {/* Submit Button */}
                  <div className="pt-6 border-t border-border">
                    <button
                      type="submit"
                      disabled={loading || !isConnected}
                      className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating Ajo on Starknet...</span>
                        </>
                      ) : !isConnected ? (
                        <>
                          <AlertCircle className="w-5 h-5" />
                          <span>Connect Wallet to Continue</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          <span>Create Ajo Group</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* How It Works */}
              <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg p-6 text-primary-foreground">
                <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                  <Info className="w-5 h-5" />
                  <span>How Digital Ajo Works</span>
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div>
                      <div className="font-semibold">Create or Join</div>
                      <div className="text-primary-foreground/80">
                        Set up your Ajo with transparent rules
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <div>
                      <div className="font-semibold">Lock Collateral</div>
                      <div className="text-primary-foreground/80">
                        Smart contract calculates required collateral
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <div>
                      <div className="font-semibold">Monthly Payments</div>
                      <div className="text-primary-foreground/80">
                        Automated payments via blockchain
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center text-xs font-bold">
                      4
                    </div>
                    <div>
                      <div className="font-semibold">Receive Payout</div>
                      <div className="text-primary-foreground/80">
                        Get your turn in the rotation
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
                <h3 className="text-lg font-bold text-card-foreground mb-4">
                  Why Choose Digital Ajo?
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      100% transparent on blockchain
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Smart contract automation
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Lower collateral requirements
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Yield generation on idle funds
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Community governance
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAjo;
