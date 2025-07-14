import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Package, Wrench, X } from "lucide-react";

interface FormData {
  productService: string;
  customerFeedback: string;
  website: string;
}

export default function Strategy() {
  const [, setLocation] = useLocation();
  const [businessType, setBusinessType] = useState<"product" | "service" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    productService: "",
    customerFeedback: "",
    website: ""
  });

  useEffect(() => {
    // Get business type from URL params
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as "product" | "service";
    if (type) {
      setBusinessType(type);
      setShowForm(true);
    }
  }, []);

  const handleBackToHome = () => {
    setLocation("/");
  };

  const handleBusinessTypeSelect = (type: "product" | "service") => {
    setBusinessType(type);
    setShowForm(true);
    setCurrentStep(1);
  };

  const questions = [
    {
      title: "What is the product/service you sell?",
      subtitle: "Describe it in 1 sentence",
      field: "productService" as keyof FormData,
      type: "textarea",
      placeholder: "Premium coffee machines for small offices…"
    },
    {
      title: "What do customers say they like?",
      subtitle: "What is one thing customers like about your product or the way you sell it?",
      field: "customerFeedback" as keyof FormData,
      type: "textarea",
      placeholder: "Fast delivery and easy setup..."
    },
    {
      title: "Where can we learn more?",
      subtitle: "Do you have a website, or any page online (Etsy, FB, or any link) that explains your product/service?",
      field: "website" as keyof FormData,
      type: "input",
      placeholder: "Example: https://mycompany.com or https://etsy.com/shop/mystore"
    }
  ];

  const currentQuestion = questions[currentStep - 1];
  const currentValue = formData[currentQuestion.field];
  const isValid = currentValue && currentValue.trim().length > 0;

  const handleInputChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      [currentQuestion.field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep === 3) {
      // Form completed - will implement chat next
      console.log("Form completed:", formData);
      setShowForm(false);
      // TODO: Initialize chat with form data
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setCurrentStep(1);
    setFormData({
      productService: "",
      customerFeedback: "",
      website: ""
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={handleBackToHome}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Strategic Planning
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Let's create your 90-day email sales plan.
            </p>
          </div>

          {/* Main Content */}
          <Card className="w-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  What are you selling?
                </h2>
                
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <Button
                    className="h-24 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                    onClick={() => handleBusinessTypeSelect("product")}
                  >
                    <Package className="w-8 h-8" />
                    <span className="font-semibold">Product</span>
                  </Button>
                  <Button
                    className="h-24 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                    onClick={() => handleBusinessTypeSelect("service")}
                  >
                    <Wrench className="w-8 h-8" />
                    <span className="font-semibold">Service</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3-Step Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Let's get to know your business
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Just 3 quick questions to create your strategy
              </p>
              
              {/* Progress dots */}
              <div className="flex justify-center space-x-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full ${
                      step <= currentStep ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {currentQuestion.title}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {currentQuestion.subtitle}
              </p>
              
              {currentQuestion.type === 'textarea' ? (
                <Textarea
                  value={currentValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                  className="min-h-[80px] resize-none"
                />
              ) : (
                <Input
                  value={currentValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                >
                  Back
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                disabled={!isValid}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {currentStep === 3 ? 'Complete' : 'Next'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}