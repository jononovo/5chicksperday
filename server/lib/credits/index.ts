import { UserCredits, CreditTransaction, SearchType, CreditDeductionResult, CREDIT_COSTS, MONTHLY_CREDIT_ALLOWANCE, EasterEgg, EASTER_EGGS, NotificationConfig, NOTIFICATIONS, BadgeConfig, BADGES, STRIPE_CONFIG } from "./types";
import Database from '@replit/database';

// Replit DB instance for persistent credit storage
const db = new Database();

export class CreditService {
  private static readonly CREDIT_KEY_PREFIX = "user_credits:";

  private static getCreditKey(userId: string): string {
    return `${this.CREDIT_KEY_PREFIX}${userId}`;
  }

  /**
   * Get user credits, creating initial record if needed
   */
  static async getUserCredits(userId: string): Promise<UserCredits> {
    const key = this.getCreditKey(userId);
    
    try {
      console.log(`[CreditService] Getting credits for user ${userId} with key: ${key}`);
      const creditsData = await db.get(key);
      console.log(`[CreditService] Raw DB data for user ${userId}:`, creditsData);
      
      let credits: UserCredits | undefined;
      
      if (creditsData && creditsData.ok !== false) {
        try {
          // Extract value from Replit DB response wrapper format
          const rawData = creditsData.value || creditsData;
          credits = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          console.log(`[CreditService] Parsed credits for user ${userId}:`, credits);
        } catch (parseError) {
          console.error(`Error parsing credits data for user ${userId}:`, parseError);
          credits = undefined;
        }
      }
      
      if (!credits) {
        console.log(`[CreditService] No credits found for user ${userId}, creating initial record with 180 credits`);
        
        // Create initial credit record with 180 credit starting bonus
        const initialCredits: UserCredits = {
          currentBalance: 180,
          lastTopUp: Date.now(),
          totalUsed: 0,
          isBlocked: false,
          transactions: [{
            type: 'credit',
            amount: 180,
            description: 'Welcome bonus - 180 free credits',
            timestamp: Date.now()
          }],
          monthlyAllowance: MONTHLY_CREDIT_ALLOWANCE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        console.log(`[CreditService] Saving initial credits for user ${userId}:`, initialCredits);
        await db.set(key, JSON.stringify(initialCredits));
        console.log(`[CreditService] Successfully saved initial credits for user ${userId}`);
        return initialCredits;
      }
      
      console.log(`[CreditService] Returning existing credits for user ${userId}:`, credits);
      return credits;
    } catch (error) {
      console.error(`Error getting credits for user ${userId}:`, error);
      // Return default credits on error
      return {
        currentBalance: 180,
        lastTopUp: Date.now(),
        totalUsed: 0,
        isBlocked: false,
        transactions: [{
          type: 'credit',
          amount: 180,
          description: 'Welcome bonus - 180 free credits (fallback)',
          timestamp: Date.now()
        }],
        monthlyAllowance: MONTHLY_CREDIT_ALLOWANCE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
  }

  /**
   * Check if user needs monthly top-up and apply if needed
   */
  static async checkAndApplyMonthlyTopUp(userId: string): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    const now = new Date();
    const lastTopUp = new Date(credits.lastTopUp);
    
    // Check if it's a new month
    const isNewMonth = now.getMonth() !== lastTopUp.getMonth() || 
                      now.getFullYear() !== lastTopUp.getFullYear();
    
    if (isNewMonth) {
      // Determine credit amount based on subscription status
      const isSubscribed = credits.subscriptionStatus === 'active' && credits.currentPlan;
      const creditAmount = isSubscribed && credits.currentPlan 
        ? STRIPE_CONFIG.PLAN_CREDIT_ALLOWANCES[credits.currentPlan]
        : MONTHLY_CREDIT_ALLOWANCE;

      const planDescription = isSubscribed && credits.currentPlan 
        ? `${credits.currentPlan} subscription`
        : 'free tier';

      const transaction: CreditTransaction = {
        type: 'credit',
        amount: creditAmount,
        description: `Monthly top-up for ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${planDescription})`,
        timestamp: Date.now()
      };

      const updatedCredits: UserCredits = {
        ...credits,
        currentBalance: credits.currentBalance + creditAmount,
        lastTopUp: Date.now(),
        isBlocked: false, // Unblock user on monthly refresh
        transactions: [...credits.transactions, transaction],
        updatedAt: Date.now()
      };

      await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));
      console.log(`Applied monthly top-up for user ${userId}: +${creditAmount} credits (${planDescription})`);
      return true;
    }
    
    return false;
  }

  /**
   * Deduct credits for a successful search
   */
  static async deductCredits(
    userId: string, 
    searchType: SearchType, 
    success: boolean = true,
    customAmount?: number
  ): Promise<CreditDeductionResult> {
    // Check for monthly top-up first
    await this.checkAndApplyMonthlyTopUp(userId);
    
    const credits = await this.getUserCredits(userId);
    const amount = customAmount || CREDIT_COSTS[searchType];
    
    // Only deduct if search was successful
    if (!success) {
      return {
        success: true,
        newBalance: credits.currentBalance,
        isBlocked: credits.isBlocked
      };
    }

    const transaction: CreditTransaction = {
      type: 'debit',
      amount,
      description: `${searchType.replace('_', ' ')} search`,
      timestamp: Date.now(),
      searchType,
      success
    };

    const newBalance = credits.currentBalance - amount;
    const isBlocked = newBalance < 0;

    const updatedCredits: UserCredits = {
      ...credits,
      currentBalance: newBalance,
      totalUsed: credits.totalUsed + amount,
      isBlocked,
      transactions: [...credits.transactions, transaction],
      updatedAt: Date.now()
    };

    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));

    console.log(`Credits deducted for user ${userId}: -${amount} credits for ${searchType} (success: ${success})`);
    console.log(`New balance: ${newBalance}, Blocked: ${isBlocked}`);

    return {
      success: true,
      newBalance,
      isBlocked,
      transaction
    };
  }

  /**
   * Check if user is blocked
   */
  static async isUserBlocked(userId: string): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    return credits.isBlocked;
  }

  /**
   * Get credit balance
   */
  static async getCreditBalance(userId: string): Promise<number> {
    const credits = await this.getUserCredits(userId);
    return credits.currentBalance;
  }

  /**
   * Get credit transaction history
   */
  static async getCreditHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    const credits = await this.getUserCredits(userId);
    return credits.transactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Claim Easter Egg bonus credits
   */
  static async claimEasterEgg(userId: string, query: string): Promise<{
    success: boolean; 
    message: string; 
    newBalance?: number;
    easterEgg?: EasterEgg;
  }> {
    // Find matching easter egg by trigger (case-insensitive)
    const easterEgg = EASTER_EGGS.find(egg => 
      egg.trigger.toLowerCase() === query.toLowerCase().trim()
    );
    if (!easterEgg) {
      return { success: false, message: "Invalid easter egg" };
    }

    const credits = await this.getUserCredits(userId);
    const easterEggArray = credits.easterEggs || [];
    
    // Check if already used
    if (easterEggArray[easterEgg.id] === 1) {
      return { success: false, message: "Easter egg already claimed!" };
    }

    // Award credits and mark as used
    const transaction: CreditTransaction = {
      type: 'credit',
      amount: easterEgg.reward,
      description: `${easterEgg.emoji} ${easterEgg.description}`,
      timestamp: Date.now()
    };

    // Update easter egg tracking array
    const updatedEasterEggs = [...easterEggArray];
    updatedEasterEggs[easterEgg.id] = 1;

    const updatedCredits: UserCredits = {
      ...credits,
      currentBalance: credits.currentBalance + easterEgg.reward,
      isBlocked: credits.currentBalance + easterEgg.reward >= 0 ? false : credits.isBlocked,
      transactions: [transaction, ...credits.transactions],
      easterEggs: updatedEasterEggs,
      updatedAt: Date.now()
    };

    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));
    return { 
      success: true, 
      message: `🎉 Easter egg found! +${easterEgg.reward} credits added!`, 
      newBalance: updatedCredits.currentBalance,
      easterEgg 
    };
  }

  /**
   * Check if badge has been earned by user
   */
  static async hasEarnedBadge(userId: string, badgeId: number): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    const badges = credits.badges || [];
    return badges[badgeId] === 1;
  }

  /**
   * Award badge to user
   */
  static async awardBadge(userId: string, badgeId: number): Promise<void> {
    const credits = await this.getUserCredits(userId);
    const badges = credits.badges || [];
    
    // Update tracking array
    const updated = [...badges];
    updated[badgeId] = 1;
    
    const updatedCredits: UserCredits = {
      ...credits,
      badges: updated,
      updatedAt: Date.now()
    };
    
    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));
  }

  /**
   * Trigger badge if not already earned
   */
  static async triggerBadge(userId: string, trigger: string): Promise<{
    shouldShow: boolean;
    badge?: BadgeConfig;
  }> {
    const badge = BADGES.find(b => b.trigger === trigger);
    if (!badge) {
      return { shouldShow: false };
    }

    const hasEarned = await this.hasEarnedBadge(userId, badge.id);
    if (hasEarned) {
      return { shouldShow: false };
    }

    return { shouldShow: true, badge };
  }

  /**
   * Check if notification has been shown to user
   */
  static async hasShownNotification(userId: string, notificationId: number): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    const notifications = credits.notifications || [];
    return notifications[notificationId] === 1;
  }

  /**
   * Mark notification as shown
   */
  static async markNotificationShown(userId: string, notificationId: number): Promise<void> {
    const credits = await this.getUserCredits(userId);
    const notifications = credits.notifications || [];
    
    // Update tracking array
    const updated = [...notifications];
    updated[notificationId] = 1;
    
    const updatedCredits: UserCredits = {
      ...credits,
      notifications: updated,
      updatedAt: Date.now()
    };
    
    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));
  }

  /**
   * Trigger notification if not already shown
   */
  static async triggerNotification(userId: string, trigger: string): Promise<{
    shouldShow: boolean;
    notification?: NotificationConfig;
    badge?: BadgeConfig;
  }> {
    // Check if it's a badge first
    const badge = BADGES.find(b => b.trigger === trigger);
    if (badge) {
      const badgeResult = await this.triggerBadge(userId, trigger);
      return { 
        shouldShow: badgeResult.shouldShow, 
        badge: badgeResult.badge 
      };
    }

    // Otherwise check notifications
    const notification = NOTIFICATIONS.find(n => n.trigger === trigger);
    if (!notification) {
      return { shouldShow: false };
    }

    const hasShown = await this.hasShownNotification(userId, notification.id);
    if (hasShown) {
      return { shouldShow: false };
    }

    return { shouldShow: true, notification };
  }

  /**
   * Manual credit adjustment (for admin use)
   */
  static async adjustCredits(
    userId: string, 
    amount: number, 
    description: string
  ): Promise<CreditDeductionResult> {
    const credits = await this.getUserCredits(userId);
    
    const transaction: CreditTransaction = {
      type: amount > 0 ? 'credit' : 'debit',
      amount: Math.abs(amount),
      description,
      timestamp: Date.now()
    };

    const newBalance = credits.currentBalance + amount;
    const isBlocked = newBalance < 0;

    const updatedCredits: UserCredits = {
      ...credits,
      currentBalance: newBalance,
      totalUsed: amount < 0 ? credits.totalUsed + Math.abs(amount) : credits.totalUsed,
      isBlocked,
      transactions: [...credits.transactions, transaction],
      updatedAt: Date.now()
    };

    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));

    return {
      success: true,
      newBalance,
      isBlocked,
      transaction
    };
  }

  /**
   * Get usage statistics for a user
   */
  static async getUsageStats(userId: string): Promise<{
    totalUsed: number;
    thisMonth: number;
    searchCounts: Record<string, number>;
  }> {
    const credits = await this.getUserCredits(userId);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    const thisMonthTransactions = credits.transactions.filter(
      t => t.type === 'debit' && t.timestamp >= thisMonthStart
    );
    
    const thisMonthUsage = thisMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const searchCounts: Record<string, number> = {};
    thisMonthTransactions.forEach(t => {
      if (t.searchType) {
        searchCounts[t.searchType] = (searchCounts[t.searchType] || 0) + 1;
      }
    });

    return {
      totalUsed: credits.totalUsed,
      thisMonth: thisMonthUsage,
      searchCounts
    };
  }

  /**
   * Update Stripe customer ID
   */
  static async updateStripeCustomerId(userId: string, customerId: string): Promise<void> {
    const credits = await this.getUserCredits(userId);
    credits.stripeCustomerId = customerId;
    credits.updatedAt = Date.now();
    
    await db.set(this.getCreditKey(userId), JSON.stringify(credits));
    console.log(`Updated Stripe customer ID for user ${userId}: ${customerId}`);
  }

  /**
   * Update subscription details
   */
  static async updateSubscription(userId: string, subscriptionData: {
    stripeSubscriptionId?: string;
    subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
    currentPlan?: 'ugly-duckling';
    subscriptionStartDate?: number;
    subscriptionEndDate?: number;
  }): Promise<void> {
    const credits = await this.getUserCredits(userId);
    
    Object.assign(credits, subscriptionData);
    credits.updatedAt = Date.now();
    
    await db.set(this.getCreditKey(userId), JSON.stringify(credits));
    console.log(`Updated subscription for user ${userId}:`, subscriptionData);
  }

  /**
   * Award subscription credits immediately upon successful subscription
   */
  static async awardSubscriptionCredits(userId: string, planId: 'ugly-duckling'): Promise<void> {
    const credits = await this.getUserCredits(userId);
    const creditAmount = STRIPE_CONFIG.PLAN_CREDIT_ALLOWANCES[planId];

    const transaction: CreditTransaction = {
      type: 'credit',
      amount: creditAmount,
      description: `${planId} subscription activation bonus`,
      timestamp: Date.now()
    };

    const updatedCredits: UserCredits = {
      ...credits,
      currentBalance: credits.currentBalance + creditAmount,
      isBlocked: false, // Unblock user on subscription
      transactions: [...credits.transactions, transaction],
      updatedAt: Date.now()
    };

    await db.set(this.getCreditKey(userId), JSON.stringify(updatedCredits));
    console.log(`Awarded subscription credits for user ${userId}: +${creditAmount} credits for ${planId}`);
  }
}

export default CreditService;