/**
 * Manage tooltip state flags for user onboarding
 */

/**
 * Reset all tooltip flags so new registered users see onboarding tooltips again
 */
export const resetTooltipFlags = (): void => {
  console.log('Resetting tooltip flags for new registered user...');
  
  const tooltipKeys = [
    'hasShownEmailTooltip',
    'hasShownStartSellingTooltip',
    // Add other tooltip flags as they're identified
  ];
  
  tooltipKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Reset tooltip flag: ${key}`);
  });
  
  console.log('Tooltip flags reset completed');
};

/**
 * Check if a specific tooltip has been shown
 */
export const hasShownTooltip = (tooltipKey: string): boolean => {
  return localStorage.getItem(tooltipKey) === 'true';
};

/**
 * Mark a tooltip as shown
 */
export const markTooltipAsShown = (tooltipKey: string): void => {
  localStorage.setItem(tooltipKey, 'true');
};