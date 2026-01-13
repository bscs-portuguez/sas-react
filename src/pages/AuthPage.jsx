import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, signOut, deleteUser, updatePassword } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { getOrganizationsByType } from "../services/organizationService";
import { createUserDocument, getUserById } from "../services/userService";
import { sendOTP, verifyOTP } from "../services/otpService";
import { validatePasswordStrength } from "../utils/passwordValidation";
import { getUserByEmail } from "../services/userService";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import earistLogo from "../assets/images/logos/earist-logo.png";
import sasBanner from "../assets/images/banners/sas-banner.png";
import "../styles/colors.css";
import "../styles/auth.css";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Register state
  const [fullName, setFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerPasswordStrength, setRegisterPasswordStrength] = useState(null);
  const [role, setRole] = useState(""); // "ISG" | "CSG" | "AO" (organization type)
  const [organizationId, setOrganizationId] = useState("");
  const [userRole, setUserRole] = useState(""); // User's position/role in their organization
  
  // Organization state
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  
  // OTP verification state
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingAuth, setPendingAuth] = useState(null); // Store pending auth data
  const isVerifyingRef = useRef(false); // Track if we're in the verification flow
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordOTP, setForgotPasswordOTP] = useState("");
  const [showForgotPasswordOTP, setShowForgotPasswordOTP] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  
  // Google login organization form state
  const [showGoogleOrgForm, setShowGoogleOrgForm] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [googleRole, setGoogleRole] = useState("");
  const [googleOrganizationId, setGoogleOrganizationId] = useState("");
  const [googleUserRole, setGoogleUserRole] = useState("");
  const [googleOrganizations, setGoogleOrganizations] = useState([]);
  
  // Common state
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Restore OTP verification state if component remounts during verification
  useEffect(() => {
    const savedPendingAuth = sessionStorage.getItem("pendingAuth");
    const savedOTPEmail = sessionStorage.getItem("otpEmail");
    
    if (savedPendingAuth && savedOTPEmail) {
      try {
        const authData = JSON.parse(savedPendingAuth);
        setPendingAuth(authData);
        setShowOTPVerification(true);
        isVerifyingRef.current = true;
        
        // Restore form state based on auth type
        if (authData.type === "register") {
          setIsLogin(false); // Stay on registration form
        } else {
          setIsLogin(true); // Stay on login form
        }
      } catch (err) {
        console.error("Error restoring OTP state:", err);
        sessionStorage.removeItem("pendingAuth");
        sessionStorage.removeItem("otpEmail");
      }
    }
  }, []);

  // Fetch organizations when role changes
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!role) {
        setOrganizations([]);
        setOrganizationId("");
        return;
      }
      
      setLoadingOrganizations(true);
      setOrganizationId(""); // Reset selection when role changes
      
      try {
        const orgs = await getOrganizationsByType(role);
        setOrganizations(orgs);
      } catch (err) {
        console.error("Error fetching organizations:", err);
        setError("Failed to load organizations. Please try again.");
        setOrganizations([]);
      } finally {
        setLoadingOrganizations(false);
      }
    };
    
    fetchOrganizations();
  }, [role]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    // Clear any previous error state and sessionStorage
    setError("");
    setLoading(true);
    isVerifyingRef.current = true;
    setPendingAuth(null);
    sessionStorage.removeItem("pendingAuth");
    sessionStorage.removeItem("otpEmail");

    try {
      // Step 1: Validate email and password by attempting sign-in
      // This will fail immediately if credentials are wrong
      let credentialsValid = false;
      try {
        // Set sessionStorage BEFORE signing in, so App.jsx knows to stay on AuthPage
        const authData = { type: "login", email, password };
        sessionStorage.setItem("pendingAuth", JSON.stringify(authData));
        sessionStorage.setItem("otpEmail", email);
        
        await signInWithEmailAndPassword(auth, email, password);
        // Sign-in succeeded - credentials are valid
        // Sign out immediately (we'll sign in again after OTP verification)
        await signOut(auth);
        // Small delay to ensure auth state updates before proceeding
        await new Promise(resolve => setTimeout(resolve, 150));
        credentialsValid = true;
        
        // Store pending auth in state
        setPendingAuth(authData);
      } catch (authError) {
        // Reset all verification state on error
        isVerifyingRef.current = false;
        setPendingAuth(null);
        sessionStorage.removeItem("pendingAuth");
        sessionStorage.removeItem("otpEmail");
        
        // Log the full error for debugging
        console.error("Firebase Auth Error:", authError);
        console.error("Error Code:", authError.code);
        console.error("Error Message:", authError.message);
        
        // Credentials are invalid - show error immediately (no OTP sent)
        let errorMessage = "Invalid email or password. Please check your credentials and try again.";
        
        if (authError.code === "auth/invalid-credential" || authError.code === "auth/invalid-credential") {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        } else if (authError.code === "auth/user-not-found") {
          errorMessage = "No account found with this email. Please register first.";
        } else if (authError.code === "auth/wrong-password") {
          errorMessage = "Incorrect password. Please try again.";
        } else if (authError.code === "auth/invalid-email") {
          errorMessage = "Invalid email address. Please check and try again.";
        } else if (authError.code === "auth/user-disabled") {
          errorMessage = "This account has been disabled. Please contact support.";
        } else if (authError.code === "auth/too-many-requests") {
          errorMessage = "Too many failed login attempts. Please try again later.";
        } else if (authError.code === "auth/network-request-failed") {
          errorMessage = "Network error. Please check your internet connection and try again.";
        } else if (authError.message) {
          errorMessage = `Authentication error: ${authError.message}`;
        }
        
        setError(errorMessage);
        setLoading(false);
        return; // Don't send OTP if credentials are wrong
      }

      // Step 2: Credentials are valid, send OTP
      if (credentialsValid) {
        try {
          // sessionStorage already set before validation (in Step 1)
          await sendOTP(email);
          // Set state immediately
          setShowOTPVerification(true);
          setError("");
          setLoading(false);
        } catch (otpError) {
          console.error("Error sending OTP:", otpError);
          isVerifyingRef.current = false;
          setPendingAuth(null);
          sessionStorage.removeItem("pendingAuth");
          sessionStorage.removeItem("otpEmail");
          setError(otpError.message || "Failed to send OTP. Please try again.");
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      // Reset all state on any error
      isVerifyingRef.current = false;
      setPendingAuth(null);
      sessionStorage.removeItem("pendingAuth");
      sessionStorage.removeItem("otpEmail");
      setError(err.message || "Failed to send OTP. Please try again.");
      setLoading(false);
    }
  };

  // Handler for OTP verification
  const handleOTPVerification = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isValid = await verifyOTP(pendingAuth.email, otpCode);
      
      if (!isValid) {
        setError("Invalid OTP code. Please try again.");
        return;
      }

      // OTP verified, proceed with authentication
      if (pendingAuth.type === "login") {
        try {
          await signInWithEmailAndPassword(auth, pendingAuth.email, pendingAuth.password);
          // Success - reset OTP state
          isVerifyingRef.current = false;
          sessionStorage.removeItem("pendingAuth");
          sessionStorage.removeItem("otpEmail");
          setShowOTPVerification(false);
          setOtpCode("");
          setPendingAuth(null);
        } catch (authError) {
          // Handle sign-in errors after OTP verification
          let errorMessage = "Authentication failed. Please try logging in again.";
          
          if (authError.code === "auth/invalid-credential" || authError.code === "auth/invalid-credential") {
            errorMessage = "Invalid email or password. Please check your credentials and try again.";
          } else if (authError.code === "auth/user-not-found") {
            errorMessage = "No account found with this email. Please register first.";
          } else if (authError.code === "auth/wrong-password") {
            errorMessage = "Incorrect password. Please try again.";
          } else if (authError.message) {
            errorMessage = authError.message;
          }
          
          setError(errorMessage);
          setLoading(false);
          return;
        }
      } else if (pendingAuth.type === "register") {
        try {
          // Create Firebase Auth account
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            pendingAuth.email,
            pendingAuth.password
          );
          
          const userId = userCredential.user.uid;
          
          // Create user document in Firestore
          await createUserDocument(userId, {
            fullName: pendingAuth.fullName,
            email: pendingAuth.email,
            role: pendingAuth.role,
            organizationId: pendingAuth.organizationId,
            userRole: pendingAuth.userRole
          });
          
          // Success - reset OTP state
          isVerifyingRef.current = false;
          sessionStorage.removeItem("pendingAuth");
          sessionStorage.removeItem("otpEmail");
          setShowOTPVerification(false);
          setOtpCode("");
          setPendingAuth(null);
          // User will be redirected by App.jsx after organization info is checked
        } catch (authError) {
          // Handle registration errors after OTP verification
          let errorMessage = "Registration failed. Please try again.";
          
          if (authError.code === "auth/email-already-in-use") {
            errorMessage = "This email is already registered. Please login instead.";
          } else if (authError.code === "auth/invalid-email") {
            errorMessage = "Invalid email address. Please check and try again.";
          } else if (authError.code === "auth/weak-password") {
            errorMessage = "Password is too weak. Please use a stronger password.";
          } else if (authError.message) {
            errorMessage = authError.message;
          }
          
          setError(errorMessage);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(err.message || "Failed to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!role) {
      setError("Please select a role.");
      return;
    }
    
    if (!organizationId) {
      setError("Please select an organization.");
      return;
    }
    
    if (!userRole || userRole.trim() === "") {
      setError("Please enter your role/position in the organization.");
      return;
    }
    
    if (registerPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(registerPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join(". "));
      return;
    }
    
    setLoading(true);

    try {
      // Step 1: Validate account creation (email not in Auth, password strength)
      // Try to create account - this will fail if email exists in Auth or password is weak
      let accountValid = false;
      let tempUser = null;
      
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          registerEmail,
          registerPassword
        );
        tempUser = userCredential.user;
        // Account creation succeeded - credentials are valid
        // Delete the account immediately (we'll create it again after OTP verification)
        await deleteUser(tempUser);
        accountValid = true;
      } catch (authError) {
        // Account creation failed - show error immediately (no OTP sent)
        let errorMessage = "Registration failed. Please try again.";
        
        if (authError.code === "auth/email-already-in-use") {
          errorMessage = "This email is already registered. Please login instead.";
        } else if (authError.code === "auth/invalid-email") {
          errorMessage = "Invalid email address. Please check and try again.";
        } else if (authError.code === "auth/weak-password") {
          errorMessage = "Password is too weak. Please use a stronger password (at least 6 characters).";
        } else if (authError.message) {
          errorMessage = authError.message;
        }
        
        setError(errorMessage);
        setLoading(false);
        return; // Don't send OTP if validation fails
      }

      // Step 2: Account validation passed, send OTP
      if (accountValid) {
        // Save to sessionStorage before sending OTP (in case component unmounts)
        const authData = {
          type: "register",
          email: registerEmail,
          password: registerPassword,
          fullName: fullName,
          role: role,
          organizationId: organizationId,
          userRole: userRole.trim()
        };
        sessionStorage.setItem("pendingAuth", JSON.stringify(authData));
        sessionStorage.setItem("otpEmail", registerEmail);
        
        await sendOTP(registerEmail);
        setShowOTPVerification(true);
        setPendingAuth(authData);
        setError("");
        setLoading(false);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user has organization info in Firestore
      const userDoc = await getUserById(user.uid);
      
      if (!userDoc || !userDoc.organizationId || !userDoc.role || !userDoc.userRole) {
        // User needs to complete organization info
        setGoogleUser(user);
        setShowGoogleOrgForm(true);
        setLoading(false);
        return;
      }
      
      // User has all info, proceed normally
      // Navigation will be handled by App.jsx
    } catch (err) {
      setError(err.message || "Failed to sign in with Google.");
      setLoading(false);
    }
  };

  // Fetch organizations for Google login form
  useEffect(() => {
    const fetchGoogleOrganizations = async () => {
      if (!googleRole) {
        setGoogleOrganizations([]);
        setGoogleOrganizationId("");
        return;
      }
      
      try {
        const orgs = await getOrganizationsByType(googleRole);
        setGoogleOrganizations(orgs);
      } catch (err) {
        console.error("Error fetching organizations:", err);
        setError("Failed to load organizations. Please try again.");
        setGoogleOrganizations([]);
      }
    };
    
    if (showGoogleOrgForm) {
      fetchGoogleOrganizations();
    }
  }, [googleRole, showGoogleOrgForm]);

  // Handler for Google login organization form submission
  const handleGoogleOrgFormSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!googleRole) {
      setError("Please select an organization type.");
      return;
    }
    
    if (!googleOrganizationId) {
      setError("Please select an organization.");
      return;
    }
    
    if (!googleUserRole || googleUserRole.trim() === "") {
      setError("Please enter your role/position in the organization.");
      return;
    }
    
    setLoading(true);

    try {
      // Check if user document already exists
      const existingUser = await getUserById(googleUser.uid);
      
      if (existingUser) {
        // Update existing user document with organization info
        const userRef = doc(db, "users", googleUser.uid);
        await updateDoc(userRef, {
          fullName: googleUser.displayName || existingUser.fullName || "",
          email: googleUser.email || existingUser.email || "",
          role: googleRole,
          organizationId: googleOrganizationId,
          userRole: googleUserRole.trim(),
          lastUpdated: serverTimestamp()
        });
      } else {
        // Create new user document with organization info
        await createUserDocument(googleUser.uid, {
          fullName: googleUser.displayName || "",
          email: googleUser.email,
          role: googleRole,
          organizationId: googleOrganizationId,
          userRole: googleUserRole.trim()
        });
      }
      
      // Reset form state
      setShowGoogleOrgForm(false);
      setGoogleUser(null);
      setGoogleRole("");
      setGoogleOrganizationId("");
      setGoogleUserRole("");
      
      // Force page reload to trigger App.jsx re-check of organization info
      window.location.reload();
    } catch (err) {
      console.error("Error saving organization info:", err);
      setError(err.message || "Failed to save organization information.");
      setLoading(false);
    }
  };

  // Forgot Password Handlers
  const handleForgotPasswordInit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate email format
      if (!forgotPasswordEmail || !forgotPasswordEmail.includes("@")) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
      }

      // Check if user exists in Firestore
      const userDoc = await getUserByEmail(forgotPasswordEmail);
      if (!userDoc) {
        setError("No account found with this email. Please register first.");
        setLoading(false);
        return;
      }

      // Send OTP to email
      await sendOTP(forgotPasswordEmail);
      setShowForgotPasswordOTP(true);
      setError("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordOTP = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isValid = await verifyOTP(forgotPasswordEmail, forgotPasswordOTP);
      
      if (!isValid) {
        setError("Invalid OTP code. Please try again.");
        setLoading(false);
        return;
      }

      // OTP verified, show password reset form
      setShowForgotPasswordOTP(false);
      setOtpVerified(true);
      setError("");
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(err.message || "Failed to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate passwords match
      if (newPassword !== confirmNewPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.errors.join(". "));
        setLoading(false);
        return;
      }

      // Call backend API to update password (requires Admin SDK)
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      let response;
      try {
        response = await fetch(`${apiUrl}/api/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: forgotPasswordEmail,
            newPassword: newPassword,
            otpVerified: true // Backend should verify OTP was checked
          }),
        });
      } catch (fetchError) {
        // Network error or backend not available
        if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
          throw new Error("Backend API is not available. Please ensure the backend server is running and configured with Firebase Admin SDK. See FORGOT_PASSWORD_IMPLEMENTATION.md for setup instructions.");
        }
        throw fetchError;
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Response is not JSON (probably HTML error page)
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error(`Backend returned an error. Please check if the backend server is running and the /api/reset-password endpoint exists. Status: ${response.status}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to reset password');
      }

      // Success - reset form and show success message
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
      setForgotPasswordOTP("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowForgotPasswordOTP(false);
      setOtpVerified(false);
      setError("");
      alert("Password reset successfully! Please login with your new password.");
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err.message || "Failed to reset password. Please try again.");
      setLoading(false);
    }
  };

  // Get dynamic label for Google org form
  const getGoogleOrganizationLabel = () => {
    if (googleRole === "ISG") return "Department";
    if (googleRole === "CSG") return "College";
    if (googleRole === "AO") return "Organization Name";
    return "Organization / Council";
  };

  const switchToRegister = () => {
    setError("");
    setIsLogin(false);
    // Reset registration form
    setFullName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setConfirmPassword("");
    setRole("");
    setOrganizationId("");
    setUserRole("");
    setOrganizations([]);
  };

  const switchToLogin = () => {
    setError("");
    setIsLogin(true);
    // Reset registration form
    setFullName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setConfirmPassword("");
    setRole("");
    setOrganizationId("");
    setUserRole("");
    setOrganizations([]);
  };

  // Get dynamic label for organization dropdown based on selected role
  const getOrganizationLabel = () => {
    if (role === "ISG") return "Department";
    if (role === "CSG") return "College";
    if (role === "AO") return "Organization Name";
    if (role === "admin") return "Organization";
    return "Organization / Council";
  };

  // Get placeholder text for organization dropdown
  const getOrganizationPlaceholder = () => {
    if (loadingOrganizations) return "Loading organizations...";
    if (!role) return "Please select an organization type first";
    if (organizations.length === 0) return "No organizations available";
    if (role === "ISG") return "Select your department";
    if (role === "CSG") return "Select your college";
    if (role === "AO") return "Select your organization";
    if (role === "admin") return "Select your organization";
    return "Select your organization";
  };

  return (
    <div className="auth-container">
      <div className="auth-background" style={{ backgroundImage: `url(${sasBanner})` }}></div>
      <div className="auth-overlay"></div>
      <div className="auth-content">
        <div className={`auth-card ${isLogin ? 'show' : 'hide'}`}>
          {/* Login Form */}
          <div className="auth-form-wrapper">
            <div className="auth-logo">
              <img src={earistLogo} alt="EARIST Logo" />
            </div>

            <h1 className="auth-title">Student Affairs and Services Portal</h1>
            <p className="auth-subtitle">Eulogio "Amang" Rodriguez Institute of Science and Technology</p>

            <form onSubmit={handleEmailLogin} className="auth-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <a 
                  href="#" 
                  className="forgot-password-link" 
                    onClick={(e) => { 
                    e.preventDefault(); 
                    setShowForgotPassword(true);
                    setForgotPasswordEmail("");
                    setForgotPasswordOTP("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setShowForgotPasswordOTP(false);
                    setOtpVerified(false);
                    setError("");
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="google-button"
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Login with Google
            </button>

            <div className="auth-switch">
              <p>
                Don't have an account yet?{" "}
                <button type="button" className="switch-link" onClick={switchToRegister}>
                  Register
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className={`auth-card ${!isLogin ? 'show' : 'hide'}`}>
          {/* Registration Form */}
          <div className="auth-form-wrapper">
            <div className="auth-logo">
              <img src={earistLogo} alt="EARIST Logo" />
            </div>

            <h1 className="auth-title">Create Your Account</h1>
            <p className="auth-subtitle">Join the EARIST Student Affairs and Services Portal</p>

            <form onSubmit={handleEmailRegister} className="auth-form">
              <div className="form-group">
                <label htmlFor="role" className="form-label">Organization</label>
                <select
                  id="role"
                  className="form-input form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  disabled={loading || loadingOrganizations}
                >
                  <option value="">Select organization type</option>
                  <option value="ISG">Institute Student Government (ISG)</option>
                  <option value="CSG">College Student Governments (CSG)</option>
                  <option value="AO">Accredited Organizations (AO)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="organizationId" className="form-label">{getOrganizationLabel()}</label>
                <select
                  id="organizationId"
                  className="form-input form-select"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  required
                  disabled={loading || loadingOrganizations || !role || organizations.length === 0}
                >
                  <option value="">
                    {getOrganizationPlaceholder()}
                  </option>
                  {organizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="userRole" className="form-label">Role</label>
                <input
                  id="userRole"
                  type="text"
                  className="form-input"
                  placeholder="Enter your role/position (e.g., President, Secretary, Member)"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="registerEmail" className="form-label">Email</label>
                <input
                  id="registerEmail"
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

                <div className="form-group">
                  <label htmlFor="registerPassword" className="form-label">Password</label>
                  <div className="password-input-wrapper">
                    <input
                      id="registerPassword"
                      type={showRegisterPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="Create a password"
                      value={registerPassword}
                      onChange={(e) => {
                        setRegisterPassword(e.target.value);
                        const validation = validatePasswordStrength(e.target.value);
                        setRegisterPasswordStrength(validation);
                      }}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      disabled={loading}
                      aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                    >
                      {showRegisterPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {registerPassword && registerPasswordStrength && !registerPasswordStrength.isValid && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--earist-maroon)" }}>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                        {registerPasswordStrength.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {registerPassword && registerPasswordStrength && registerPasswordStrength.isValid && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "green" }}>
                      ✓ Password meets all requirements
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                  <div className="password-input-wrapper">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Register"}
              </button>
            </form>

            <div className="auth-switch">
              <p>
                Already have an account?{" "}
                <button type="button" className="switch-link" onClick={switchToLogin}>
                  Login
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOTPVerification && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h2 className="otp-modal-title">Verify Your Email</h2>
            <p className="otp-modal-subtitle">
              We've sent a 6-digit OTP code to <strong>{pendingAuth?.email}</strong>
            </p>
            <form onSubmit={handleOTPVerification} className="auth-form">
              <div className="form-group">
                <label htmlFor="otpCode" className="form-label">Enter OTP Code</label>
                <input
                  id="otpCode"
                  type="text"
                  className="form-input"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  disabled={loading}
                  style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem" }}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="auth-button"
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <button
                type="button"
                className="switch-link"
                onClick={() => {
                  isVerifyingRef.current = false;
                  sessionStorage.removeItem("pendingAuth");
                  sessionStorage.removeItem("otpEmail");
                  setShowOTPVerification(false);
                  setOtpCode("");
                  setPendingAuth(null);
                  setError("");
                }}
                style={{ marginTop: "1rem" }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            {!showForgotPasswordOTP && !otpVerified ? (
              <>
                <h2 className="otp-modal-title">Reset Password</h2>
                <p className="otp-modal-subtitle">
                  Enter your email address to receive an OTP code
                </p>
                <form onSubmit={handleForgotPasswordInit} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="forgotPasswordEmail" className="form-label">Email</label>
                    <input
                      id="forgotPasswordEmail"
                      type="email"
                      className="form-input"
                      placeholder="Enter your email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <button
                    type="submit"
                    className="auth-button"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </button>

                  <button
                    type="button"
                    className="switch-link"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail("");
                      setForgotPasswordOTP("");
                      setShowForgotPasswordOTP(false);
                      setOtpVerified(false);
                      setError("");
                    }}
                    style={{ marginTop: "1rem" }}
                  >
                    Cancel
                  </button>
                </form>
              </>
            ) : showForgotPasswordOTP && !otpVerified ? (
              <>
                <h2 className="otp-modal-title">Verify Your Email</h2>
                <p className="otp-modal-subtitle">
                  We've sent a 6-digit OTP code to <strong>{forgotPasswordEmail}</strong>
                </p>
                <form onSubmit={handleForgotPasswordOTP} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="forgotPasswordOTP" className="form-label">Enter OTP Code</label>
                    <input
                      id="forgotPasswordOTP"
                      type="text"
                      className="form-input"
                      placeholder="000000"
                      value={forgotPasswordOTP}
                      onChange={(e) => setForgotPasswordOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      maxLength={6}
                      disabled={loading}
                      style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem" }}
                    />
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <button
                    type="submit"
                    className="auth-button"
                    disabled={loading || forgotPasswordOTP.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify OTP"}
                  </button>

                  <button
                    type="button"
                    className="switch-link"
                    onClick={() => {
                      setShowForgotPasswordOTP(false);
                      setForgotPasswordOTP("");
                      setOtpVerified(false);
                      setError("");
                    }}
                    style={{ marginTop: "1rem" }}
                  >
                    Back
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="otp-modal-title">Set New Password</h2>
                <p className="otp-modal-subtitle">
                  Create a strong password for your account
                </p>
                <form onSubmit={handleForgotPasswordReset} className="auth-form">
                  <div className="form-group">
                    <label htmlFor="newPassword" className="form-label">New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        className="form-input"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          const validation = validatePasswordStrength(e.target.value);
                          setPasswordStrength(validation);
                        }}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={loading}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    {newPassword && passwordStrength && !passwordStrength.isValid && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--earist-maroon)" }}>
                        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                          {passwordStrength.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {newPassword && passwordStrength && passwordStrength.isValid && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "green" }}>
                        ✓ Password meets all requirements
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmNewPassword" className="form-label">Confirm New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="confirmNewPassword"
                        type={showConfirmNewPassword ? "text" : "password"}
                        className="form-input"
                        placeholder="Confirm new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                        disabled={loading}
                        aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmNewPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <button
                    type="submit"
                    className="auth-button"
                    disabled={loading || !passwordStrength?.isValid || newPassword !== confirmNewPassword}
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>

                  <button
                    type="button"
                    className="switch-link"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail("");
                      setForgotPasswordOTP("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setShowForgotPasswordOTP(false);
                      setOtpVerified(false);
                      setError("");
                    }}
                    style={{ marginTop: "1rem" }}
                  >
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Google Login Organization Form Modal */}
      {showGoogleOrgForm && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h2 className="otp-modal-title">Complete Your Profile</h2>
            <p className="otp-modal-subtitle">
              Please provide your organization information to continue
            </p>
            <form onSubmit={handleGoogleOrgFormSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="googleRole" className="form-label">Organization</label>
                <select
                  id="googleRole"
                  className="form-input form-select"
                  value={googleRole}
                  onChange={(e) => setGoogleRole(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">Select organization type</option>
                  <option value="ISG">Institute Student Government (ISG)</option>
                  <option value="CSG">College Student Governments (CSG)</option>
                  <option value="AO">Accredited Organizations (AO)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="googleOrganizationId" className="form-label">
                  {getGoogleOrganizationLabel()}
                </label>
                <select
                  id="googleOrganizationId"
                  className="form-input form-select"
                  value={googleOrganizationId}
                  onChange={(e) => setGoogleOrganizationId(e.target.value)}
                  required
                  disabled={loading || !googleRole || googleOrganizations.length === 0}
                >
                  <option value="">
                    {!googleRole
                      ? "Please select an organization type first"
                      : googleOrganizations.length === 0
                        ? "No organizations available"
                        : `Select your ${getGoogleOrganizationLabel().toLowerCase()}`}
                  </option>
                  {googleOrganizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="googleUserRole" className="form-label">Role</label>
                <input
                  id="googleUserRole"
                  type="text"
                  className="form-input"
                  placeholder="Enter your role/position (e.g., President, Secretary, Member)"
                  value={googleUserRole}
                  onChange={(e) => setGoogleUserRole(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;

