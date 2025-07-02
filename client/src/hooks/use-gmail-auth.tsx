import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface GmailAuthStatus {
  connected: boolean;
  hasValidToken: boolean;
  authUrl?: string;
}

interface TokenDebugInfo {
  userId: number;
  debug: {
    hasTokenRecord: boolean;
    hasGmailAccess: boolean;
    hasGmailRefresh: boolean;
    hasFirebaseToken: boolean;
    tokenExpiry: number | null;
    currentTime: number;
    isExpired: boolean | null;
    timeSinceExpiry: number | null;
    timeToExpiry: number | null;
    validation: {
      isValid: boolean;
      isExpired: boolean;
      needsRefresh: boolean;
      hasRefreshToken: boolean;
    } | null;
    accessTokenLength?: number;
    refreshTokenLength?: number;
  };
}

export function useGmailAuth() {
  const queryClient = useQueryClient();

  // Check Gmail connection status
  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus
  } = useQuery<GmailAuthStatus>({
    queryKey: ['/api/gmail/status'],
    retry: 1
  });

  // Debug token information
  const {
    data: debugInfo,
    isLoading: debugLoading,
    refetch: refetchDebug
  } = useQuery<TokenDebugInfo>({
    queryKey: ['/api/debug/tokens'],
    retry: 1,
    enabled: false // Manual trigger only
  });

  // Force refresh tokens
  const forceRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gmail/force-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh tokens');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refresh status after successful token refresh
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/debug/tokens'] });
    }
  });

  // Authorize Gmail (get auth URL)
  const authorizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gmail/oauth/authorize', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get authorization URL');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        // Redirect to Google OAuth
        console.log('Redirecting to Gmail OAuth:', data.authUrl);
        window.location.href = data.authUrl;
      }
    }
  });

  // Disconnect Gmail
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gmail/disconnect', {
        method: 'GET'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect Gmail');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/debug/tokens'] });
    }
  });

  return {
    // Status
    status,
    statusLoading,
    isConnected: status?.connected || false,
    hasValidToken: status?.hasValidToken || false,
    
    // Debug
    debugInfo,
    debugLoading,
    getDebugInfo: () => refetchDebug(),
    
    // Actions
    authorizeGmail: () => authorizeMutation.mutate(),
    forceRefresh: () => forceRefreshMutation.mutate(),
    disconnect: () => disconnectMutation.mutate(),
    refreshStatus: () => refetchStatus(),
    
    // Loading states
    isAuthorizing: authorizeMutation.isPending,
    isRefreshing: forceRefreshMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    
    // Errors
    authError: authorizeMutation.error?.message,
    refreshError: forceRefreshMutation.error?.message,
    disconnectError: disconnectMutation.error?.message,
    
    // Success data
    refreshResult: forceRefreshMutation.data
  };
}