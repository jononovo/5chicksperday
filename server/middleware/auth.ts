import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
}

export function getUserId(req: Request): number | null {
  const user = (req as any).user;
  return user?.id || null;
}