import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Strategy() {
  const [, setLocation] = useLocation();
  const [businessType, setBusinessType] = useState<"product" | "service" | null>(null);

  useEffect(() => {
    // Get business type from URL params
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as "product" | "service";
    if (type) {
      setBusinessType(type);
    }
  }, []);

  const handleBackToHome = () => {
    setLocation("/");
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
              {businessType ? `Creating your ${businessType} strategy` : 'Loading...'}
            </p>
          </div>

          {/* Main Content */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>
                {businessType ? `${businessType.charAt(0).toUpperCase() + businessType.slice(1)} Strategy` : 'Strategy Planning'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Strategy page is loading for: {businessType || 'unknown type'}
                </p>
                <p className="text-sm text-slate-500">
                  3-step form will be implemented here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}