"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Users, TrendingUp, Shield } from "lucide-react";

interface EmptyStateProps {
  onCreateAjo?: () => void;
}

export function EmptyState({ onCreateAjo }: EmptyStateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Main illustration area */}
        <div className="relative">
          <div className="w-16 h-16 sm:w-32 sm:h-32 mx-auto bg-card rounded-full flex items-center justify-center mb-6 border border-border">
            <Users className="w-8 h-8 sm:w-16 sm:h-16 text-muted-foreground" />
          </div>

          {/* Floating elements */}
          <div className="absolute -top-4 left-0 sm:-left-8 w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center animate-bounce">
            <TrendingUp className="w-4 h-6 text-primary" />
          </div>
          <div className="absolute -top-2 right-0 sm:-right-12 w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center animate-bounce delay-300">
            <Shield className="w-5 h-5 text-accent" />
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-4">
          <h1 className="text-lg font-bold text-foreground">
            No Ajo Groups Yet
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Be the pioneer! Create the first Ajo group and start building wealth
            together with your community.
          </p>
        </div>

        {/* Benefits cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <Card className="p-4 bg-card border-border">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-card-foreground mb-2">
              Community Savings
            </h3>
            <p className="text-sm text-muted-foreground">
              Pool resources with trusted members for collective financial
              growth
            </p>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold text-card-foreground mb-2">
              Guaranteed Returns
            </h3>
            <p className="text-sm text-muted-foreground">
              Receive your full contribution plus interest through rotating
              payouts
            </p>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-card-foreground mb-2">
              Blockchain Security
            </h3>
            <p className="text-sm text-muted-foreground">
              Smart contracts ensure transparent and secure fund management
            </p>
          </Card>
        </div>

        {/* Call to action */}
        <div className="space-y-4 pt-4">
          <Button
            onClick={onCreateAjo}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold cursor-pointer"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create First Ajo Group
          </Button>

          <p className="text-sm text-muted-foreground">
            Start with as few as 10 members • No setup fees • Full blockchain
            transparency
          </p>
        </div>

        {/* Stats preview */}
        <div className="flex justify-center space-x-8 pt-8 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">0</div>
            <div className="text-sm text-muted-foreground">Active Groups</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">0</div>
            <div className="text-sm text-muted-foreground">Total Members</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-card-foreground">$0</div>
            <div className="text-sm text-muted-foreground">Total Saved</div>
          </div>
        </div>
      </div>
    </div>
  );
}
