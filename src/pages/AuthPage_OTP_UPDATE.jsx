// This file contains the updated handlers for OTP verification
// Replace the corresponding functions in AuthPage.jsx

// Updated handleEmailLogin with OTP verification
const handleEmailLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    // Step 1: Send OTP to email
    await sendOTP(email);
    setShowOTPVerification(true);
    setPendingAuth({ type: "login", email, password });
    setError("");
  } catch (err) {
    setError(err.message || "Failed to send OTP. Please try again.");
  } finally {
    setLoading(false);
  }
};

// New handler for OTP verification
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
      await signInWithEmailAndPassword(auth, pendingAuth.email, pendingAuth.password);
    } else if (pendingAuth.type === "register") {
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
    }
    
    // Reset OTP state
    setShowOTPVerification(false);
    setOtpCode("");
    setPendingAuth(null);
  } catch (err) {
    console.error("OTP verification error:", err);
    setError(err.message || "Failed to verify OTP. Please try again.");
  } finally {
    setLoading(false);
  }
};

// Updated handleEmailRegister with OTP verification
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
  
  if (registerPassword.length < 6) {
    setError("Password must be at least 6 characters.");
    return;
  }
  
  setLoading(true);

  try {
    // Step 1: Send OTP to email
    await sendOTP(registerEmail);
    setShowOTPVerification(true);
    setPendingAuth({
      type: "register",
      email: registerEmail,
      password: registerPassword,
      fullName: fullName,
      role: role,
      organizationId: organizationId,
      userRole: userRole.trim()
    });
    setError("");
  } catch (err) {
    console.error("Registration error:", err);
    setError(err.message || "Failed to send OTP. Please try again.");
  } finally {
    setLoading(false);
  }
};

// Updated handleGoogleLogin with organization info check
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
    // Update user document with organization info
    await createUserDocument(googleUser.uid, {
      fullName: googleUser.displayName || "",
      email: googleUser.email,
      role: googleRole,
      organizationId: googleOrganizationId,
      userRole: googleUserRole.trim()
    });
    
    // Reset form state
    setShowGoogleOrgForm(false);
    setGoogleUser(null);
    setGoogleRole("");
    setGoogleOrganizationId("");
    setGoogleUserRole("");
    
    // Navigation will be handled by App.jsx
  } catch (err) {
    console.error("Error saving organization info:", err);
    setError(err.message || "Failed to save organization information.");
  } finally {
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

