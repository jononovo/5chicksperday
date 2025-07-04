import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface EmailProvider {
  id: string;
  userId: number;
  type: 'gmail' | 'outlook' | 'smtp';
  displayName: string;
  email: string;
  status: 'connected' | 'expired' | 'error';
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface ProviderStatusSummary {
  total: number;
  connected: number;
  expired: number;
  error: number;
  defaultProvider?: EmailProvider;
}

export function useEmailProviders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all email providers
  const { 
    data: providers = [], 
    isLoading: isLoadingProviders, 
    error: providersError 
  } = useQuery<EmailProvider[]>({
    queryKey: ['/api/email-providers'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Get default provider
  const { 
    data: defaultProvider, 
    isLoading: isLoadingDefault,
    error: defaultError 
  } = useQuery<EmailProvider>({
    queryKey: ['/api/email-providers/default'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false // Don't retry if no default provider
  });

  // Get provider status summary
  const { 
    data: statusSummary, 
    isLoading: isLoadingSummary 
  } = useQuery<ProviderStatusSummary>({
    queryKey: ['/api/email-providers/summary'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2
  });

  // Connect new provider
  const connectProviderMutation = useMutation({
    mutationFn: async (providerType: string) => {
      const response = await apiRequest('POST', `/api/email-providers/connect`, { providerType });
      return response;
    },
    onSuccess: (data: any) => {
      console.log('Connect provider response:', data);
      // Open OAuth flow in new window
      if (data.authUrl) {
        console.log('Opening OAuth popup with URL:', data.authUrl);
        const popup = window.open(
          data.authUrl, 
          'oauth_popup', 
          'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        );
        
        if (!popup) {
          toast({
            title: "Popup Blocked",
            description: "Please allow popups for this site and try again",
            variant: "destructive"
          });
          return;
        }

        // Monitor the popup for completion
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Refresh provider data after OAuth completion
            queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
            queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
            queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
            
            toast({
              title: "Checking Connection",
              description: "Verifying your Gmail connection...",
              variant: "default"
            });
          }
        }, 1000);
        
        // Clear interval after 5 minutes as fallback
        setTimeout(() => {
          clearInterval(checkClosed);
        }, 300000);
      } else {
        console.error('No authUrl in response:', data);
        toast({
          title: "Configuration Error",
          description: "No authorization URL received from server",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Connect provider error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to start email provider connection",
        variant: "destructive"
      });
    }
  });

  // Remove provider
  const removeProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      await apiRequest('DELETE', `/api/email-providers/${providerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
      toast({
        title: "Provider Removed",
        description: "Email provider has been successfully disconnected",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove email provider",
        variant: "destructive"
      });
    }
  });

  // Set default provider
  const setDefaultProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      await apiRequest('PUT', `/api/email-providers/${providerId}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
      toast({
        title: "Default Set",
        description: "Default email provider has been updated",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to set default provider",
        variant: "destructive"
      });
    }
  });

  // Send email
  const sendEmailMutation = useMutation({
    mutationFn: async ({ message, providerId }: { message: EmailMessage; providerId?: string }) => {
      const response = await apiRequest('POST', '/api/email-providers/send', { ...message, providerId });
      return response;
    },
    onSuccess: (result: any) => {
      toast({
        title: "Email Sent",
        description: `Email sent successfully via ${result.providerId || 'default provider'}`,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive"
      });
    }
  });

  // Check provider status
  const checkProviderStatusMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const response = await apiRequest('GET', `/api/email-providers/${providerId}/status`);
      return response;
    },
    onSuccess: (result: any, providerId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
      if (result.valid) {
        toast({
          title: "Connection Valid",
          description: "Email provider is working correctly",
          variant: "default"
        });
      } else {
        toast({
          title: "Connection Issues",
          description: "Email provider needs attention",
          variant: "destructive"
        });
      }
    }
  });

  // Refresh provider authentication
  const refreshProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const response = await apiRequest('POST', `/api/email-providers/${providerId}/refresh`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
      toast({
        title: "Authentication Refreshed",
        description: "Email provider connection has been renewed",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh authentication",
        variant: "destructive"
      });
    }
  });

  // Listen for OAuth success messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EMAIL_PROVIDER_CONNECTED') {
        // Refresh providers when OAuth completes
        queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
        queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
        toast({
          title: "Provider Connected",
          description: "Email provider has been successfully connected",
          variant: "default"
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient, toast]);

  // Check for provider connection success/error in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connectedProvider = urlParams.get('provider_connected');
    const providerError = urlParams.get('provider_error');

    if (connectedProvider) {
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/default'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-providers/summary'] });
      toast({
        title: "Provider Connected",
        description: "Email provider has been successfully connected",
        variant: "default"
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (providerError) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(providerError),
        variant: "destructive"
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient, toast]);

  return {
    // Data
    providers,
    defaultProvider,
    statusSummary,
    
    // Loading states
    isLoadingProviders,
    isLoadingDefault,
    isLoadingSummary,
    
    // Errors
    providersError,
    defaultError,
    
    // Actions
    connectProvider: connectProviderMutation.mutate,
    removeProvider: removeProviderMutation.mutate,
    setDefaultProvider: setDefaultProviderMutation.mutate,
    sendEmail: sendEmailMutation.mutate,
    checkProviderStatus: checkProviderStatusMutation.mutate,
    refreshProvider: refreshProviderMutation.mutate,
    
    // Mutation states
    isConnecting: connectProviderMutation.isPending,
    isRemoving: removeProviderMutation.isPending,
    isSettingDefault: setDefaultProviderMutation.isPending,
    isSendingEmail: sendEmailMutation.isPending,
    isCheckingStatus: checkProviderStatusMutation.isPending,
    isRefreshing: refreshProviderMutation.isPending,
    
    // Computed values
    hasProviders: providers.length > 0,
    hasDefaultProvider: !!defaultProvider,
    connectedProviders: providers.filter(p => p.status === 'connected'),
    expiredProviders: providers.filter(p => p.status === 'expired'),
    errorProviders: providers.filter(p => p.status === 'error'),
  };
}