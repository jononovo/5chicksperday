import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { db } from '../../db';
import { strategicProfiles } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get user's products (strategic profiles) for Streak page
router.get('/api/outreach/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get last 3 strategic profiles for the user
    const products = await db
      .select({
        id: strategicProfiles.id,
        title: strategicProfiles.title,
        businessType: strategicProfiles.businessType,
        businessDescription: strategicProfiles.businessDescription,
        productService: strategicProfiles.productService,
        customerFeedback: strategicProfiles.customerFeedback,
        website: strategicProfiles.website,
        createdAt: strategicProfiles.createdAt,
        status: strategicProfiles.status
      })
      .from(strategicProfiles)
      .where(eq(strategicProfiles.userId, userId))
      .orderBy(desc(strategicProfiles.createdAt))
      .limit(3);
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching user products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get count of all user's products
router.get('/api/outreach/products/count', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const [result] = await db
      .select({
        count: strategicProfiles.id
      })
      .from(strategicProfiles)
      .where(eq(strategicProfiles.userId, userId));
    
    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error counting user products:', error);
    res.status(500).json({ error: 'Failed to count products' });
  }
});

export function registerProductsRoutes(app: any) {
  app.use(router);
}