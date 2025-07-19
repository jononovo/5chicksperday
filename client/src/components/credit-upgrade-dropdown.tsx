import React, { useState } from 'react';
import { ChevronDown, Zap, Crown, Check, Coins } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";

interface CreditData {
  balance: number;
  isBlocked: boolean;
  lastTopUp: number;
  totalUsed: number;
  monthlyAllowance: number;
}

interface SubscriptionStatus {
  hasSubscription: boolean;
  status: string | null;
  currentPlan: string | null;
}

interface NotificationStatus {
  notifications: number[];
  badges: number[];
  isWaitlistMember: boolean;
  hasHatchlingBadge: boolean;
}

export function CreditUpgradeDropdown() {
  const { data: credits, isLoading } = useQuery<CreditData>({
    queryKey: ['/api/credits'],
  });

  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/stripe/subscription-status'],
  });

  const { data: notificationStatus } = useQuery<NotificationStatus>({
    queryKey: ['/api/notifications/status'],
  });
  
  const { toast } = useToast();

  // State management for subscription testing
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [waitlistPlans, setWaitlistPlans] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Sync waitlist state with server data
  React.useEffect(() => {
    if (notificationStatus?.isWaitlistMember) {
      setWaitlistPlans(prev => prev.includes('duckin-awesome') ? prev : [...prev, 'duckin-awesome']);
    }
  }, [notificationStatus]);

  const plans = [
    {
      id: 'ugly-duckling',
      name: 'The Duckling',
      credits: 2000,
      bonus: 500,
      price: 18.95,
      icon: Zap,
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 'duckin-awesome',
      name: "Mama Duck",
      credits: 5000,
      bonus: 5000,
      price: 44.95,
      icon: Crown,
      color: 'from-purple-600 to-pink-600'
    }
  ];

  const handlePlanSelect = async (planId: string) => {
    console.log(`Selected plan: ${planId}`);
    
    if (planId === 'duckin-awesome') {
      // Waitlist functionality for unavailable plan
      if (!waitlistPlans.includes(planId)) {
        setWaitlistPlans([...waitlistPlans, planId]);
        toast({
          title: "Added to Waitlist",
          description: "We'll notify you when Mama Duck becomes available!",
        });
        
        // Track waitlist join in database via notification system
        try {
          const authToken = localStorage.getItem('authToken');
          const response = await fetch('/api/notifications/trigger', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            credentials: 'include',
            body: JSON.stringify({ trigger: 'waitlist_joined' })
          });
          
          if (!response.ok) {
            console.error('Failed to track waitlist join:', response.status);
          }
        } catch (error) {
          console.error('Failed to track waitlist join:', error);
          // Don't show error to user - tracking is background operation
        }
      }
      return;
    }
    
    // Stripe checkout for The Duckling plan
    if (planId === 'ugly-duckling') {
      try {
        setIsOpen(false); // Close dropdown before redirect
        
        const response = await apiRequest('POST', '/api/stripe/create-checkout-session', {
          planId
        });
        
        const data = await response.json();
        
        if (data.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('No checkout URL received');
        }
      } catch (error: any) {
        console.error('Stripe checkout error:', error);
        toast({
          title: "Checkout Error",
          description: error.message || "Failed to start checkout process. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Check if user has active subscription
  const hasActiveSubscription = subscriptionStatus?.hasSubscription && subscriptionStatus?.status === 'active';
  const userCurrentPlan = subscriptionStatus?.currentPlan;

  const getUpgradeText = () => {
    if (hasActiveSubscription) {
      if (userCurrentPlan === 'ugly-duckling') {
        return "Ready to level up?";
      }
      return "You're subscribed!";
    }
    return "Choose your plan to get started";
  };

  const getUpgradeSubtext = () => {
    if (hasActiveSubscription) {
      if (userCurrentPlan === 'ugly-duckling') {
        return "Get 4x more credits + bigger bonus";
      }
      return "You have access to premium features!";
    }
    return "Unlock more credits with a monthly subscription";
  };

  if (isLoading || !credits || typeof credits.balance !== 'number') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
        <Coins className="h-4 w-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      {/* Custom overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-sm font-medium h-auto p-2 hover:bg-accent hover:text-accent-foreground"
        >
          <Coins className={cn(
            "h-4 w-4",
            credits.balance >= 1 ? "text-yellow-500" : "text-red-600"
          )} />
          <span className="text-muted-foreground">
            {credits.balance < 0 ? credits.balance : `${credits.balance.toLocaleString()}`}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 bg-background border shadow-2xl z-50"
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-muted/50 to-muted/30 p-3 border-b">
          <div className="flex items-center gap-2">
            <Coins className={cn(
              "h-5 w-5",
              credits.balance >= 1 ? "text-yellow-500" : "text-red-600"
            )} />
            <div className="flex items-baseline gap-2">
              <p className="font-semibold text-foreground">{credits.balance.toLocaleString()} Credits</p>
              <p className="text-xs text-muted-foreground">Current balance</p>
            </div>
          </div>
        </div>

        {/* Upgrade Message */}
        <div className="px-4 pt-3 pb-2 text-center">
          <h3 className="font-semibold text-foreground mb-1">{getUpgradeText()}</h3>
          <p className="text-sm text-muted-foreground">
            {getUpgradeSubtext()}
          </p>
        </div>

        {/* Plans */}
        <div className="px-4 pb-2 space-y-4">
          {plans.map((plan) => {
            const isCurrentPlan = hasActiveSubscription && userCurrentPlan === plan.id;
            const isUpgrade = plan.id === 'duckin-awesome';
            const isOnWaitlist = waitlistPlans.includes(plan.id);
            
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] border shadow-md",
                  isCurrentPlan 
                    ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-700' 
                    : 'border-border hover:border-blue-200 dark:hover:border-blue-800'
                )}
                onClick={() => !isCurrentPlan && handlePlanSelect(plan.id)}
              >
                {isCurrentPlan && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-green-500 text-white rounded-full p-1">
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                )}
                
                <CardContent className="pt-3 px-3 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-border">
                      <plan.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{plan.name}</h4>
                      <div className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">{plan.credits.toLocaleString()} Credits</span>
                        <span className="text-green-600 dark:text-green-400 font-medium"> + {plan.bonus.toLocaleString()} Bonus</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-foreground">${plan.price}</span>
                        <span className="text-sm text-muted-foreground">Monthly</span>
                      </div>
                    </div>
                  </div>
                  
                  {!isCurrentPlan && !isOnWaitlist && (
                    <Button
                      className={cn(
                        "w-full mt-3 text-base group relative transition-all duration-300 transform hover:scale-102 hover:shadow-lg",
                        isUpgrade 
                          ? 'bg-gray-100 hover:bg-black hover:text-white text-black border-0' 
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlanSelect(plan.id);
                      }}
                    >
                      {isUpgrade ? (
                        <>
                          <span className="transition-all duration-700 delay-1000 group-hover:opacity-0 group-hover:scale-95">
                            Join Waitlist
                          </span>
                          <span className="absolute transition-all duration-700 delay-1000 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
                            Coming Soon 🚀
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="transition-all duration-700 delay-1000 group-hover:opacity-0 group-hover:scale-95">
                            Start Selling
                          </span>
                          <span className="absolute transition-all duration-700 delay-1000 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">
                            Let's Go 🚀
                          </span>
                        </>
                      )}
                    </Button>
                  )}
                  
                  {isOnWaitlist && (
                    <div className="mt-3 text-center">
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Added to Waitlist</span>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="mt-3 text-center">
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">Current Plan</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-muted/30 text-center border-t">
          <p className="text-xs text-muted-foreground mb-1">
            Plans auto-renew monthly. Cancel anytime.
          </p>
          <Button 
            variant="link"
            size="sm"
            onClick={() => console.log('Navigate to full details page')}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 h-auto p-0 font-medium"
          >
            See full details and features →
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}