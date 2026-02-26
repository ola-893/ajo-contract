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
import { useAjoFactory } from "@/hooks/useAjoFactory";
import { toast } from "sonner";
import { useHcsTopicCreation } from "@/hooks/useHcsTopicCreation";
import { useWalletInterface } from "@/services/wallets/useWalletInterface";

const CreateAjo = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const {
    createAjo,
    initializeAjoPhase2,
    initializeAjoPhase3,
    initializeAjoPhase4,
    initializeAjoPhase5,
  } = useAjoFactory();
  const { accountId } = useWalletInterface();
  const { createHcsTopic, creating: creatingTopic } = useHcsTopicCreation();

  // Form state - Updated with new fields
  const [formData, setFormData] = useState({
    name: "",
    cycleDuration: "30", // days - will convert to seconds
    monthlyPaymentUSDC: "",
    monthlyPaymentHBAR: "",
    usesHtsTokens: true,
    usesScheduledPayments: true,
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
    }

    const cycleDays = parseInt(formData.cycleDuration);
    if (isNaN(cycleDays) || cycleDays < 1) {
      errors.cycleDuration = "Cycle duration must be at least 1 day";
    } else if (cycleDays > 365) {
      errors.cycleDuration = "Cycle duration cannot exceed 365 days";
    }

    const usdcAmount = parseFloat(formData.monthlyPaymentUSDC);
    const hbarAmount = parseFloat(formData.monthlyPaymentHBAR);

    if (!formData.monthlyPaymentUSDC && !formData.monthlyPaymentHBAR) {
      errors.monthlyPaymentUSDC = "At least one payment amount is required";
      errors.monthlyPaymentHBAR = "At least one payment amount is required";
    }

    if (formData.monthlyPaymentUSDC) {
      if (isNaN(usdcAmount) || usdcAmount <= 0) {
        errors.monthlyPaymentUSDC = "USDC amount must be greater than 0";
      } else if (usdcAmount > 1000000) {
        errors.monthlyPaymentUSDC = "USDC amount is too large";
      }
    }

    if (formData.monthlyPaymentHBAR) {
      if (isNaN(hbarAmount) || hbarAmount <= 0) {
        errors.monthlyPaymentHBAR = "HBAR amount must be greater than 0";
      } else if (hbarAmount > 1000000) {
        errors.monthlyPaymentHBAR = "HBAR amount is too large";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (!accountId) throw new Error("Wallet not connected");

      // Convert form data to contract parameters
      const cycleDurationSeconds = parseInt(formData.cycleDuration);
      const monthlyPaymentUSDC = formData.monthlyPaymentUSDC
        ? Math.floor(parseFloat(formData.monthlyPaymentUSDC) * 1e6)
        : 0;
      const monthlyPaymentHBAR = formData.monthlyPaymentHBAR
        ? Math.floor(parseFloat(formData.monthlyPaymentHBAR) * 1e8)
        : 0;

      // ✅ Phase 1 - Create Ajo Core
      setCurrentPhase(1);
      toast.info("Creating Ajo core...");

      const { ajoId, receipt } = await createAjo(
        formData.name,
        true, // usesHtsTokens
        formData.usesScheduledPayments,
        cycleDurationSeconds,
        monthlyPaymentUSDC,
        0
      );

      console.log("✅ Phase 1 complete. Ajo ID:", ajoId);
      toast.success("Phase 1: Ajo core created!");

      // ✅ CREATE HCS TOPIC (Frontend operation)
      toast.info("Creating HCS governance topic...");

      const hcsTopicInfo = await createHcsTopic(formData.name, "testnet");

      console.log("✅ HCS Topic created:", hcsTopicInfo);

      if (hcsTopicInfo.simulated) {
        toast.warning("Using simulated HCS topic for development");
      } else {
        toast.success(`HCS Topic created: ${hcsTopicInfo.topicId}`);
      }

      // ✅ Phase 2 - Initialize Members + Governance + HCS (Pass topic ID)
      setCurrentPhase(2);
      toast.info("Initializing members, governance, and HCS...");

      await initializeAjoPhase2(ajoId, hcsTopicInfo.bytes32TopicId);

      console.log("✅ Phase 2 complete with HCS topic:", hcsTopicInfo.topicId);
      toast.success("Phase 2: Members & Governance initialized!");

      // ✅ Phase 3 - Initialize Collateral + Payments
      setCurrentPhase(3);
      toast.info("Initializing collateral and payments...");

      await initializeAjoPhase3(ajoId);

      console.log("✅ Phase 3 complete");
      toast.success("Phase 3: Collateral & Payments initialized!");

      // ✅ Phase 4 - Initialize Core + Cross-link
      setCurrentPhase(4);
      toast.info("Cross-linking contracts...");

      await initializeAjoPhase4(ajoId);

      console.log("✅ Phase 4 complete");
      toast.success("Phase 4: Cross-linking complete!");

      // ✅ Phase 5 - Finalize (if using scheduled payments)
      if (formData.usesScheduledPayments) {
        setCurrentPhase(5);
        toast.info("Finalizing with scheduled payments...");

        await initializeAjoPhase5(ajoId);

        console.log("✅ Phase 5 complete - Ajo active");
        toast.success("Phase 5: Ajo fully initialized!");
      }

      setIsSubmitting(false);
      setCurrentPhase(0);

      toast.success(
        `🎉 Ajo created successfully! ${
          !hcsTopicInfo.simulated ? `HCS Topic: ${hcsTopicInfo.topicId}` : ""
        }`
      );

      setShowSuccess(true);

      // Store HCS topic info for later use
      console.log("Full Ajo Details:", {
        ajoId,
        name: formData.name,
        hcsTopicId: hcsTopicInfo.topicId,
        hcsTopicIdBytes32: hcsTopicInfo.bytes32TopicId,
        simulated: hcsTopicInfo.simulated,
      });

      // Reset form after success
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          name: "",
          cycleDuration: "30",
          monthlyPaymentUSDC: "",
          monthlyPaymentHBAR: "",
          usesHtsTokens: true,
          usesScheduledPayments: true,
        });
        // navigate(`/ajo/${ajoId}`);
      }, 3000);
    } catch (err: any) {
      console.error("Failed to create Ajo:", err);
      toast.error(err?.message || "Failed to create Ajo.");
      setCurrentPhase(0);
    } finally {
      setIsSubmitting(false);
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

                {/* Phase Progress Indicator */}
                {isSubmitting && currentPhase > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Initialization Progress
                      </span>
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        Phase {currentPhase}/
                        {formData.usesScheduledPayments ? 5 : 4}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (currentPhase /
                              (formData.usesScheduledPayments ? 5 : 4)) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                      Please approve each transaction in your wallet
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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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

                  {/* Payment Amounts */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-accent" />
                      <span>Monthly Payment Amounts</span>
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                          USDC Amount
                        </label>
                        <input
                          type="number"
                          name="monthlyPaymentUSDC"
                          value={formData.monthlyPaymentUSDC}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                            formErrors.monthlyPaymentUSDC
                              ? "border-destructive"
                              : "border-border"
                          }`}
                          disabled={isSubmitting}
                        />
                        {formErrors.monthlyPaymentUSDC && (
                          <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                            <AlertCircle className="w-4 h-4" />
                            <span>{formErrors.monthlyPaymentUSDC}</span>
                          </p>
                        )}
                      </div>

                      {/* <div>
                        <label className="block text-sm font-medium text-card-foreground mb-2">
                          HBAR Amount
                        </label>
                        <input
                          type="number"
                          name="monthlyPaymentHBAR"
                          value={formData.monthlyPaymentHBAR}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={`w-full px-4 py-3 bg-background border rounded-lg focus:ring-0 outline-none focus:ring-primary focus:border-primary transition-colors text-foreground ${
                            formErrors.monthlyPaymentHBAR
                              ? "border-destructive"
                              : "border-border"
                          }`}
                          disabled={isSubmitting}
                        />
                        {formErrors.monthlyPaymentHBAR && (
                          <p className="mt-1 text-sm text-destructive flex items-center space-x-1">
                            <AlertCircle className="w-4 h-4" />
                            <span>{formErrors.monthlyPaymentHBAR}</span>
                          </p>
                        )}
                      </div> */}
                    </div>
                    {/* <p className="text-xs text-muted-foreground">
                      * At least one payment amount is required
                    </p> */}
                  </div>

                  {/* Options */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-card-foreground">
                      Options
                    </h3>

                    <div className="space-y-3">
                      {/* <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="usesHtsTokens"
                          checked={formData.usesHtsTokens}
                          onChange={handleInputChange}
                          className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                          disabled={isSubmitting}
                        />
                        <div>
                          <span className="text-sm font-medium text-card-foreground">
                            Use HTS Tokens
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Enable Hedera Token Service for payments
                          </p>
                        </div>
                      </label> */}

                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="usesScheduledPayments"
                          checked={formData.usesScheduledPayments}
                          onChange={handleInputChange}
                          className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                          disabled={isSubmitting}
                        />
                        <div>
                          <span className="text-sm font-medium text-card-foreground">
                            Use Scheduled Payments
                          </span>
                          <p className="text-xs text-muted-foreground">
                            Automate payments with Hedera Schedule Service
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-6 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                          <span>
                            {currentPhase > 0
                              ? `Processing Phase ${currentPhase}/${
                                  formData.usesScheduledPayments ? 5 : 4
                                }...`
                              : "Creating Ajo..."}
                          </span>
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
