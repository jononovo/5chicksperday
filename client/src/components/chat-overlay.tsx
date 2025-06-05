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
}

type ChatState = 'hidden' | 'minimized' | 'sidebar' | 'fullscreen';
type BusinessType = 'product' | 'service' | null;

interface ChatOverlayProps {
  initialState?: ChatState;
  onStateChange?: (state: ChatState) => void;
}

interface ChatOverlayRef {
  initializeChat: (type: BusinessType) => void;
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

  const initializeChat = (type: BusinessType) => {
    setBusinessType(type);
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: `Hi! I love that you're selling a ${type}! Let's create your strategic sales plan together.

To get started, please tell me about your ${type}. What exactly are you offering, and what makes it special?`,
      sender: 'ai',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    setChatState(isMobile ? 'fullscreen' : 'fullscreen');
  };

  useImperativeHandle(ref, () => ({
    initializeChat
  }));

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: any = await apiRequest('POST', '/api/onboarding/chat', {
        message: inputMessage,
        businessType,
        currentStep,
        profileData,
        conversationHistory: messages
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
          {chatState === 'fullscreen' && !isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatState('sidebar')}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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