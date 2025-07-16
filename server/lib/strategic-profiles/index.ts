import Database from '@replit/database';

// Replit DB instance for strategic profile storage
const db = new Database();

export interface StrategicProfile {
  id: number;
  userId: number;
  name: string;
  businessType: string;
  businessDescription: string;
  targetCustomers: string;
  productService?: string;
  customerFeedback?: string;
  website?: string;
  businessLocation?: string;
  primaryCustomerType?: string;
  primarySalesChannel?: string;
  primaryBusinessGoal?: string;
  // Strategy documents
  strategyHighLevelBoundary?: string;
  exampleSprintPlanningPrompt?: string;
  exampleDailySearchQuery?: string;
  productAnalysisSummary?: string;
  reportSalesContextGuidance?: string;
  reportSalesTargetingGuidance?: string;
  dailySearchQueries?: string;
  // Metadata
  status: 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export class StrategicProfileService {
  private static readonly PROFILE_KEY_PREFIX = "strategic_profile:";
  private static readonly USER_PROFILES_KEY_PREFIX = "user_profiles:";

  private static getProfileKey(profileId: number): string {
    return `${this.PROFILE_KEY_PREFIX}${profileId}`;
  }

  private static getUserProfilesKey(userId: number): string {
    return `${this.USER_PROFILES_KEY_PREFIX}${userId}`;
  }

  /**
   * Get list of profile IDs for a user
   */
  private static async getUserProfileIds(userId: number): Promise<number[]> {
    const key = this.getUserProfilesKey(userId);
    
    try {
      const data = await db.get(key);
      if (!data || data.ok === false) {
        return [];
      }
      
      const rawData = data.value || data;
      const profileIds = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      return Array.isArray(profileIds) ? profileIds : [];
    } catch (error) {
      console.error(`Error getting profile IDs for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create a new strategic profile
   */
  static async createStrategicProfile(userId: number, data: any): Promise<StrategicProfile> {
    const profileId = Date.now(); // Simple ID generation using timestamp
    const key = this.getProfileKey(profileId);
    
    const profile: StrategicProfile = {
      id: profileId,
      userId,
      name: data.name || `Product ${profileId}`,
      businessType: data.businessType || 'product',
      businessDescription: data.businessDescription || '',
      targetCustomers: data.targetCustomers || '',
      productService: data.productService,
      customerFeedback: data.customerFeedback,
      website: data.website,
      businessLocation: data.businessLocation,
      primaryCustomerType: data.primaryCustomerType,
      primarySalesChannel: data.primarySalesChannel,
      primaryBusinessGoal: data.primaryBusinessGoal,
      strategyHighLevelBoundary: data.strategyHighLevelBoundary,
      exampleSprintPlanningPrompt: data.exampleSprintPlanningPrompt,
      exampleDailySearchQuery: data.exampleDailySearchQuery,
      productAnalysisSummary: data.productAnalysisSummary,
      reportSalesContextGuidance: data.reportSalesContextGuidance,
      reportSalesTargetingGuidance: data.reportSalesTargetingGuidance,
      dailySearchQueries: data.dailySearchQueries,
      status: data.status || 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    try {
      // Save the profile
      await db.set(key, JSON.stringify(profile));
      
      // Update user's profile list
      const userProfileIds = await this.getUserProfileIds(userId);
      const updatedProfileIds = [...userProfileIds, profileId];
      await db.set(this.getUserProfilesKey(userId), JSON.stringify(updatedProfileIds));
      
      console.log(`Created strategic profile ${profileId} for user ${userId}`);
      return profile;
    } catch (error) {
      console.error(`Error creating strategic profile for user ${userId}:`, error);
      throw new Error(`Failed to create strategic profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all strategic profiles for a user
   */
  static async getStrategicProfiles(userId: number): Promise<StrategicProfile[]> {
    try {
      const profileIds = await this.getUserProfileIds(userId);
      const profiles: StrategicProfile[] = [];
      
      for (const profileId of profileIds) {
        const key = this.getProfileKey(profileId);
        const data = await db.get(key);
        
        if (data && data.ok !== false) {
          try {
            const rawData = data.value || data;
            const profile = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            profiles.push(profile);
          } catch (parseError) {
            console.error(`Error parsing profile ${profileId}:`, parseError);
          }
        }
      }
      
      return profiles.sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first
    } catch (error) {
      console.error(`Error getting strategic profiles for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get a specific strategic profile
   */
  static async getStrategicProfile(profileId: number, userId: number): Promise<StrategicProfile | null> {
    try {
      const key = this.getProfileKey(profileId);
      const data = await db.get(key);
      
      if (!data || data.ok === false) {
        return null;
      }
      
      const rawData = data.value || data;
      const profile = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      
      // Verify ownership
      if (profile.userId !== userId) {
        return null;
      }
      
      return profile;
    } catch (error) {
      console.error(`Error getting strategic profile ${profileId}:`, error);
      return null;
    }
  }

  /**
   * Update a strategic profile
   */
  static async updateStrategicProfile(profileId: number, userId: number, data: Partial<StrategicProfile>): Promise<StrategicProfile | null> {
    try {
      const existingProfile = await this.getStrategicProfile(profileId, userId);
      if (!existingProfile) {
        return null;
      }
      
      const updatedProfile: StrategicProfile = {
        ...existingProfile,
        ...data,
        id: profileId, // Ensure ID doesn't change
        userId: userId, // Ensure userId doesn't change
        updatedAt: Date.now()
      };
      
      const key = this.getProfileKey(profileId);
      await db.set(key, JSON.stringify(updatedProfile));
      
      console.log(`Updated strategic profile ${profileId} for user ${userId}`);
      return updatedProfile;
    } catch (error) {
      console.error(`Error updating strategic profile ${profileId}:`, error);
      throw new Error(`Failed to update strategic profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a strategic profile
   */
  static async deleteStrategicProfile(profileId: number, userId: number): Promise<boolean> {
    try {
      const existingProfile = await this.getStrategicProfile(profileId, userId);
      if (!existingProfile) {
        return false;
      }
      
      // Remove from user's profile list
      const userProfileIds = await this.getUserProfileIds(userId);
      const updatedProfileIds = userProfileIds.filter(id => id !== profileId);
      await db.set(this.getUserProfilesKey(userId), JSON.stringify(updatedProfileIds));
      
      // Delete the profile
      const key = this.getProfileKey(profileId);
      await db.delete(key);
      
      console.log(`Deleted strategic profile ${profileId} for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting strategic profile ${profileId}:`, error);
      return false;
    }
  }
}