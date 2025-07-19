import {Request } from "express";

export function getUserId(req: Request): number {
  try {
    // First check if user is authenticated through session
    if (
      req.isAuthenticated &&
      req.isAuthenticated() &&
      req.user &&
      (req.user as any).id
    ) {
      return (req.user as any).id;
    }

    // Then check for Firebase authentication - this should now be properly set after the middleware fix
    if ((req as any).firebaseUser && (req as any).firebaseUser.id) {
      return (req as any).firebaseUser.id;
    }
  } catch (error) {
    console.error("Error accessing user ID:", error);
  }

  // For routes that handle list/company data, we need to determine if this is:
  // 1. A new user who should see demo data (return 1)
  // 2. A user who just logged out and needs a clean state (don't return user 1's data)

  // Check for recent logout by looking at the logout timestamp in the session
  const recentlyLoggedOut =
    (req.session as any)?.logoutTime &&
    Date.now() - (req.session as any).logoutTime < 60000; // Within last minute

  if (recentlyLoggedOut) {
    // For recently logged out users, return a non-existent user ID
    // This ensures they don't see the previous user's data
    console.log("Recently logged out user - returning non-existent user ID");
    return -1; // This ID won't match any real user, preventing data leakage
  }

  console.log(
    "No authenticated user found - using demo user ID for compatibility",
    {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      hasFirebaseUser: !!(req as any).firebaseUser,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  );

  // For regular unauthenticated users, return demo user ID
  return 1;
}
