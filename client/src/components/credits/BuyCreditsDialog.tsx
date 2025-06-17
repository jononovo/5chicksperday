import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, CreditCard, ArrowRight, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHowCreditsWork: () => void;
}

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/credits/success`,
        },
        redirect: "if_required"
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful!",
          description: "1,000 credits added to your account",
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay $40.00
          </>
        )}
      </Button>
    </form>
  );
}

export function BuyCreditsDialog({ open, onOpenChange, onHowCreditsWork }: BuyCreditsDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const createPaymentIntentMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/credits/purchase", { amount: 4000 }),
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: () => {
      setClientSecret("error");
    }
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !clientSecret) {
      setIsLoading(true);
      createPaymentIntentMutation.mutate();
    }
    if (!newOpen) {
      setClientSecret(null);
      setIsLoading(false);
    }
    onOpenChange(newOpen);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    onOpenChange(false);
  };

  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-600" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            Get 1,000 credits for $40. Credits are used for company searches, contact discovery, and email finding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Package Details */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-lg">1,000 Credits</span>
              </div>
              <span className="text-2xl font-bold text-blue-700">$40</span>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>• 4 Full Company Searches</span>
                <span className="text-gray-400">(250 credits each)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>• 100 Company Discoveries</span>
                <span className="text-gray-400">(10 credits each)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>• 50 Individual Email Finds</span>
                <span className="text-gray-400">(20 credits each)</span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-2 text-sm text-gray-600">Setting up payment...</span>
            </div>
          )}

          {clientSecret === "error" && (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Payment setup failed. Please try again.</p>
              <Button onClick={() => createPaymentIntentMutation.mutate()}>
                Retry
              </Button>
            </div>
          )}

          {clientSecret && clientSecret !== "error" && stripeOptions && (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <CheckoutForm onSuccess={handleSuccess} />
            </Elements>
          )}

          {/* Help Link */}
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onHowCreditsWork}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              How do credits work?
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}