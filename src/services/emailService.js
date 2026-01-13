/**
 * Email Service for OTP Verification
 * Uses a backend API endpoint to send emails via SMTP
 * 
 * Setup Required:
 * 1. Create a backend API endpoint at /api/send-otp
 * 2. Configure Gmail SMTP credentials
 * 3. Or use EmailJS service (see alternative below)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Send OTP email via backend API
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @returns {Promise<void>}
 */
export const sendOTPEmail = async (toEmail, otpCode) => {
  try {
    // Option 1: Use backend API (recommended for production)
    if (API_BASE_URL) {
      const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: toEmail,
          otp: otpCode,
          subject: "EARIST SAS Portal - OTP Verification",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send OTP email");
      }

      return await response.json();
    }

    // Option 2: Development fallback - log OTP to console
    // In production, this should always use the API
    console.warn("API_BASE_URL not set. OTP for development:", otpCode);
    console.warn("Email would be sent to:", toEmail);
    
    // For development, you can manually check the console for OTP
    // In production, remove this and ensure API_BASE_URL is set
    
    return { success: true, message: "OTP logged to console (development mode)" };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send verification email. Please try again.");
  }
};
