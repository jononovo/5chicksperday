import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { db } from '../../db';
import { strategicProfiles } from '../../../shared/schema';
import { eq, and, not } from 'drizzle-orm';

const router = Router();

// Set active product for email generation
router.post('/api/outreach/products/:id/activate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const productId = parseInt(req.params.id);
    
    // First, deactivate all other products for this user
    await db
      .update(strategicProfiles)
      .set({ isActive: false })
      .where(and(
        eq(strategicProfiles.userId, userId),
        not(eq(strategicProfiles.id, productId))
      ));
    
    // Then activate the selected product
    const [updated] = await db
      .update(strategicProfiles)
      .set({ isActive: true })
      .where(and(
        eq(strategicProfiles.id, productId),
        eq(strategicProfiles.userId, userId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error activating product:', error);
    res.status(500).json({ error: 'Failed to activate product' });
  }
});

// Get active product
router.get('/api/outreach/products/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const [activeProduct] = await db
      .select()
      .from(strategicProfiles)
      .where(and(
        eq(strategicProfiles.userId, userId),
        eq(strategicProfiles.isActive, true)
      ))
      .limit(1);
    
    res.json(activeProduct || null);
  } catch (error) {
    console.error('Error fetching active product:', error);
    res.status(500).json({ error: 'Failed to fetch active product' });
  }
});

export function registerActiveProductRoutes(app: any) {
  app.use(router);
}