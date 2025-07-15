import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

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
}

export default function Strategy() {
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

  useEffect(() => {
    // Get business type from URL params
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as "product" | "service";
    if (type) {
      setBusinessType(type);
    }
  }, []);

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

  // Copied from static implementation
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

  // Copied from static implementation
  const displayReport = (reportData: any) => {
    console.log('DEBUG: displayReport called with:', reportData);
    
    const reportHtml = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
        <h3 class="font-bold text-lg text-blue-800 mb-2">${reportData.message}</h3>
        <div class="text-gray-700">
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

    // Add target business query after product summary
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

  // Copied from static implementation
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
        
        // Handle report types exactly like static implementation
        if (data.type === 'product_summary' || data.type === 'email_strategy' || data.type === 'sales_approach') {
          displayReport(data);
        } else if (data.type === 'progressive_strategy') {
          // Handle progressive strategy generation exactly like static
          const aiMessage: Message = {
            id: Date.now().toString(),
            content: renderMarkdown(data.message),
            sender: 'ai',
            timestamp: new Date(),
            isHTML: true
          };
          setMessages(prev => [...prev, aiMessage]);
          
          // Trigger progressive strategy generation after 500ms like static
          setTimeout(async () => {
            await generateProgressiveStrategy(data.initialTarget, data.refinedTarget);
          }, 500);
          
        } else if (data.type === 'conversation') {
          // Handle conversation messages
          const aiMessage: Message = {
            id: Date.now().toString(),
            content: data.message,
            sender: 'ai',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
        }
        
        return data;
      } else {
        console.warn('Strategy chat failed:', response.status);
        return { type: 'conversation', response: "Let me help you create your sales strategy. Could you be more specific about your target market?" };
      }
    } catch (error) {
      console.error('Error in strategy chat:', error);
      return { type: 'conversation', response: "Let's work with what you have. Could you be a bit more specific about your target market?" };
    }
  };

  // Copied from static implementation
  const generateProgressiveStrategy = async (initialTarget: string, refinedTarget: string) => {
    try {
      console.log('Progressive strategy called with:', { 
        initialTarget, 
        refinedTarget, 
        formDataExists: !!formData,
        formData: formData 
      });

      const productContext = {
        productService: formData?.productService,
        customerFeedback: formData?.customerFeedback,
        website: formData?.website
      };

      // Validate all required parameters
      if (!initialTarget || !refinedTarget || !productContext.productService || !productContext.customerFeedback || !productContext.website) {
        console.error('Missing required parameters for progressive strategy:', {
          initialTarget: !!initialTarget,
          refinedTarget: !!refinedTarget,
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

      // Step 1: Generate Boundary Options
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
          // Display interactive boundary selection
          console.log('Boundary data received:', boundaryData);
          console.log('About to display boundary options...');
          displayBoundaryOptions(boundaryData, productContext, initialTarget, refinedTarget);
          console.log('Boundary options displayed, returning to wait for selection');
          return; // Wait for user selection
        } else {
          // Legacy single boundary response - display as report
          displayReport(boundaryData);
          console.log('Boundary step completed:', boundaryData);
        }
      } else {
        console.error('Boundary API failed:', boundaryResponse.status, await boundaryResponse.text());
        throw new Error(`Boundary generation failed: ${boundaryResponse.status}`);
      }

      // TODO: Continue with sprint and queries steps as needed

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

  // Copied from static implementation - Fixed for React
  const displayBoundaryOptions = (boundaryData: any, productContext: any, initialTarget: string, refinedTarget: string) => {
    console.log('Displaying boundary options:', boundaryData);
    
    // Create boundary options HTML exactly like static but for React
    const boundaryHtml = `
      <div class="boundary-options-container bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
        <h3 class="font-bold text-lg text-blue-800 mb-2">${boundaryData.title || 'Target Boundary Options'}</h3>
        <p class="text-sm text-gray-600 mb-3">${boundaryData.description || 'Choose your preferred approach:'}</p>
        <div class="boundary-options space-y-2">
          ${boundaryData.content.map((option: string, index: number) => `
            <button 
              class="boundary-option-btn w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onclick="window.selectBoundaryOption && window.selectBoundaryOption(${index}, '${option.replace(/'/g, "\\'")}', '${initialTarget.replace(/'/g, "\\'")}', '${refinedTarget.replace(/'/g, "\\'")}')">
              <div class="font-medium text-gray-900">${option}</div>
            </button>
          `).join('')}
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

  const handleBusinessTypeSelection = (type: "product" | "service") => {
    setBusinessType(type);
    console.log('Business type selected:', type);
  };

  const handleNext = () => {
    if (currentStep === 3) {
      // Form completed - start chat exactly like static implementation
      console.log('Form completed:', formData);
      
      const productService = formData.productService?.trim() || 'your offering';
      const customerFeedback = formData.customerFeedback?.trim() || 'positive feedback';
      const website = formData.website?.trim() || 'no website provided';
      
      const personalizedMessage = `Perfect!

**Your ${businessType} is:** ${productService}
**Customers like:** ${customerFeedback}
**And I can learn more at:** ${website !== 'no website provided' ? website : 'no website was provided'}

Give me 5 seconds. I'm **building a product summary** so I can understand what you're selling.`;

      // Add personalized message exactly like static implementation
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        content: renderMarkdown(personalizedMessage),
        sender: 'ai',
        timestamp: new Date(),
        isHTML: true
      };
      
      setMessages([welcomeMessage]);
      setShowChat(true);
      
      // Show loading and trigger product summary generation exactly like static
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

  const handleCancel = () => {
    window.history.back();
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

  // Show initial Product/Service selection screen if no business type selected
  if (!businessType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto text-center font-light">
            <span>Let's create your 90-day email sales plan.<br />
            What are you selling?</span>
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => handleBusinessTypeSelection('product')}
              className="h-24 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all duration-300 border-none outline-none"
            >
              <div className="text-2xl">📦</div>
              <span className="font-semibold">Product</span>
            </button>
            <button
              onClick={() => handleBusinessTypeSelection('service')}
              className="h-24 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all duration-300 border-none outline-none"
            >
              <div className="text-2xl">🛠️</div>
              <span className="font-semibold">Service</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showChat) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">AI</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Strategy Assistant</h3>
              <p className="text-sm text-gray-500">Building your sales strategy</p>
            </div>
          </div>
          <button 
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.sender === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {message.isHTML ? (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Form Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Let's get to know your business</h2>
          <p className="text-sm text-gray-600 mt-1">Just 3 quick questions to create your strategy</p>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`w-8 h-2 rounded-full ${
                  step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {currentQuestion.title}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {currentQuestion.subtitle}
            </p>
          </div>

          {currentQuestion.type === 'textarea' ? (
            <Textarea
              value={currentValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              className="min-h-[100px] mb-6"
            />
          ) : (
            <Input
              value={currentValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              className="mb-6"
            />
          )}

          {/* Form Actions */}
          <div className="flex gap-3">
            {currentStep > 1 ? (
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                className="flex-1"
              >
                Back
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            
            <Button 
              onClick={handleNext}
              disabled={!isValid}
              className="flex-1"
            >
              {currentStep === 3 ? 'Complete' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}