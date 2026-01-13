/**
 * Backend API Server for Email OTP and Password Reset
 * 
 * This is the production Node.js/Express server for sending OTP emails via Gmail SMTP
 * and handling password resets via Firebase Admin SDK
 * 
 * Environment Variables:
 * - PORT: Server port (default: 3001)
 * - GMAIL_USER: Gmail account for sending emails
 * - GMAIL_PASS: Gmail app password
 * 
 * Run with: npm run server
 * Or with frontend: npm run dev:all
 */

import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// For loading JSON files in ES modules
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
// Make sure you have serviceAccountKey.json in the same directory
// Or use environment variables (see FIREBASE_ADMIN_SETUP.md)
let adminInitialized = false;
try {
  const serviceAccount = require(join(__dirname, './serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  adminInitialized = true;
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.error('Make sure serviceAccountKey.json exists in the backend directory');
  console.error('Password reset endpoint will not work until Admin SDK is initialized');
  // Don't exit - allow server to start for OTP functionality
}

const app = express();
app.use(cors());
app.use(express.json());

// Gmail SMTP Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'sas.webapp.portal@gmail.com',
    pass: process.env.GMAIL_PASS || 'SWRFsWz0rzl6226bYr'
  }
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

// Send OTP Endpoint
app.post('/api/send-otp', async (req, res) => {
  try {
    const { to, otp, subject } = req.body;

    if (!to || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and OTP are required' 
      });
    }

    const mailOptions = {
      from: 'sas.webapp.portal@gmail.com',
      to: to,
      subject: subject || 'EARIST SAS Portal - OTP Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #800020; text-align: center; }
            .otp-box { 
              background-color: #f5f5dc; 
              padding: 30px; 
              text-align: center; 
              border-radius: 8px; 
              margin: 30px 0; 
            }
            .otp-code { 
              color: #800020; 
              font-size: 36px; 
              letter-spacing: 8px; 
              font-weight: bold;
              margin: 0;
            }
            .footer { color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="header">EARIST SAS Portal - OTP Verification</h2>
            <p>Your OTP verification code is:</p>
            <div class="otp-box">
              <p class="otp-code">${otp}</p>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p class="footer">If you didn't request this code, please ignore this email.</p>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${to}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully' 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP email',
      details: error.message 
    });
  }
});

// Password Reset Endpoint (requires Firebase Admin SDK)
// Note: This endpoint requires Firebase Admin SDK to update user passwords
// Install: npm install firebase-admin
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword, otpVerified } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and new password are required' 
      });
    }

    if (!otpVerified) {
      return res.status(400).json({ 
        success: false, 
        error: 'OTP verification is required' 
      });
    }

    // Validate password strength (optional, but recommended)
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Check if Admin SDK is initialized
    if (!adminInitialized) {
      return res.status(503).json({ 
        success: false, 
        error: 'Password reset service is not available. Please check backend configuration.' 
      });
    }

    // Get user by email using Firebase Admin SDK
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      throw error;
    }

    // Update user password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });

    console.log(`Password reset successfully for ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Email OTP API' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Email OTP API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Send OTP: POST http://localhost:${PORT}/api/send-otp`);
  console.log(`Reset Password: POST http://localhost:${PORT}/api/reset-password`);
  if (!adminInitialized) {
    console.log('\n⚠️  WARNING: Firebase Admin SDK not initialized - password reset will not work');
    console.log('   Make sure serviceAccountKey.json exists in the backend directory');
  } else {
    console.log('\n✓ Firebase Admin SDK initialized - password reset is available');
  }
});


