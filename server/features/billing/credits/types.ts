export interface CreditTransaction {
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  timestamp: number;
  searchType?: string;
  success?: boolean;
}

export interface EasterEgg {
  id: number;
  trigger: string;
  reward: number;
  description: string;
  emoji?: string;
}

export interface UserCredits {
  currentBalance: number;
  lastTopUp: number;
  totalUsed: number;
  isBlocked: boolean;
  transactions: CreditTransaction[];
  monthlyAllowance: number;
  createdAt: number;
  updatedAt: number;
  easterEggs?: number[];  // [0, 1, 1] tracking array
  notifications?: number[];  // [0, 1, 1] temporary notification tracking array
  badges?: number[];  // [0, 1, 1] permanent badge tracking array
  // Stripe subscription fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  currentPlan?: 'ugly-duckling' | 'duckin-awesome';
  subscriptionStartDate?: number;
  subscriptionEndDate?: number;
}

export interface CreditDeductionResult {
  success: boolean;
  newBalance: number;
  isBlocked: boolean;
  transaction?: CreditTransaction;
  error?: string;
}

export type SearchType = 
  | 'company_search'
  | 'contact_discovery'
  | 'email_search'
  | 'full_search'
  | 'company_and_contacts'
  | 'company_contacts_emails'
  | 'individual_email'
  | 'individual_search';

export const CREDIT_COSTS: Record<SearchType, number> = {
  'company_search': 10,
  'contact_discovery': 60,
  'email_search': 160,
  'full_search': 250,
  'company_and_contacts': 70,   // 10 + 60
  'company_contacts_emails': 240, // 10 + 60 + 170
  'individual_email': 20,
  'individual_search': 180  // Person discovery + company + email enrichment
} as const;

export const MONTHLY_CREDIT_ALLOWANCE = 250;

// Stripe configuration with environment-based price selection
export const STRIPE_CONFIG = {
  // Use environment variable for product ID, fallback to provided production product
  get UGLY_DUCKLING_PRODUCT_ID() {
    return process.env.STRIPE_PRODUCT_ID || 'prod_SXlmpPTIOgmmjo';
  },
  // Use environment variable for price ID, fallback to provided production price
  get UGLY_DUCKLING_PRICE_ID() {
    return process.env.STRIPE_PRICE_ID || 'price_1RcgF4K7jbIybp9HaHIZlv2W';
  },
  PLAN_CREDIT_ALLOWANCES: {
    'ugly-duckling': 5000, // 2000 base + 3000 bonus
    'duckin-awesome': 15000, // 5000 base + 10000 bonus
    'free': 250 // Default free credits
  }
} as const;

export interface NotificationConfig {
  id: number;
  type: 'welcome' | 'achievement' | 'feature_unlock' | 'milestone';
  trigger: string;
  title: string;
  description: string;
  badge?: string;
  emoji?: string;
  buttonText?: string;
}

export interface BadgeConfig {
  id: number;
  type: 'welcome' | 'achievement' | 'milestone' | 'special';
  trigger: string;
  title: string;
  description: string;
  badge: string;
  emoji?: string;
  buttonText?: string;
}

export const BADGES: BadgeConfig[] = [
  {
    id: 0,
    type: 'welcome',
    trigger: 'registration_complete',
    title: 'Congrats Hatchling Level Unlocked!',
    description: 'You have unlocked **Email Search**.\n\nRun a NEW search now to see complete results including emails of ~2 Key Contacts per company.',
    badge: 'Hatchling',
    emoji: '🦆',
    buttonText: 'Chirp'
  }
];

export const NOTIFICATIONS: NotificationConfig[] = [
  {
    id: 1,
    type: 'milestone',
    trigger: 'waitlist_joined',
    title: 'Added to Waitlist',
    description: 'You\'ll be notified when Duckin\' Awesome becomes available!',
    badge: 'Waitlist Member',
    emoji: '📋',
    buttonText: 'Got It'
  },
  {
    id: 2,
    type: 'feature_unlock',
    trigger: 'search_tooltip_shown',
    title: 'Search Tooltip',
    description: 'Search button tooltip has been shown',
    badge: 'Onboarding',
    emoji: '🔍',
    buttonText: 'Continue'
  },
  {
    id: 3,
    type: 'feature_unlock',
    trigger: 'email_tooltip_shown',
    title: 'Email Discovery Tooltip',
    description: 'Email discovery tooltip has been shown',
    badge: 'Onboarding',
    emoji: '📧',
    buttonText: 'Continue'
  },
  {
    id: 4,
    type: 'feature_unlock',
    trigger: 'start_selling_tooltip_shown',
    title: 'Start Selling Tooltip',
    description: 'Start selling tooltip has been shown',
    badge: 'Onboarding',
    emoji: '🚀',
    buttonText: 'Continue'
  }
];

export const EASTER_EGGS: EasterEgg[] = [
  { 
    id: 0, 
    trigger: "5ducks", 
    reward: 1000, 
    description: "Company mascot discovery", 
    emoji: "🦆" 
  },
  {
    id: 1,
    trigger: "free palestine",
    reward: 3000,
    description: "Solidarity bonus",
    emoji: "🇵🇸"
  },
  {
    id: 2,
    trigger: "he is risen",
    reward: 3000,
    description: "Easter blessing",
    emoji: "🐑"
  }
  // Future eggs easily added here
];