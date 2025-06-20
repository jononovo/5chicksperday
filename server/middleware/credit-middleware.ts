import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../lib/credits';
import { SearchType } from '../lib/credits/types';

// Extend Express Request interface to include credit info
declare global {
  namespace Express {
    interface Request {
      creditInfo?: {
        userId: number;
        searchType: SearchType;
      };
    }
  }
}

/**
 * Middleware to check if user has sufficient credits before processing request
 * Blocks requests with 402 status if user has negative balance
 */
export function requireCredits(searchType: SearchType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract user ID (assumes requireAuth middleware ran first)
      const userId = req.isAuthenticated() && req.user ? (req.user as any).id : null;
      
      if (!userId) {
        return res.status(401).json({ 
          message: "Authentication required" 
        });
      }

      // Check if user is blocked due to insufficient credits
      const isBlocked = await CreditService.isUserBlocked(userId);
      if (isBlocked) {
        console.log(`Credit blocking: User ${userId} blocked for ${searchType}`);
        return res.status(402).json({
          message: "Account blocked due to insufficient credits",
          searchType
        });
      }

      // Store credit info for post-success deduction
      req.creditInfo = { userId, searchType };
      
      console.log(`Credit check passed: User ${userId} can proceed with ${searchType}`);
      next();
    } catch (error) {
      console.error('Credit middleware error:', error);
      // Don't block the request if credit checking fails
      next();
    }
  };
}

/**
 * Middleware to deduct credits after successful operation
 * Should be placed after the main operation handler
 */
export function deductCreditsOnSuccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only deduct credits if operation was successful and credit info is available
    if (req.creditInfo && res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const { userId, searchType } = req.creditInfo;
        
        await CreditService.deductCredits(userId, searchType, true);
        console.log(`Credits deducted: User ${userId} charged for ${searchType}`);
      } catch (creditError) {
        console.error('Credit deduction error:', creditError);
        // Don't fail the request if credit deduction fails
        // The operation was successful, just log the credit error
      }
    }
    
    next();
  };
}

/**
 * Helper function to get user ID from request
 * Matches the pattern used in existing routes
 */
export function getUserId(req: Request): number {
  if (!req.isAuthenticated() || !req.user) {
    throw new Error('User not authenticated');
  }
  return (req.user as any).id;
}