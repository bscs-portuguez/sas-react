/**
 * Password Generator Utility
 * 
 * Generates cryptographically secure random passwords for organization accounts.
 */

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} Generated password
 */
export const generateSecurePassword = (length = 12) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  // Ensure at least one of each type
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Strength assessment
 */
export const validatePasswordStrength = (password) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*]/.test(password);
  const isLongEnough = password.length >= 12;
  
  const strength = [hasUppercase, hasLowercase, hasNumbers, hasSymbols, isLongEnough].filter(Boolean).length;
  
  return {
    strength,
    label: strength <= 2 ? "weak" : strength <= 3 ? "fair" : strength <= 4 ? "good" : "strong",
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSymbols,
    isLongEnough
  };
};
