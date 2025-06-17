import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema } from "@shared/schema";
import type { InsertUser } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { firebaseAuth, firebaseGoogleProvider } from "@/lib/firebase";
import GuestUserManager from "@/lib/guest-user-manager";

// Helper function remains unchanged
function getFirebaseErrorMessage(): string {
  if (!firebaseAuth || !firebaseGoogleProvider) {
    const missingVars = [];
    if (!import.meta.env.VITE_FIREBASE_API_KEY) missingVars.push('VITE_FIREBASE_API_KEY');
    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) missingVars.push('VITE_FIREBASE_PROJECT_ID');
    if (!import.meta.env.VITE_FIREBASE_APP_ID) missingVars.push('VITE_FIREBASE_APP_ID');

    if (missingVars.length > 0) {
      return `Missing environment variables: ${missingVars.join(', ')}`;
    }
    return 'Firebase initialization failed. Check console for detailed error messages.';
  }
  return '';
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);

  const loginForm = useForm<Pick<InsertUser, "email" | "password">>({
    resolver: zodResolver(userSchema.omit({ username: true })),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<Pick<InsertUser, "email" | "password">>({
    resolver: zodResolver(userSchema.omit({ username: true })),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      setLocation("/app");
    }
  }, [user, setLocation]);

  const onLogin = loginForm.handleSubmit(async (data) => {
    setLoginError(null);
    setIsLoginSubmitting(true);
    try {
      await signInWithEmail(data.email, data.password);
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError("Email/Password login is not enabled in Firebase settings");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setLoginError("Invalid email or password");
      } else {
        setLoginError(error.message || "Login failed. Please try again.");
      }
    } finally {
      setIsLoginSubmitting(false);
    }
  });

  const onRegister = registerForm.handleSubmit(async (data) => {
    setRegisterError(null);
    setIsRegisterSubmitting(true);
    try {
      // Get guest user ID to maintain persistent data through registration
      const guestUserId = GuestUserManager.getCurrentGuestId();
      
      // Add a default username based on email
      const username = data.email.split('@')[0];
      await registerWithEmail(data.email, data.password, username);
      
      // Guest user data will be automatically migrated by the backend
      // when the Firebase token is verified and matched to the guest ID
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/operation-not-allowed') {
        setRegisterError("Email/Password registration is not enabled in Firebase settings");
      } else if (error.code === 'auth/email-already-in-use') {
        setRegisterError("This email is already in use");
      } else if (error.code === 'auth/weak-password') {
        setRegisterError("Password is too weak. Please use a stronger password");
      } else {
        setRegisterError(error.message || "Registration failed. Please try again.");
      }
    } finally {
      setIsRegisterSubmitting(false);
    }
  });

  if (user) {
    return null;
  }

  const errorMessage = getFirebaseErrorMessage();
  const isFirebaseEnabled = !!(firebaseAuth && firebaseGoogleProvider);
  const firebaseButtonText = isFirebaseEnabled
    ? 'Sign in with Google'
    : 'Google Sign-in Unavailable';

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container max-w-screen-lg mx-auto py-8 flex-1">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Welcome to Simple B2B Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-4 text-4xl mb-6">
                <span>🐥</span>
                <span>🥚</span>
                <span>🥚</span>
                <span>🥚</span>
                <span>🥚</span>
              </div>
              <Button
                variant="outline"
                onClick={() => signInWithGoogle().catch(console.error)}
                disabled={!isFirebaseEnabled}
                className="w-full mb-6"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 mr-2" />
                {firebaseButtonText}
              </Button>

              {!isFirebaseEnabled && (
                <div className="text-sm text-destructive mb-6">
                  {errorMessage}
                  <div className="mt-2">
                    To fix this:
                    <ol className="list-decimal ml-6 mt-2">
                      <li>Check that all Firebase configuration values are correctly set in Replit Secrets</li>
                      <li>Verify the values match exactly with your Firebase Console</li>
                      <li>Ensure {window.location.hostname} is added to Authorized Domains in Firebase Console</li>
                      <li>Restart your Repl after making changes</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground italic">
                    Or continue with email
                  </span>
                </div>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={onLogin} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} autoComplete="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} autoComplete="current-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {loginError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{loginError}</AlertDescription>
                        </Alert>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoginSubmitting}
                      >
                        {isLoginSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Login
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={onRegister} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} autoComplete="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} autoComplete="new-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {registerError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{registerError}</AlertDescription>
                        </Alert>
                      )}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isRegisterSubmitting}
                      >
                        {isRegisterSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Register
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sell to 5 new people every day.</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm">
              <p>
                Access a powerful AI-driven sales routine that doesn't feel like work. Discover and reach out to cool people who want your product without spamming anyone.
              </p>
              <ul>
                <li>Advanced company and contact search</li>
                <li>Intelligent email discovery</li>
                <li>Automated enrichment</li>
                <li>Campaign management</li>
                <li>Custom email templates</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}