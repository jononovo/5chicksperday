import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Send, 
  User, 
  Bot, 
  ArrowLeft,
  CheckCircle,
  Target,
  Users,
  Lightbulb
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface OnboardingStep {
  id: string;
  title: string;
  completed: boolean;
  data?: any;
}

export default function Planning() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [businessType, setBusinessType] = useState<"product" | "service" | null>(null);
  const [currentStep, setCurrentStep] = useState("business_description");
  const [profileData, setProfileData] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Boundary selection states
  const [boundarySelectionMode, setBoundarySelectionMode] = useState(false);
  const [boundaryOptions, setBoundaryOptions] = useState<string[]>([]);
  const [selectedBoundaryIndex, setSelectedBoundaryIndex] = useState<number | null>(null);
  const [customBoundaryInput, setCustomBoundaryInput] = useState("");
  const [boundaryProductContext, setBoundaryProductContext] = useState<any>(null);

  const steps: OnboardingStep[] = [
    { id: "business_description", title: "Business Description", completed: false },
    { id: "unique_attributes", title: "Unique Attributes", completed: false },
    { id: "target_customers", title: "Target Customers", completed: false },
    { id: "market_positioning", title: "Market Positioning", completed: false },
    { id: "strategic_plan", title: "Strategic Plan", completed: false }
  ];

  useEffect(() => {
    // Get business type from URL params
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as "product" | "service";
    if (type) {
      setBusinessType(type);
      initializeChat(type);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initializeChat = (type: "product" | "service") => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: `Hi! I love that you're selling a ${type}! Let's create your strategic sales plan. 

To get started, please tell me about your ${type}. What exactly are you offering, and what makes it special?`,
      sender: "ai",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Handle boundary selection mode
      if (boundarySelectionMode) {
        const trimmedInput = currentInput.trim();
        
        // Check if user entered a number (1, 2, or 3)
        const selectedNumber = parseInt(trimmedInput);
        if (selectedNumber >= 1 && selectedNumber <= 3 && selectedNumber <= boundaryOptions.length) {
          const selectedBoundary = boundaryOptions[selectedNumber - 1];
          
          // Call boundary confirmation API
          const confirmResponse = await apiRequest("POST", "/api/strategy/boundary/confirm", {
            selectedOption: selectedBoundary,
            productContext: boundaryProductContext
          });
          
          const confirmMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `Perfect! I've confirmed your target boundary: "${confirmResponse.content}"`,
            sender: "ai",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, confirmMessage]);
          
          // Reset boundary selection mode
          setBoundarySelectionMode(false);
          setBoundaryOptions([]);
          setSelectedBoundaryIndex(null);
          
        } else {
          // User provided custom boundary
          const confirmResponse = await apiRequest("POST", "/api/strategy/boundary/confirm", {
            customBoundary: trimmedInput,
            productContext: boundaryProductContext
          });
          
          const confirmMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `Great! I've refined your custom boundary to: "${confirmResponse.content}"`,
            sender: "ai",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, confirmMessage]);
          
          // Reset boundary selection mode
          setBoundarySelectionMode(false);
          setBoundaryOptions([]);
          setCustomBoundaryInput("");
        }
        
        setIsLoading(false);
        return;
      }

      // Regular onboarding chat flow
      const response: any = await apiRequest("POST", "/api/onboarding/chat", {
        message: currentInput,
        businessType,
        currentStep,
        profileData,
        conversationHistory: messages
      });

      // Handle boundary options response
      if (response.type === 'boundary_options') {
        setBoundaryOptions(response.content);
        setBoundaryProductContext(response.productContext || profileData);
        setBoundarySelectionMode(true);
        
        const optionsMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `${response.description}\n\n${response.content.map((option: string, index: number) => `${index + 1}. ${option}`).join('\n\n')}\n\nPlease type the number of the one you prefer, or just write your own below and we can use that.`,
          sender: "ai",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, optionsMessage]);
      } else if (response.aiResponse) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.aiResponse,
          sender: "ai",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }

      // Update profile data and step if provided
      if (response.profileUpdate) {
        setProfileData((prev: any) => ({ ...prev, ...response.profileUpdate }));
      }

      if (response.nextStep) {
        setCurrentStep(response.nextStep);
      }

      // If onboarding is complete, redirect to generate search prompts
      if (response.completed) {
        toast({
          title: "Strategic Plan Complete!",
          description: "Your personalized sales strategy is ready. Generating search prompts...",
        });
        
        setTimeout(() => {
          setLocation("/app");
        }, 2000);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble processing your message right now. Please try again.",
        sender: "ai",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStepProgress = () => {
    const currentStepIndex = steps.findIndex(step => step.id === currentStep);
    return Math.round(((currentStepIndex + 1) / steps.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h1 className="text-lg font-semibold">Strategic Planning</h1>
                {businessType && (
                  <Badge variant="outline" className="capitalize">
                    {businessType}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">{getStepProgress()}% Complete</span>
              <div className="w-20 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-blue-600 rounded-full transition-all"
                  style={{ width: `${getStepProgress()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {steps.map((step, index) => {
                  const isCurrentStep = step.id === currentStep;
                  const isPastStep = steps.findIndex(s => s.id === currentStep) > index;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                        isCurrentStep 
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" 
                          : isPastStep
                          ? "bg-green-50 dark:bg-green-900/20"
                          : "bg-gray-50 dark:bg-gray-800/50"
                      }`}
                    >
                      {isPastStep ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          isCurrentStep 
                            ? "border-blue-600 bg-blue-600" 
                            : "border-gray-300"
                        }`} />
                      )}
                      <span className={`text-sm ${
                        isCurrentStep ? "font-medium text-blue-900 dark:text-blue-100" : ""
                      }`}>
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Profile Summary */}
            {Object.keys(profileData).length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Profile Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {profileData.businessDescription && (
                    <div>
                      <h4 className="text-sm font-medium">Business</h4>
                      <p className="text-xs text-muted-foreground">{profileData.businessDescription}</p>
                    </div>
                  )}
                  {profileData.uniqueAttributes && (
                    <div>
                      <h4 className="text-sm font-medium">Key Attributes</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profileData.uniqueAttributes.slice(0, 3).map((attr: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {attr}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  Strategic Planning Assistant
                </CardTitle>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-4 pr-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.sender === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          <div className="flex items-start space-x-2">
                            {message.sender === "ai" && (
                              <Bot className="w-4 h-4 mt-1 text-blue-600" />
                            )}
                            {message.sender === "user" && (
                              <User className="w-4 h-4 mt-1 text-white" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <span className="text-xs opacity-70 mt-1 block">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <Bot className="w-4 h-4 text-blue-600" />
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="flex space-x-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your response..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-4"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}