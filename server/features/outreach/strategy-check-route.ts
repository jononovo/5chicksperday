import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { db } from '../../db';
import { strategicProfiles } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const router = Router();

// Check if user has a strategic profile
router.get('/api/strategic-profiles/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Count active strategic profiles for the user
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(strategicProfiles)
    .where(and(
      eq(strategicProfiles.userId, userId),
      eq(strategicProfiles.isActive, true)
    ));
    
    const profileCount = result[0]?.count || 0;
    
    res.json({
      hasProfile: profileCount > 0,
      profileCount: profileCount
    });
  } catch (error) {
    console.error('Error checking strategic profile:', error);
    res.status(500).json({ error: 'Failed to check strategic profile' });
  }
});

export function registerStrategyCheckRoutes(app: any) {
  app.use(router);
}