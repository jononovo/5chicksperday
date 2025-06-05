import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ChatOverlay from '@/components/chat-overlay';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ChatEmbedApp() {
  const [chatState, setChatState] = useState<'hidden' | 'minimized' | 'sidebar' | 'fullscreen'>('hidden');
  const chatOverlayRef = React.useRef<any>(null);

  useEffect(() => {
    // Listen for chat initialization from HTML page
    const handleInitializeChat = (event: CustomEvent) => {
      const { type } = event.detail;
      if (chatOverlayRef.current) {
        chatOverlayRef.current.initializeChat(type);
      }
    };

    window.addEventListener('initializeChat', handleInitializeChat as EventListener);

    // Global function for HTML to call
    (window as any).openChat = (type: 'product' | 'service') => {
      const event = new CustomEvent('initializeChat', { detail: { type } });
      window.dispatchEvent(event);
    };

    return () => {
      window.removeEventListener('initializeChat', handleInitializeChat as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ChatOverlay 
        ref={chatOverlayRef}
        initialState={chatState}
        onStateChange={setChatState}
      />
    </QueryClientProvider>
  );
}

// Initialize the chat embed when DOM is ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Create container for chat overlay
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-overlay-root';
    document.body.appendChild(chatContainer);

    // Mount React app
    const root = createRoot(chatContainer);
    root.render(<ChatEmbedApp />);
  });
}