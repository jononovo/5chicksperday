import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyCreditsDialog } from "@/components/credits/BuyCreditsDialog";
import { HowCreditsWorkDialog } from "@/components/credits/HowCreditsWorkDialog";

export function CreditCounter() {
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showHowCreditsWork, setShowHowCreditsWork] = useState(false);

  const { data: creditsData, isLoading } = useQuery({
    queryKey: ["/api/credits"],
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const credits = creditsData?.credits || 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowBuyCredits(true)}
        className="flex items-center gap-2 text-sm font-medium hover:bg-accent h-8 px-3"
      >
        <Coins className="h-4 w-4 text-yellow-600" />
        <span className="font-semibold">{credits.toLocaleString()}</span>
      </Button>

      <BuyCreditsDialog 
        open={showBuyCredits} 
        onOpenChange={setShowBuyCredits}
        onHowCreditsWork={() => {
          setShowBuyCredits(false);
          setShowHowCreditsWork(true);
        }}
      />

      <HowCreditsWorkDialog 
        open={showHowCreditsWork} 
        onOpenChange={setShowHowCreditsWork}
        onBuyCredits={() => {
          setShowHowCreditsWork(false);
          setShowBuyCredits(true);
        }}
      />
    </>
  );
}