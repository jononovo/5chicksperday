/**
 * Rate Limiting Utilities for External API Calls
 * 
 * Smart rate limiting that only delays when hitting the same API provider
 * Does not add delays between different companies or operations
 */

interface RateLimitConfig {
  maxRequestsPerSecond: number;
  provider: string;
}

interface RateLimitState {
  lastCallTime: number;
  callCount: number;
  windowStart: number;
}

// Store rate limit state per provider
const rateLimitStates = new Map<string, RateLimitState>();

// Default rate limits per provider (requests per second)
const DEFAULT_RATE_LIMITS: Record<string, number> = {
  perplexity: 10,  // 10 requests per second
  hunter: 5,       // 5 requests per second
  apollo: 5,       // 5 requests per second
  openai: 20,      // 20 requests per second
  sendgrid: 100,   // 100 requests per second
  default: 10      // Default for unknown providers
};

/**
 * Rate-limited API call wrapper
 * Only adds delay when necessary based on provider's rate limit
 * 
 * @param provider - Name of the API provider (e.g., 'perplexity', 'hunter')
 * @param fn - The async function to execute (API call)
 * @param customLimit - Optional custom rate limit (requests per second)
 * @returns Result of the API call
 */
export async function rateLimitedCall<T>(
  provider: string,
  fn: () => Promise<T>,
  customLimit?: number
): Promise<T> {
  const limit = customLimit || DEFAULT_RATE_LIMITS[provider] || DEFAULT_RATE_LIMITS.default;
  const minDelay = Math.ceil(1000 / limit); // Minimum milliseconds between requests
  
  // Get or initialize state for this provider
  let state = rateLimitStates.get(provider);
  const now = Date.now();
  
  if (!state) {
    // First call for this provider
    state = {
      lastCallTime: 0,
      callCount: 0,
      windowStart: now
    };
    rateLimitStates.set(provider, state);
  }
  
  // Calculate time since last call
  const timeSinceLastCall = now - state.lastCallTime;
  
  // Only delay if we're calling too quickly
  if (state.lastCallTime > 0 && timeSinceLastCall < minDelay) {
    const delayNeeded = minDelay - timeSinceLastCall;
    console.log(`[Rate Limiter] Delaying ${delayNeeded}ms for ${provider} (limit: ${limit}/sec)`);
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  // Update state
  state.lastCallTime = Date.now();
  state.callCount++;
  
  // Reset window every second
  if (Date.now() - state.windowStart > 1000) {
    state.windowStart = Date.now();
    state.callCount = 1;
  }
  
  // Execute the API call
  try {
    return await fn();
  } catch (error) {
    // Log rate limit errors specifically
    if (error instanceof Error && 
        (error.message.includes('429') || 
         error.message.toLowerCase().includes('rate limit') ||
         error.message.toLowerCase().includes('too many requests'))) {
      console.error(`[Rate Limiter] ${provider} rate limit exceeded:`, error.message);
      
      // Back off more aggressively for rate limit errors
      state.lastCallTime = Date.now() + 1000; // Add 1 second penalty
    }
    throw error;
  }
}

/**
 * Batch rate-limited calls for the same provider
 * Processes multiple API calls with proper rate limiting
 * 
 * @param provider - Name of the API provider
 * @param calls - Array of async functions to execute
 * @param options - Configuration options
 * @returns Array of results
 */
export async function batchRateLimitedCalls<T>(
  provider: string,
  calls: Array<() => Promise<T>>,
  options: {
    maxConcurrent?: number;
    customLimit?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<T[]> {
  const { maxConcurrent = 1, customLimit, onProgress } = options;
  const results: T[] = [];
  
  // Process in controlled batches with rate limiting
  for (let i = 0; i < calls.length; i += maxConcurrent) {
    const batch = calls.slice(i, i + maxConcurrent);
    
    // Execute batch with rate limiting per call
    const batchResults = await Promise.all(
      batch.map(call => rateLimitedCall(provider, call, customLimit))
    );
    
    results.push(...batchResults);
    
    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + maxConcurrent, calls.length), calls.length);
    }
  }
  
  return results;
}

/**
 * Clear rate limit state for a provider
 * Useful for testing or resetting after errors
 * 
 * @param provider - Name of the provider to reset
 */
export function clearRateLimitState(provider?: string): void {
  if (provider) {
    rateLimitStates.delete(provider);
  } else {
    rateLimitStates.clear();
  }
}

/**
 * Get current rate limit statistics for monitoring
 * 
 * @returns Map of provider to their current state
 */
export function getRateLimitStats(): Map<string, RateLimitState> {
  return new Map(rateLimitStates);
}