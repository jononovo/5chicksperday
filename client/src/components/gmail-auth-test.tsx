import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGmailAuth } from '@/hooks/use-gmail-auth';
import { Loader2, Mail, RefreshCw, Bug, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

export function GmailAuthTest() {
  const {
    status,
    statusLoading,
    isConnected,
    hasValidToken,
    debugInfo,
    debugLoading,
    getDebugInfo,
    authorizeGmail,
    forceRefresh,
    disconnect,
    refreshStatus,
    isAuthorizing,
    isRefreshing,
    isDisconnecting,
    authError,
    refreshError,
    disconnectError,
    refreshResult
  } = useGmailAuth();

  const [showDebug, setShowDebug] = useState(false);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(Math.abs(ms) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail OAuth Test Panel
          </CardTitle>
          <CardDescription>
            Test the dual OAuth system: Firebase Auth (user) + Google OAuth (Gmail API)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Gmail Status:</span>
            {statusLoading ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </Badge>
            ) : isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
            {hasValidToken && (
              <Badge variant="secondary">Valid Token</Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={authorizeGmail}
              disabled={isAuthorizing}
              className="flex items-center gap-2"
            >
              {isAuthorizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Authorize Gmail (Google OAuth)
            </Button>

            <Button
              onClick={forceRefresh}
              disabled={isRefreshing || !isConnected}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Test Refresh Token
            </Button>

            <Button
              onClick={disconnect}
              disabled={isDisconnecting || !isConnected}
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Disconnect
            </Button>

            <Button
              onClick={refreshStatus}
              variant="ghost"
              size="sm"
            >
              Refresh Status
            </Button>
          </div>

          {/* Debug Section */}
          <div className="border-t pt-4">
            <Button
              onClick={() => {
                setShowDebug(!showDebug);
                if (!showDebug) getDebugInfo();
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              {showDebug ? 'Hide' : 'Show'} Debug Info
            </Button>

            {showDebug && (
              <div className="mt-4 space-y-4">
                {debugLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading debug info...
                  </div>
                ) : debugInfo ? (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Token Status:</strong>
                        <ul className="mt-1 space-y-1">
                          <li>Has Token Record: {debugInfo.debug.hasTokenRecord ? '✅' : '❌'}</li>
                          <li>Has Gmail Access: {debugInfo.debug.hasGmailAccess ? '✅' : '❌'}</li>
                          <li>Has Gmail Refresh: {debugInfo.debug.hasGmailRefresh ? '✅' : '❌'}</li>
                          <li>Has Firebase Token: {debugInfo.debug.hasFirebaseToken ? '✅' : '❌'}</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Token Timing:</strong>
                        <ul className="mt-1 space-y-1">
                          <li>Expires: {formatTime(debugInfo.debug.tokenExpiry)}</li>
                          <li>Is Expired: {debugInfo.debug.isExpired ? '⚠️ YES' : '✅ No'}</li>
                          <li>Time Since Expiry: {formatDuration(debugInfo.debug.timeSinceExpiry)}</li>
                          <li>Time To Expiry: {formatDuration(debugInfo.debug.timeToExpiry)}</li>
                        </ul>
                      </div>
                    </div>
                    
                    {debugInfo.debug.validation && (
                      <div>
                        <strong>Validation:</strong>
                        <ul className="mt-1 space-y-1">
                          <li>Is Valid: {debugInfo.debug.validation.isValid ? '✅' : '❌'}</li>
                          <li>Is Expired: {debugInfo.debug.validation.isExpired ? '⚠️ YES' : '✅ No'}</li>
                          <li>Needs Refresh: {debugInfo.debug.validation.needsRefresh ? '🔄 YES' : '✅ No'}</li>
                          <li>Has Refresh Token: {debugInfo.debug.validation.hasRefreshToken ? '✅' : '❌'}</li>
                        </ul>
                      </div>
                    )}
                    
                    <div>
                      <strong>Token Lengths:</strong>
                      <ul className="mt-1 space-y-1">
                        <li>Access Token: {debugInfo.debug.accessTokenLength || 'N/A'} chars</li>
                        <li>Refresh Token: {debugInfo.debug.refreshTokenLength || 'N/A'} chars</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Click "Show Debug Info" to inspect token state</p>
                )}
              </div>
            )}
          </div>

          {/* Error Messages */}
          {(authError || refreshError || disconnectError) && (
            <div className="bg-red-50 border border-red-200 p-3 rounded">
              <strong>Errors:</strong>
              {authError && <div>Auth: {authError}</div>}
              {refreshError && <div>Refresh: {refreshError}</div>}
              {disconnectError && <div>Disconnect: {disconnectError}</div>}
            </div>
          )}

          {/* Success Messages */}
          {refreshResult && (
            <div className="bg-green-50 border border-green-200 p-3 rounded">
              <strong>Refresh Success:</strong>
              <div>New token length: {refreshResult.newTokenLength}</div>
              <div>New expiry: {refreshResult.newExpiryDate}</div>
              <div>Message: {refreshResult.message}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How This Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1. Firebase OAuth:</strong> Handles user authentication (you're already logged in)</p>
            <p><strong>2. Google OAuth:</strong> Handles Gmail API access with refresh tokens</p>
            <p><strong>3. Separated Systems:</strong> Firebase can't provide Gmail refresh tokens, so we use direct Google OAuth</p>
            <p><strong>4. Testing:</strong> Use "Authorize Gmail" to get proper refresh tokens, then test refresh functionality</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}