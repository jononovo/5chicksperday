import { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { ActiveCampaignBanner } from './ActiveCampaignBanner';
import { SetupProgressBanner } from './SetupProgressBanner';

interface AdaptiveCampaignBannerProps {
  isActivated: boolean;
  stats?: {
    currentStreak?: number;
    emailsSentToday?: number;
    emailsSentThisMonth?: number;
    companiesContactedThisMonth?: number;
  };
  hasSenderProfile: boolean;
  hasProduct: boolean;
  hasCustomerProfile: boolean;
}

export function AdaptiveCampaignBanner({
  isActivated,
  stats,
  hasSenderProfile,
  hasProduct,
  hasCustomerProfile
}: AdaptiveCampaignBannerProps) {
  // Test mode state - null means use real state, true/false forces specific banner
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Handle test mode toggle
  const toggleTestMode = () => {
    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Toggle between active (true) and setup (false)
    const newTestMode = testMode === null 
      ? !isActivated  // Start with opposite of current state
      : !testMode;    // Toggle current test state
    
    setTestMode(newTestMode);
    setSecondsRemaining(30);

    // Start countdown
    countdownRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-revert after 30 seconds
    timerRef.current = setTimeout(() => {
      setTestMode(null);
      setSecondsRemaining(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }, 30000);
  };

  // Determine which banner to show
  const showActiveBanner = testMode !== null ? testMode : isActivated;

  return (
    <div className="relative">
      {/* Test mode toggle - discrete chevron in upper left */}
      <button
        onClick={toggleTestMode}
        className="absolute left-2 top-2 z-10 p-1 rounded-md transition-all opacity-30 hover:opacity-70 hover:bg-white/10"
        title="Toggle banner for testing"
      >
        <ChevronRight className="h-4 w-4 text-white" />
      </button>

      {/* Test mode indicator */}
      {testMode !== null && (
        <div className="absolute left-10 top-2 z-10 px-2 py-0.5 bg-black/20 rounded text-xs text-white/70">
          Test mode ({secondsRemaining}s)
        </div>
      )}

      {/* Render the appropriate banner */}
      {showActiveBanner ? (
        <ActiveCampaignBanner stats={stats || {}} />
      ) : (
        <SetupProgressBanner
          hasSenderProfile={hasSenderProfile}
          hasProduct={hasProduct}
          hasCustomerProfile={hasCustomerProfile}
        />
      )}
    </div>
  );
}