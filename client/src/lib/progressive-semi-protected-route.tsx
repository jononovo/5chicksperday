import { Route } from "wouter";
import { useNonBlockingAuth, type AuthState } from "@/hooks/use-non-blocking-auth";

// Progressive semi-protected route that renders immediately with background auth
export function ProgressiveSemiProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: (authState: AuthState) => React.JSX.Element;
}) {
  // Use non-blocking auth - component renders immediately
  const authState = useNonBlockingAuth();
  
  return (
    <Route path={path}>
      <Component {...authState} />
    </Route>
  );
}