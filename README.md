# EARIST SAS Portal

A React + Vite application for the EARIST Student Affairs System (SAS) Portal with email OTP verification and password reset functionality.

## Features

- User authentication with email OTP verification
- Password reset functionality
- Admin dashboard for user and organization management
- Firebase integration for backend services
- Email service via Gmail SMTP

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Authentication and Firestore enabled
- Gmail account with App Password (for email sending)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Backend Server Configuration
PORT=3001

# Gmail SMTP Configuration
GMAIL_USER=sas.webapp.portal@gmail.com
GMAIL_PASS=your_gmail_app_password

# Frontend API Configuration
VITE_API_BASE_URL=http://localhost:3001
```

**Note:** Make sure `serviceAccountKey.json` is in the root directory for Firebase Admin SDK functionality (password reset).

### 3. Firebase Configuration

Configure your Firebase credentials in `src/config/firebase.jsx`. See `FIREBASE_ADMIN_SETUP.md` for detailed instructions.

## Running the Application

### Option 1: Run Both Frontend and Backend Together (Recommended)

```bash
npm run dev:all
```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend development server (usually on `http://localhost:5173`)

### Option 2: Run Separately

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start frontend development server
- `npm run server` - Start backend API server only
- `npm run dev:all` - Start both frontend and backend servers concurrently
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Backend API Endpoints

- `POST /api/send-otp` - Send OTP email
- `POST /api/reset-password` - Reset user password (requires Firebase Admin SDK)
- `GET /health` - Health check endpoint

## Project Structure

```
sas-react-app/
├── server.js              # Backend API server
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── services/         # API and service functions
│   ├── config/           # Configuration files
│   └── utils/            # Utility functions
├── serviceAccountKey.json # Firebase Admin SDK credentials (gitignored)
└── .env                  # Environment variables (gitignored)
```

## Documentation

- `FIREBASE_ADMIN_SETUP.md` - Firebase Admin SDK setup guide
- `FORGOT_PASSWORD_IMPLEMENTATION.md` - Password reset implementation details
- `EMAIL_OTP_SETUP.md` - Email OTP setup guide

## Security Notes

⚠️ **Important:**
- Never commit `.env` or `serviceAccountKey.json` to version control
- Use environment variables for sensitive data
- In production, use a proper email service (SendGrid, Mailgun, etc.)
- Consider using OAuth2 for Gmail instead of app passwords
