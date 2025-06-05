import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User as SelectUser } from "@shared/schema";

export interface AuthState {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
}

export function useNonBlockingAuth(): AuthState {
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Critical changes to make it non-blocking:
    retry: false,              // Don't retry failed requests
    staleTime: 30000,          // Cache for 30 seconds
    refetchOnWindowFocus: false,
    enabled: true              // Start immediately but don't block
  });

  return { 
    user: user || null, 
    isLoading, 
    error 
  };
}