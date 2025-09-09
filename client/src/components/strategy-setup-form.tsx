import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";

interface StrategySetupFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StrategySetupForm({ open, onClose, onSuccess }: StrategySetupFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    businessType: 'product',
    description: '',
    uniqueValue: '',
    websiteUrl: ''
  });

  const handleNext = () => {
    if (step === 1 && !formData.businessType) {
      toast({
        title: "Selection Required",
        description: "Please select whether you offer a product or service",
        variant: "destructive"
      });
      return;
    }
    if (step === 2 && !formData.description.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide a brief description of your offering",
        variant: "destructive"
      });
      return;
    }
    if (step === 3 && !formData.uniqueValue.trim()) {
      toast({
        title: "Value Proposition Required",
        description: "Please describe what makes your offering unique",
        variant: "destructive"
      });
      return;
    }
    
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.websiteUrl.trim()) {
      toast({
        title: "Website Required",
        description: "Please provide a website URL for more information",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get auth token for API request
      const token = localStorage.getItem('authToken');
      
      // Create strategic profile using the existing endpoint structure
      const response = await fetch('/api/strategic-profiles/save-from-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          businessType: formData.businessType,
          businessDescription: formData.description,
          productService: formData.description, // What they sell
          customerFeedback: formData.uniqueValue, // What customers say
          website: formData.websiteUrl,
          targetCustomers: `Businesses looking for ${formData.businessType === 'product' ? 'products' : 'services'} that ${formData.uniqueValue}`,
          status: 'completed'
        }),
      });

      if (!response.ok) throw new Error('Failed to create strategic profile');

      toast({
        title: "Strategy Created!",
        description: "Your email strategy is now active. Generating your first batch...",
      });

      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: "Failed to create your email strategy. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Start Your Email Strategy
          </DialogTitle>
          <DialogDescription>
            Step {step} of 4 - Let's personalize your outreach emails
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress bar */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Product or Service */}
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base">What do you offer?</Label>
              <RadioGroup
                value={formData.businessType}
                onValueChange={(value) => setFormData({ ...formData, businessType: value })}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="product" id="product" />
                  <Label htmlFor="product" className="cursor-pointer flex-1">
                    <div className="font-medium">Product</div>
                    <div className="text-sm text-muted-foreground">
                      Physical or digital products that customers purchase
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="service" id="service" />
                  <Label htmlFor="service" className="cursor-pointer flex-1">
                    <div className="font-medium">Service</div>
                    <div className="text-sm text-muted-foreground">
                      Professional services or consulting you provide
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Description */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description" className="text-base">
                  Describe your {formData.businessType} in one line
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Be specific but concise - this helps personalize your emails
                </p>
              </div>
              <Textarea
                id="description"
                placeholder={formData.businessType === 'product' 
                  ? "e.g., AI-powered project management software for remote teams"
                  : "e.g., SEO consulting for B2B SaaS companies"}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          )}

          {/* Step 3: Unique Value */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="uniqueValue" className="text-base">
                  What do people love about your {formData.businessType}?
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  What makes you different from competitors?
                </p>
              </div>
              <Textarea
                id="uniqueValue"
                placeholder="e.g., Saves 10 hours per week with automated workflows, or 300% ROI within 6 months"
                value={formData.uniqueValue}
                onChange={(e) => setFormData({ ...formData, uniqueValue: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          )}

          {/* Step 4: Website URL */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="websiteUrl" className="text-base">
                  Where can people learn more?
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Provide a URL with more information about your {formData.businessType}
                </p>
              </div>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://www.yourwebsite.com"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              />
              
              {/* Summary */}
              <div className="bg-purple-50 p-4 rounded-lg space-y-2">
                <div className="text-sm font-medium text-purple-900">Summary</div>
                <div className="text-sm text-purple-700 space-y-1">
                  <div><strong>Type:</strong> {formData.businessType === 'product' ? 'Product' : 'Service'}</div>
                  <div><strong>Description:</strong> {formData.description}</div>
                  <div><strong>Value:</strong> {formData.uniqueValue}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            
            {step < 4 ? (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Strategy...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Strategy
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}