import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Coins, 
  Search, 
  Users, 
  Mail, 
  CreditCard, 
  ArrowRight,
  Building2,
  Target
} from "lucide-react";

interface HowCreditsWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyCredits: () => void;
}

export function HowCreditsWorkDialog({ open, onOpenChange, onBuyCredits }: HowCreditsWorkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-600" />
            How Credits Work
          </DialogTitle>
          <DialogDescription>
            Credits power all search operations in 5Ducks. Here's how the pricing works:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Credit Pricing Table */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Credit Pricing Guide
            </h3>
            
            <div className="grid gap-3">
              <div className="flex items-center justify-between py-2 border-b border-blue-200 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Company Discovery</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  10 credits
                </Badge>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-blue-200 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Contact Extraction</span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  60 credits
                </Badge>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-blue-200 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Email Discovery</span>
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  170 credits
                </Badge>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-blue-200 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">Full Company Search</span>
                  <span className="text-xs text-gray-500">(all-in-one)</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  250 credits
                </Badge>
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-red-600" />
                  <span className="font-medium">Individual Email Find</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  20 credits
                </Badge>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h3 className="font-semibold text-lg mb-3">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <strong>Company Discovery (10 credits):</strong> Find companies matching your search criteria. Gets basic company info like name, website, and description.
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <strong>Contact Extraction (60 credits):</strong> Find key decision makers at each company. Gets names, roles, and LinkedIn profiles.
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <strong>Email Discovery (170 credits):</strong> Find verified email addresses for the contacts using multiple professional databases.
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3">Why Credits?</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                • <strong>Pay-per-use:</strong> Only pay for the searches you actually perform
              </p>
              <p>
                • <strong>No subscriptions:</strong> Buy credits when you need them, no monthly fees
              </p>
              <p>
                • <strong>Premium data:</strong> Access to multiple professional databases for accurate results
              </p>
              <p>
                • <strong>Transparent pricing:</strong> Know exactly what each search costs upfront
              </p>
            </div>
          </div>

          {/* Purchase Options */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Ready to get started?</h4>
                <p className="text-sm text-gray-600">1,000 credits for $40 • Perfect for getting started</p>
              </div>
              <Button onClick={onBuyCredits} className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Buy Credits
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}