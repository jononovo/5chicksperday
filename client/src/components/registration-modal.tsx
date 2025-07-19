import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Mail, ChevronRight, ArrowLeft } from "lucide-react";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { firebaseAuth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type RegistrationPage = "main" | "login" | "forgotPassword";

export function RegistrationModal() {
  const [currentPage, setCurrentPage] = useState<RegistrationPage>("main");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailValid, setEmailValid] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const forgotPasswordEmailRef = useRef<HTMLInputElement>(null);
  
  // Use the auth hook
  const { user, signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const { closeModal, isOpenedFromProtectedRoute } = useRegistrationModal();
  const { toast } = useToast();

  // If user is already logged in, we'll close the modal
  // but we don't return early to avoid React hooks errors
  useEffect(() => {
    if (user) {
      closeModal();
    }
  }, [user, closeModal]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleLoginClick = () => {
    setCurrentPage("login");
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      closeModal();
    } catch (error) {
      // Error handling is already done in the signInWithGoogle function
      console.error("Google sign-in failed:", error);
    }
  };

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = regex.test(email);
    setEmailValid(isValid);
    return isValid;
  };
  
  // Focus the appropriate input field when the page changes
  useEffect(() => {
    if (currentPage === "main") {
      // Focus the name input field on main page
      setTimeout(() => nameInputRef.current?.focus(), 100);
    } else if (currentPage === "login") {
      // Focus the email input field on the login page
      setTimeout(() => loginEmailRef.current?.focus(), 100);
    } else if (currentPage === "forgotPassword") {
      // Focus the email input field on the forgot password page
      setTimeout(() => forgotPasswordEmailRef.current?.focus(), 100);
      // Reset the email sent flag when navigating to this page
      setResetEmailSent(false);
    }
  }, [currentPage]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    validateEmail(value);
  };

  const handleForgotPassword = () => {
    setCurrentPage("forgotPassword");
    // Reset email field for a fresh start
    setEmail("");
    setEmailValid(false);
  };

  const handleReturnToMain = () => {
    setCurrentPage("main");
    // Reset form fields
    setName("");
    setEmail("");
    setPassword("");
    setEmailValid(false);
  };

  const handleForgotPasswordSubmit = async () => {
    if (validateEmail(email)) {
      try {
        if (!firebaseAuth) {
          throw new Error("Firebase not initialized");
        }
        
        await sendPasswordResetEmail(firebaseAuth, email);
        setResetEmailSent(true);
      } catch (error) {
        setCurrentPage("main");
        console.error("Password reset error:", error);
        toast({
          title: "Password Reset Failed",
          description: "Could not send reset email. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async () => {
    // Different validation rules for registration vs login
    if (!validateEmail(email)) return;
    
    // For registration on main page, enforce 8+ character password only if email includes @
    // This allows users to proceed if they haven't reached the password field yet
    if (currentPage === "main" && email.includes('@') && password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    
    if (currentPage === "main") {
      try {
        // Register user with Firebase authentication
        console.log("Attempting registration with:", { email, name });
        
        await registerWithEmail(email, password, name);
        
        console.log("Registration successful with Firebase");
        closeModal();
      } catch (error: any) {
        console.error("Registration error:", error);
        
        // Check if email already exists - attempt login
        if (error.code === 'auth/email-already-in-use') {
          try {
            console.log("Email exists, attempting login with:", { email });
            await signInWithEmail(email, password);
            toast({
              title: "Welcome back!",
              description: "Account already exists - Logging you in",
              variant: "default",
              duration: 4000,
            });
            closeModal();
          } catch (loginError: any) {
            console.error("Login attempt failed:", loginError);
            toast({
              title: "Account already exists",
              description: "Please try logging in with the correct password",
              variant: "destructive",
            });
          }
        } else if (error.code === 'auth/operation-not-allowed') {
          toast({
            title: "Email/Password Sign-up Not Enabled",
            description: "Email/Password authentication needs to be enabled in the Firebase Console.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration Failed",
            description: error.message || "Please try again.",
            variant: "destructive",
          });
        }
      }
    } else if (currentPage === "login") {
      try {
        // Sign in with Firebase authentication
        console.log("Attempting login with:", { email });
        
        await signInWithEmail(email, password);
        
        console.log("Login successful with Firebase");
        closeModal();
      } catch (error: any) {
        console.error("Login error:", error);
        
        // Special handling for operation-not-allowed error
        if (error.code === 'auth/operation-not-allowed') {
          toast({
            title: "Email/Password Login Not Enabled",
            description: "Email/Password authentication needs to be enabled in the Firebase Console.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message || "Invalid email or password.",
            variant: "destructive",
          });
        }
      }
    }
  };

  // Don't render the modal if user is already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Login link in upper right */}
      <div className="absolute top-6 right-6 z-10">
        <button 
          onClick={handleLoginClick}
          className="text-white hover:text-blue-300 transition-colors font-medium"
        >
          Sign In
        </button>
      </div>
      
      <div className="bg-black/90 border border-white/10 rounded-lg w-full max-w-full sm:max-w-md mx-auto relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-pink-600/10"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
            `
          }}
        />
        
        <div className="relative p-8">
          {currentPage === "main" && (
            <div className="w-full max-w-md mx-auto">
              <div className="text-center text-white mb-8">
                <h2 className="text-3xl font-bold mb-3">
                  {isOpenedFromProtectedRoute ? "Join to Continue" : "Join 5Ducks"}
                </h2>
                <p className="text-gray-200 text-lg">
                  {isOpenedFromProtectedRoute 
                    ? "Sign up or log in to access this feature" 
                    : "Start prospecting with AI-powered sales tools"
                  }
                </p>
              </div>

              <div className="space-y-4 max-w-sm mx-auto px-2 sm:px-4">
                {/* Registration form */}
                <div className="space-y-4">
                  <input
                    ref={nameInputRef}
                    type="text"
                    placeholder="Full Name"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="Work Email"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                    value={email}
                    onChange={handleEmailChange}
                  />
                  
                  {/* Password field only appears after @ is typed in email */}
                  {email.includes('@') && (
                    <div>
                      <input
                        type="password"
                        placeholder="Password"
                        className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                      />
                      <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
                    </div>
                  )}
                  
                  {/* Create Account button always visible */}
                  <Button 
                    variant="outline" 
                    className={`w-full justify-center transition-all duration-300 group ${
                      emailValid && (!email.includes('@') || password.length >= 8)
                        ? 'bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-800 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white hover:text-white border-0 shadow-lg'
                        : 'bg-transparent hover:bg-white/10 text-white border border-white/30 hover:border-white/50'
                    }`}
                    onClick={handleSubmit}
                    disabled={!emailValid || (email.includes('@') && password.length < 8)}
                  >
                    <span className="transition-all duration-700 delay-1000 group-hover:opacity-0 group-hover:scale-95">Create Account</span>
                    <span className="absolute transition-all duration-700 delay-1000 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100">Let's Go 🚀</span>
                  </Button>
                </div>

                {/* Alternative registration options - always visible */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-black/70 text-gray-400">OR</span>
                  </div>
                </div>

                {/* Google Sign-in Button - always visible */}
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-center relative bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                    onClick={handleGoogleSignIn}
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </Button>

                </div>

                {/* Login link */}
                <div className="text-center mt-6 pt-5">
                  <p className="text-gray-400 text-sm">
                    Already have an account?{" "}
                    <button 
                      onClick={handleLoginClick}
                      className="text-blue-300 hover:text-blue-200 transition-colors font-medium"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentPage === "login" && (
            <div className="w-full max-w-md mx-auto">
              {/* Back button above title */}
              <div className="flex justify-start mb-4 sm:mb-6 px-2 sm:px-4">
                <button 
                  onClick={handleReturnToMain}
                  className="text-sm text-white hover:text-blue-300 transition-colors flex items-center gap-1 p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
              
              {/* Main content */}
              <div className="text-center text-white mb-8">
                <h2 className="text-3xl font-bold mb-3">Welcome Back</h2>
                <p className="text-gray-200 text-lg">Log in to your account</p>
              </div>

              {/* Login form */}
              <div className="space-y-4 max-w-sm mx-auto px-2 sm:px-4">
                <div className="space-y-4">
                  <input
                    ref={loginEmailRef}
                    type="email"
                    placeholder="Email"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                    value={email}
                    onChange={handleEmailChange}
                  />
                  
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  
                  <Button 
                    variant="outline" 
                    className={`w-full justify-center transition-all duration-300 ${
                      emailValid && password.length > 0
                        ? 'bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-800 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white hover:text-white border-0 shadow-lg'
                        : 'bg-transparent hover:bg-white/10 text-white border border-white/30 hover:border-white/50'
                    }`}
                    onClick={handleSubmit}
                    disabled={!emailValid || password.length === 0}
                  >
                    Sign In
                  </Button>
                </div>

                {/* Forgot password link */}
                <div className="text-center">
                  <button 
                    onClick={handleForgotPassword}
                    className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>

                {/* Google Sign-in Button for login page */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-black/70 text-gray-400">OR</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full justify-center relative bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </div>
            </div>
          )}

          {currentPage === "forgotPassword" && (
            <div className="w-full max-w-md mx-auto relative">
              {/* Back button in upper left corner */}
              <div className="absolute top-0 left-0 mt-6 ml-6 z-10">
                <button 
                  onClick={handleReturnToMain}
                  className="text-sm text-white hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
              
              {/* Main content */}
              <div className="text-center text-white mb-8 mt-16">
                <h2 className="text-3xl font-bold mb-3">Reset Password</h2>
                <p className="text-gray-200 text-lg">Enter your email to receive reset instructions</p>
              </div>

              {/* Reset form */}
              <div className="space-y-4 max-w-sm mx-auto px-4">
                {!resetEmailSent ? (
                  <>
                    <input
                      ref={forgotPasswordEmailRef}
                      type="email"
                      placeholder="Email"
                      className="w-full p-4 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-300"
                      value={email}
                      onChange={handleEmailChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleForgotPasswordSubmit();
                        }
                      }}
                    />
                    
                    <Button 
                      variant="outline" 
                      className={`w-full justify-center transition-all duration-300 ${
                        emailValid
                          ? 'bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-800 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white hover:text-white border-0 shadow-lg'
                          : 'bg-transparent hover:bg-white/10 text-white border border-white/30 hover:border-white/50'
                      }`}
                      onClick={handleForgotPasswordSubmit}
                      disabled={!emailValid}
                    >
                      Send Reset Email
                    </Button>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4 text-white mb-4">
                      <h3 className="font-bold mb-2">Email Sent!</h3>
                      <p className="text-sm">Check your inbox for password reset instructions.</p>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-center relative bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 border-2 border-blue-400 hover:border-blue-300"
                      onClick={handleReturnToMain}
                    >
                      Return to Sign In
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}