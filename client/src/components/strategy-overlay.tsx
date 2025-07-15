import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Target, Minimize2, Maximize2 } from "lucide-react";
import "@/components/ui/loading-spinner.css";

interface FormData {
  productService: string;
  customerFeedback: string;
  website: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isHTML?: boolean;
  isLoading?: boolean;
}

export type OverlayState = 'hidden' | 'minimized' | 'sidebar' | 'fullscreen';

interface StrategyOverlayProps {
  state: OverlayState;
  onStateChange: (state: OverlayState) => void;
}

export function StrategyOverlay({ state, onStateChange }: StrategyOverlayProps) {
  const [businessType, setBusinessType] = useState<"product" | "service" | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    productService: "",
    customerFeedback: "",
    website: ""
  });
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [boundarySelectionMode, setBoundarySelectionMode] = useState(false);
  const [boundarySelectionContext, setBoundarySelectionContext] = useState<any>(null);
  const [customBoundaryInput, setCustomBoundaryInput] = useState("");
  const [salesApproachContext, setSalesApproachContext] = useState<any>(null);

  // Boundary selection functions - moved before useEffect that references them
  const selectBoundaryOption = async (optionIndex: number) => {
    if (!boundarySelectionContext || !boundarySelectionMode) return;
    const selectedBoundary = boundarySelectionContext.options[optionIndex];
    await confirmBoundarySelection(selectedBoundary, null);
  };

  const selectCustomBoundary = async () => {
    if (!customBoundaryInput.trim()) return;
    await confirmBoundarySelection(null, customBoundaryInput.trim());
  };

  const updateCustomBoundaryInput = (value: string) => {
    setCustomBoundaryInput(value);
  };

  const confirmBoundarySelection = async (selectedOption: string | null, customBoundary: string | null) => {
    try {
      setBoundarySelectionMode(false);
      
      const loadingMessage: Message = {
        id: Date.now().toString(),
        content: "Confirming your boundary selection...",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, loadingMessage]);
      setIsLoading(true);

      const confirmResponse = await fetch('/api/strategy/boundary/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption,
          customBoundary,
          productContext: boundarySelectionContext.productContext
        })
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm boundary selection');
      }

      const result = await confirmResponse.json();
      
      setIsLoading(false);
      setMessages(prev => prev.filter(msg => msg.content !== "Confirming your boundary selection..."));
      
      const confirmMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.message || "Boundary selection confirmed!",
        sender: 'ai',
        timestamp: new Date(),
        isHTML: true
      };
      setMessages(prev => [...prev, confirmMessage]);
      
      if (result.salesApproachContext) {
        setSalesApproachContext(result.salesApproachContext);
      }
      
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => prev.filter(msg => msg.content !== "Confirming your boundary selection..."));
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: "Sorry, there was an error confirming your selection. Please try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Auto-switch between sidebar and fullscreen based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (state === 'sidebar' || state === 'fullscreen') {
        const newState = window.innerWidth < 768 ? 'fullscreen' : 'sidebar';
        if (newState !== state) {
          onStateChange(newState);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state, onStateChange]);

  // Initialize business type from URL params when overlay opens
  useEffect(() => {
    if (state !== 'hidden' && state !== 'minimized') {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type") as "product" | "service";
      if (type) {
        setBusinessType(type);
      }
    }
  }, [state]);

  // Set up global window functions for boundary selection (same as original)
  useEffect(() => {
    (window as any).selectBoundaryOption = selectBoundaryOption;
    (window as any).selectCustomBoundary = selectCustomBoundary;
    (window as any).updateCustomBoundaryInput = updateCustomBoundaryInput;
    (window as any).generateSalesApproach = generateSalesApproach;
    
    return () => {
      delete (window as any).selectBoundaryOption;
      delete (window as any).selectCustomBoundary;
      delete (window as any).updateCustomBoundaryInput;
      delete (window as any).generateSalesApproach;
    };
  }, [boundarySelectionContext, boundarySelectionMode, customBoundaryInput]);

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

  // All the existing strategy.tsx functions (unchanged)
  const handleStrategyChatMessage = async (userInput: string) => {
    try {
      console.log('Processing strategy chat with input:', userInput);
      
      const response = await fetch('/api/onboarding/strategy-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userInput: userInput,
          productContext: {
            productService: formData.productService,
            customerFeedback: formData.customerFeedback,
            website: formData.website
          },
          conversationHistory: messages
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Strategy chat response:', data);
        
        if (data.type === 'product_summary' || data.type === 'email_strategy' || data.type === 'sales_approach') {
          displayReport(data);
        } else if (data.type === 'progressive_strategy') {
          const aiMessage: Message = {
            id: Date.now().toString(),
            content: renderMarkdown(data.message),
            sender: 'ai',
            timestamp: new Date(),
            isHTML: true
          };
          setMessages(prev => [...prev, aiMessage]);
          
          setTimeout(async () => {
            await handleProgressiveStrategy(data.initialTarget, data.refinedTarget);
          }, 500);
        } else if (data.type === 'conversation') {
          const aiMessage: Message = {
            id: Date.now().toString(),
            content: renderMarkdown(data.message),
            sender: 'ai',
            timestamp: new Date(),
            isHTML: true
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Strategy chat error:', error);
    }
  };

  const handleProgressiveStrategy = async (initialTarget: string, refinedTarget: string) => {
    try {
      const productContext = {
        productService: formData.productService,
        customerFeedback: formData.customerFeedback,
        website: formData.website
      };

      if (!productContext.productService || !productContext.customerFeedback || !productContext.website) {
        console.error('Missing product context:', {
          productService: !!productContext.productService,
          customerFeedback: !!productContext.customerFeedback,
          website: !!productContext.website
        });
        
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: "I need your product information to create the strategy. Let me restart the process.",
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      const loadingMessage: Message = {
        id: Date.now().toString(),
        content: "Analyzing your market scope...",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, loadingMessage]);
      
      console.log('Calling boundary API with:', { initialTarget, refinedTarget, productContext });
      
      const boundaryResponse = await fetch('/api/strategy/boundary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialTarget, refinedTarget, productContext })
      });

      if (boundaryResponse.ok) {
        const boundaryData = await boundaryResponse.json();
        
        if (boundaryData.type === 'boundary_options') {
          console.log('Boundary data received:', boundaryData);
          console.log('About to display boundary options...');
          displayBoundaryOptions(boundaryData, productContext, initialTarget, refinedTarget);
          console.log('Boundary options displayed, returning to wait for selection');
          return;
        } else {
          displayReport(boundaryData);
          console.log('Boundary step completed:', boundaryData);
        }
      } else {
        console.error('Boundary API failed:', boundaryResponse.status, await boundaryResponse.text());
        throw new Error(`Boundary generation failed: ${boundaryResponse.status}`);
      }
    } catch (error) {
      console.error('Error in progressive strategy:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "There was an error generating your strategy. Let me try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const displayBoundaryOptions = (boundaryData: any, productContext: any, initialTarget: string, refinedTarget: string) => {
    console.log('Displaying boundary options:', boundaryData);
    
    setBoundarySelectionContext({
      options: boundaryData.content,
      productContext,
      initialTarget,
      refinedTarget
    });
    setBoundarySelectionMode(true);

    const boundaryHtml = `
      <div class="boundary-options bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
        <h3 class="font-bold text-lg text-blue-800 mb-1">First we need to agree on a high-level market segment.</h3>
        <p class="text-sm text-blue-600 mb-3">Within this we will target ~700 companies across 6 sprints. Please choose your preferred approach:</p>
        <div class="options-list space-y-3 mb-4">
          ${boundaryData.content.map((option: string, index: number) => `
            <div class="option-item p-3 bg-white border border-gray-200 rounded cursor-pointer hover:border-blue-400 transition-colors" 
                 onclick="window.selectBoundaryOption && window.selectBoundaryOption(${index})">
              <strong>${index + 1}.</strong> ${option}
            </div>
          `).join('')}
        </div>
        <div class="custom-input-section">
          <p class="text-sm text-gray-600 mb-2">Or add your own:</p>
          <div class="flex gap-2">
            <input type="text" id="customBoundaryInput" placeholder="Your high-level target segment..." 
                   class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                   style="border: 1px solid #e5e7eb !important;"
                   value="${customBoundaryInput}"
                   oninput="window.updateCustomBoundaryInput && window.updateCustomBoundaryInput(this.value)">
            <button onclick="window.selectCustomBoundary && window.selectCustomBoundary()" 
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Use This
            </button>
          </div>
        </div>
      </div>`;
    
    const boundaryMessage: Message = {
      id: Date.now().toString(),
      content: boundaryHtml,
      sender: 'ai',
      timestamp: new Date(),
      isHTML: true
    };
    
    setMessages(prev => [...prev, boundaryMessage]);
  };

  const displayReport = (reportData: any) => {
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    
    const reportHtml = `
      <div class="report-container bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
        <h3 class="font-bold text-lg text-blue-800 mb-2">${reportData.message}</h3>
        <div class="report-content text-gray-700">
          ${renderMarkdown(reportData.data.content)}
        </div>
      </div>`;
    
    const reportMessage: Message = {
      id: Date.now().toString(),
      content: reportHtml,
      sender: 'ai',
      timestamp: new Date(),
      isHTML: true
    };
    
    setMessages(prev => [...prev, reportMessage]);

    if (reportData.type === 'product_summary') {
      setTimeout(() => {
        const followUpMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: renderMarkdown("Oh, that's classy. 😉\nNow please give me **an example of a type of business you service** or sell to.\nLike this \"[type of business] in [city/niche]\"\n\nExamples:\n\n**Popular cafes** in Lower East Side, NYC\n\n**Real-estate insurance brokers** in Salt Lake City"),
          sender: 'ai',
          timestamp: new Date(),
          isHTML: true
        };
        setMessages(prev => [...prev, followUpMessage]);
      }, 1000);
    }
  };

  const renderMarkdown = (markdown: string) => {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-blue-700 mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-blue-800 mt-4 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-blue-900 mt-4 mb-4">$1</h1>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4"><strong>$1.</strong> $2</li>')
      .replace(/\n/g, '<br>');
  };



  const generateSalesApproach = async () => {
    try {
      const loadingMessage: Message = {
        id: Date.now().toString(),
        content: "Creating your marketing context document...",
        sender: 'ai',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);
      
      const response = await fetch('/api/onboarding/strategy-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: 'Generate sales approach',
          productContext: {
            productService: formData?.productService,
            customerFeedback: formData?.customerFeedback,
            website: formData?.website
          },
          conversationHistory: messages.map(m => ({
            sender: m.sender,
            content: m.content
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        displayReport(data);
        
        setTimeout(() => {
          const currentDomain = window.location.origin;
          const finalMessage: Message = {
            id: Date.now().toString(),
            content: `Excellent! Your complete sales strategy is ready.<br><br>Go to <a href="${currentDomain}/app" target="_blank" style="color: #3b82f6; text-decoration: underline;">${currentDomain}/app</a> to start prospecting or get the PDF version.`,
            sender: 'ai',
            timestamp: new Date(),
            isHTML: true
          };
          setMessages(prev => [...prev, finalMessage]);
        }, 1000);
      }
    } catch (error) {
      console.error('Sales approach generation error:', error);
    }
  };

  const handleBusinessTypeSelection = (type: "product" | "service") => {
    setBusinessType(type);
    console.log('Business type selected:', type);
  };

  const handleNext = () => {
    if (currentStep === 3) {
      console.log('Form completed:', formData);
      
      const productService = formData.productService?.trim() || 'your offering';
      const customerFeedback = formData.customerFeedback?.trim() || 'positive feedback';
      const website = formData.website?.trim() || 'no website provided';
      
      const personalizedMessage = `Perfect!

**Your ${businessType} is:** ${productService}
**Customers like:** ${customerFeedback}
**And I can learn more at:** ${website !== 'no website provided' ? website : 'no website was provided'}

Give me 5 seconds. I'm **building a product summary** so I can understand what you're selling.`;

      const welcomeMessage: Message = {
        id: Date.now().toString(),
        content: renderMarkdown(personalizedMessage),
        sender: 'ai',
        timestamp: new Date(),
        isHTML: true
      };
      
      setMessages([welcomeMessage]);
      setShowChat(true);
      
      setIsLoading(true);
      setTimeout(async () => {
        await handleStrategyChatMessage('Generate product summary');
        setIsLoading(false);
      }, 100);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setUserInput("");

    try {
      await handleStrategyChatMessage(userInput);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    onStateChange('minimized');
  };

  const handleMinimize = () => {
    onStateChange('minimized');
  };

  const handleMaximize = () => {
    onStateChange('fullscreen');
  };

  // Don't render anything if hidden
  if (state === 'hidden') {
    return null;
  }

  // Render floating button if minimized
  if (state === 'minimized') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => onStateChange(window.innerWidth < 768 ? 'fullscreen' : 'sidebar')}
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
          size="sm"
        >
          <Target className="h-6 w-6 text-white" />
        </Button>
      </div>
    );
  }

  // Render overlay content for sidebar or fullscreen
  const isFullscreen = state === 'fullscreen';
  const isSidebar = state === 'sidebar';

  return (
    <>
      {/* Backdrop for fullscreen */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
      )}
      
      {/* Overlay Container */}
      <div className={`fixed z-50 bg-white shadow-2xl transition-all duration-300 ${
        isFullscreen 
          ? 'inset-0 rounded-none' 
          : 'top-4 right-4 w-96 h-[600px] border border-gray-200 rounded-lg'
      } overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Strategy Assistant</h2>
              <p className="text-sm text-gray-600">Building your sales strategy</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isSidebar && (
              <>
                <Button variant="ghost" size="sm" onClick={handleMaximize}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleMinimize}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {!showChat ? (
            /* Form Section */
            <div className="flex-1 overflow-y-auto p-6">
              {!businessType ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Let's get started!</h3>
                  <p className="text-sm text-gray-600">What are you selling?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleBusinessTypeSelection("product")}
                      className="h-16 flex flex-col items-center justify-center space-y-2"
                    >
                      <span className="text-lg">📦</span>
                      <span>Product</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleBusinessTypeSelection("service")}
                      className="h-16 flex flex-col items-center justify-center space-y-2"
                    >
                      <span className="text-lg">🛠️</span>
                      <span>Service</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="flex justify-center space-x-2 mb-4">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step <= currentStep
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600">Step {currentStep} of 3</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {currentQuestion.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {currentQuestion.subtitle}
                      </p>
                      {currentQuestion.type === 'textarea' ? (
                        <Textarea
                          value={currentValue}
                          onChange={(e) => handleInputChange(e.target.value)}
                          placeholder={currentQuestion.placeholder}
                          className="min-h-[100px] resize-none"
                        />
                      ) : (
                        <Input
                          value={currentValue}
                          onChange={(e) => handleInputChange(e.target.value)}
                          placeholder={currentQuestion.placeholder}
                        />
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentStep === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={handleNext}
                        disabled={!isValid}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {currentStep === 3 ? 'Start Strategy' : 'Next'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chat Section */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.isHTML ? (
                        <div dangerouslySetInnerHTML={{ __html: message.content }} />
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="text-sm text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t p-4 flex-shrink-0">
                <div className="flex space-x-2">
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}