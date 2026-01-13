/**
 * Password strength validation utility
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*)
 */

/**
 * Check if password meets strength requirements
 * @param {string} password - Password to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*)");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get password strength indicator (weak, medium, strong)
 * @param {string} password - Password to check
 * @returns {string} "weak" | "medium" | "strong"
 */
export const getPasswordStrength = (password) => {
  if (!password) return "weak";
  
  let strength = 0;
  
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*]/.test(password)) strength++;
  
  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
};

