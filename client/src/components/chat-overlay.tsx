import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { X, MessageCircle, Send, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isHTML?: boolean;
}

type ChatState = 'hidden' | 'minimized' | 'sidebar' | 'fullscreen';
type BusinessType = 'product' | 'service' | null;

interface ChatOverlayProps {
  initialState?: ChatState;
  onStateChange?: (state: ChatState) => void;
}

interface ChatOverlayRef {
  initializeChat: (type: BusinessType, formData?: any) => void;
}

const ChatOverlay = forwardRef<ChatOverlayRef, ChatOverlayProps>(({ initialState = 'hidden', onStateChange }, ref) => {
  const [chatState, setChatState] = useState<ChatState>(initialState);
  const [businessType, setBusinessType] = useState<BusinessType>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('business_description');
  const [profileData, setProfileData] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    onStateChange?.(chatState);
  }, [chatState, onStateChange]);

  const initializeChat = (type: BusinessType, formData?: any) => {
    setBusinessType(type);
    
    let welcomeMessage: Message;
    
    if (formData) {
      // Store form data for strategy generation immediately
      setProfileData(formData);
      
      // If form data is provided, show personalized message like in the static implementation
      const productService = formData.productService?.trim() || `your ${type}`;
      const customerFeedback = formData.customerFeedback?.trim() || 'positive feedback';
      const website = formData.website?.trim() || 'no website provided';
      
      welcomeMessage = {
        id: Date.now().toString(),
        content: `Perfect!

**Your ${type} is:** ${productService}
**Customers like:** ${customerFeedback}
**And I can learn more at:** ${website !== 'no website provided' ? website : 'no website was provided'}

Give me 5 seconds. I'm **building a product summary** so I can understand what you're selling.`,
        sender: 'ai',
        timestamp: new Date()
      };
    } else {
      // Default welcome message
      welcomeMessage = {
        id: Date.now().toString(),
        content: `Hi! I love that you're selling a ${type}! Let's create your strategic sales plan together.

To get started, please tell me about your ${type}. What exactly are you offering, and what makes it special?`,
        sender: 'ai',
        timestamp: new Date()
      };
    }
    
    setMessages([welcomeMessage]);
    setChatState(isMobile ? 'fullscreen' : 'sidebar');
    
    // Automatically trigger AI response after initial message with form data
    if (formData) {
      setTimeout(() => {
        triggerAIResponse(type, formData);
      }, 2000);
    }
  };

  useImperativeHandle(ref, () => ({
    initializeChat
  }));

  const triggerAIResponse = async (overrideBusinessType?: BusinessType, overrideFormData?: any) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    // Use override values if provided (for initial call), otherwise use state
    const effectiveBusinessType = overrideBusinessType || businessType;
    const effectiveProfileData = overrideFormData || profileData;
    
    // Debug logging
    console.log('triggerAIResponse called with:', {
      businessType: effectiveBusinessType,
      currentStep,
      profileData: effectiveProfileData,
      messagesLength: messages.length
    });
    
    try {
      const response: any = await apiRequest('POST', '/api/onboarding/strategy-chat', {
        userInput: overrideFormData ? "Generate product summary" : "I want to create a strategic plan for my business. Please help me get started.",
        productContext: {
          productService: effectiveProfileData?.productService,
          customerFeedback: effectiveProfileData?.customerFeedback,
          website: effectiveProfileData?.website
        },
        conversationHistory: messages
      });

      // Handle report types just like static implementation
      if (response.type === 'product_summary' || response.type === 'email_strategy' || response.type === 'sales_approach') {
        displayReport(response);
      } else if (response.type === 'progressive_strategy') {
        // Handle progressive strategy generation
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: response.message,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // TODO: Implement progressive strategy generation if needed
      } else if (response.type === 'conversation') {
        // Handle conversation messages (like refinement requests)
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: response.message,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else if (response.aiResponse) {
        // Fallback for old format
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.aiResponse,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }

      if (response.profileUpdate) {
        setProfileData((prev: any) => ({ ...prev, ...response.profileUpdate }));
      }

      if (response.nextStep) {
        setCurrentStep(response.nextStep);
      }

    } catch (error) {
      console.error('Error triggering AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble processing your message right now. Please try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: any = await apiRequest('POST', '/api/onboarding/chat', {
        message: currentInput,
        businessType: businessType || 'product', // Ensure businessType is not null
        currentStep,
        profileData,
        conversationHistory: [...messages, userMessage]
      });

      if (response.aiResponse) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.aiResponse,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }

      if (response.profileUpdate) {
        setProfileData((prev: any) => ({ ...prev, ...response.profileUpdate }));
      }

      if (response.nextStep) {
        setCurrentStep(response.nextStep);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble processing your message right now. Please try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStateChange = (newState: ChatState) => {
    setChatState(newState);
  };

  const handleClose = () => {
    if (chatState === 'fullscreen') {
      setChatState(isMobile ? 'minimized' : 'sidebar');
    } else if (chatState === 'sidebar') {
      setChatState('minimized');
    } else {
      setChatState('hidden');
    }
  };

  const handleMaximize = () => {
    setChatState('fullscreen');
  };

  const handleReopen = () => {
    setChatState(isMobile ? 'fullscreen' : 'sidebar');
  };

  // Markdown rendering function copied from static implementation
  const renderMarkdown = (markdown: string) => {
    // Simple markdown to HTML conversion
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

  // Display report function copied exactly from static implementation
  const displayReport = (reportData: any) => {
    console.log('displayReport called with:', reportData);
    console.log('reportData.data:', reportData.data);
    console.log('reportData.data.content:', reportData.data?.content);
    
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
    
    console.log('Adding report message:', reportMessage);
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

  // Hidden state
  if (chatState === 'hidden') {
    return null;
  }

  // Minimized state - just an icon
  if (chatState === 'minimized') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleReopen}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  // Chat content component
  const ChatContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Strategic Planning Assistant</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {businessType ? `Creating your ${businessType} strategy` : 'Ready to help'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {chatState === 'fullscreen' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatState('sidebar')}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="Switch to sidebar view"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          )}
          {chatState === 'sidebar' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMaximize}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              title="Switch to fullscreen view"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title="Close chat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {message.isHTML ? (
                <div 
                  className="text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Fullscreen state
  if (chatState === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900">
        <ChatContent />
      </div>
    );
  }

  // Sidebar state (desktop only)
  if (chatState === 'sidebar') {
    return (
      <div className="fixed top-0 right-0 w-96 h-full z-50 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl">
        <ChatContent />
      </div>
    );
  }

  return null;
});

export default ChatOverlay;

// Global function to initialize chat from HTML
export const initializeChatOverlay = (type: 'product' | 'service') => {
  const event = new CustomEvent('initializeChat', { detail: { type } });
  window.dispatchEvent(event);
};