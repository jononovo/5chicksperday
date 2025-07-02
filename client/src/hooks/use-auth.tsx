import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { getQueryFn, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { firebaseAuth, firebaseGoogleProvider } from "@/lib/firebase";
import { 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  type User as FirebaseUser,
  type AuthCredential 
} from "firebase/auth";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  logoutMutation: UseMutationResult<void, Error, void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username?: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // 1. Clear localStorage first (prevent auto-restore)
      localStorage.removeItem('authToken');
      
      // 2. Clear axios headers
      const axios = (await import('axios')).default;
      delete axios.defaults.headers.common['Authorization'];
      
      // 3. Call backend logout (clear server session)
      try {
        await axios.post('/api/logout');
      } catch (error) {
        console.log('Backend logout failed, continuing with Firebase logout');
      }
      
      // 4. Firebase signOut last
      if (firebaseAuth) {
        try {
          await signOut(firebaseAuth);
        } catch (error) {
          console.error("Firebase sign out error:", error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signInWithEmail = async (email: string, password: string) => {
    try {
      if (!firebaseAuth) {
        console.error('Firebase auth not initialized');
        throw new Error("Authentication service is not properly configured");
      }

      console.log('Starting email sign-in process', {
        email: email.split('@')[0] + '@...',
        timestamp: new Date().toISOString()
      });

      const result = await signInWithEmailAndPassword(firebaseAuth, email, password);

      if (!result.user?.email) {
        throw new Error("No email available after sign-in");
      }

      console.log('Email sign-in successful, syncing with backend');
      await syncWithBackend(result.user);

    } catch (error: any) {
      console.error("Email sign-in error:", {
        error: error.message,
        code: error.code
      });

      // Show user-friendly error messages
      let errorMessage = "Please try again";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later";
      }

      toast({
        title: "Sign-in failed",
        description: errorMessage,
        variant: "destructive",
      });

      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, username?: string) => {
    try {
      if (!firebaseAuth) {
        console.error('Firebase auth not initialized');
        throw new Error("Authentication service is not properly configured");
      }

      console.log('Starting email registration process', {
        email: email.split('@')[0] + '@...',
        timestamp: new Date().toISOString()
      });

      const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      if (!result.user?.email) {
        throw new Error("No email available after registration");
      }

      // Set display name if username is provided
      if (username && result.user) {
        await updateProfile(result.user, {
          displayName: username
        });
      }

      console.log('Email registration successful, syncing with backend');
      await syncWithBackend(result.user);

    } catch (error: any) {
      console.error("Email registration error:", {
        error: error.message,
        code: error.code
      });

      // Show user-friendly error messages, but skip toast for email-already-in-use
      // (registration modal will handle this case with auto-login)
      if (error.code !== 'auth/email-already-in-use') {
        let errorMessage = "Please try again";
        if (error.code === 'auth/weak-password') {
          errorMessage = "Password is too weak. Please use a stronger password";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "Invalid email address";
        }

        toast({
          title: "Registration failed",
          description: errorMessage,
          variant: "destructive",
        });
      }

      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google sign-in process', {
        environment: import.meta.env.MODE,
        domain: window.location.hostname,
        origin: window.location.origin
      });

      if (!firebaseAuth || !firebaseGoogleProvider) {
        const configError = {
          auth: !!firebaseAuth,
          provider: !!firebaseGoogleProvider,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          environment: import.meta.env.MODE,
          domain: window.location.hostname
        };
        console.error('Firebase auth not initialized:', configError);
        throw new Error("Authentication service is not properly configured");
      }

      // Force re-authentication to request new scopes
      firebaseGoogleProvider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose'
        ].join(' ')
      });

      console.log('Calling signInWithPopup...');
      const result = await signInWithPopup(firebaseAuth, firebaseGoogleProvider);

      // Get the OAuth credential from the result
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      // Get the token result with detailed scope information
      const tokenResult = await result.user.getIdTokenResult();

      console.log('SignInWithPopup completed', {
        success: !!result,
        hasUser: !!result.user,
        hasEmail: !!result.user?.email,
        hasCredential: !!credential,
        hasAccessToken: !!credential?.accessToken,
        credentialType: credential?.providerId || 'none',
        scopes: tokenResult.claims.scope,
        timestamp: new Date().toISOString()
      });

      if (!result.user?.email) {
        throw new Error("No email provided from Google sign-in");
      }

      console.log('Google sign-in successful, syncing with backend', {
        email: result.user.email.split('@')[0] + '@...',
        displayName: result.user.displayName
      });

      // Pass the OAuth credential to syncWithBackend
      await syncWithBackend(result.user, credential);

    } catch (error: any) {
      console.error("Google sign-in error:", {
        error: error.message,
        code: error.code,
        domain: window.location.hostname,
        environment: import.meta.env.MODE
      });

      // Show a more user-friendly error message
      toast({
        title: "Google Sign-in failed",
        description: error.code === 'auth/popup-blocked'
          ? "Please allow popups for this site and try again"
          : "Please try again or use email/password login",
        variant: "destructive",
      });

      throw error;
    }
  };

  // Safely parse JSON with better error handling
  async function safeJsonParse(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch (error) {
      console.error('JSON parsing error:', {
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        error
      });
      
      // Get the text content for debugging
      try {
        const text = await res.clone().text();
        console.error('Response that failed to parse:', {
          text: text.substring(0, 500), // Log only first 500 chars to avoid huge logs
          contentType: res.headers.get('content-type')
        });
      } catch (textError) {
        console.error('Could not get response text after JSON parse error:', textError);
      }
      
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  // Function to get Firebase ID token and sync with backend
  const syncWithBackend = async (firebaseUser: FirebaseUser, credential?: AuthCredential | null) => {
    try {
      // Get the ID token for authentication
      const idToken = await firebaseUser.getIdToken(true);

      // Note: Firebase OAuth is for user authentication only
      // Gmail API tokens are handled separately via server-side Google OAuth
      console.log('Firebase OAuth completed - user authentication successful');
      console.log('Gmail API authorization will be handled separately via server-side OAuth');

      console.log('Making backend sync request', {
        endpoint: '/api/google-auth',
        domain: window.location.hostname
      });

      const createRes = await fetch("/api/google-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: firebaseUser.email,
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          firebaseUid: firebaseUser.uid
        })
      });

      if (!createRes.ok) {
        let errorText;
        try {
          errorText = await createRes.text();
        } catch (textError) {
          errorText = 'Could not read error response';
        }
        
        console.error('Backend sync error response:', {
          status: createRes.status,
          statusText: createRes.statusText,
          responseText: errorText
        });
        throw new Error(`Failed to sync with backend: ${createRes.status}`);
      }

      console.log('Successfully synced with backend');
      
      try {
        const user = await safeJsonParse(createRes);
        queryClient.setQueryData(["/api/user"], user);
      } catch (parseError) {
        console.error('Error parsing user data from sync response:', parseError);
        throw new Error('Failed to parse user data from backend response');
      }

    } catch (error) {
      console.error("Error syncing with backend:", {
        error,
        domain: window.location.hostname,
        environment: import.meta.env.MODE
      });
      throw error;
    }
  };

  // Monitor Firebase auth state
  useEffect(() => {
    console.log('Setting up Firebase auth state listener');

    if (!firebaseAuth) {
      console.warn('Firebase Auth not initialized in useEffect');
      return;
    }

    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser?.email);

      if (firebaseUser?.email) {
        try {
          await syncWithBackend(firebaseUser);
        } catch (error) {
          console.error('Error during auth state sync:', error);
          queryClient.setQueryData(["/api/user"], null);
        }
      } else {
        queryClient.setQueryData(["/api/user"], null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        logoutMutation,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}