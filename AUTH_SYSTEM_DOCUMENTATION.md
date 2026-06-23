/**
 * AUTHENTICATION SYSTEM REFACTORING - Complete Documentation
 * Production-Ready Firebase OTP with JWT Backend
 * 
 * This document explains the new authentication system and how to use it.
 */

// ============================================================================
// 1. ARCHITECTURE OVERVIEW
// ============================================================================

/*
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

FRONTEND (React Native)                     BACKEND (Node.js)
─────────────────────                       ───────────────────

1. User enters phone
   └─> Firebase OTP

2. Firebase sends OTP
   to phone

3. User enters OTP
   └─> Firebase verifies OTP

4. Firebase returns ID Token
   └─> POST /api/auth/login
       with firebaseToken
       │
       └─> Firebase Admin SDK
           verifies token
           │
           ├─> Extract phone from token
           ├─> Find/create user in DB
           └─> Issue JWT token

5. Backend returns:
   {
     token: "JWT_TOKEN",
     refreshToken: "REFRESH_TOKEN",
     user: { id, phone, name },
     expiresIn: 2592000
   }
   └─> Frontend stores in AsyncStorage

6. All future requests
   └─> Include JWT in header:
       Authorization: Bearer JWT_TOKEN

KEY POINT: 
- Firebase only handles OTP verification (frontend)
- Backend handles user persistence and JWT issuance
- Phone is the UNIQUE identifier across the system
*/

// ============================================================================
// 2. DATABASE SCHEMA - USERS TABLE
// ============================================================================

/*
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,      -- E.164 format: +919876543210
  name VARCHAR(255),                       -- Optional display name
  firebase_uid VARCHAR(255),               -- Firebase auth UID
  auth_provider VARCHAR(50) DEFAULT 'firebase',  -- For multi-provider support
  shop_id INTEGER REFERENCES shops(id),   -- Optional shop association
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INDEXES:
- idx_users_phone (fast lookup by phone)
- idx_users_firebase_uid (for mapping)
- idx_users_shop_id (for shop queries)

KEY DESIGN DECISIONS:
✓ Phone is UNIQUE - serves as single source of truth for identity
✓ auth_provider allows switching from Firebase to WhatsApp OTP later
✓ shop_id is optional - user can exist without a shop
✓ firebase_uid stored for reference but NOT used for lookups
*/

// ============================================================================
// 3. SERVICE LAYER - Core Files
// ============================================================================

/*
SRC/SERVICES/

1. firebase.service.js
   ├─ verifyIdToken(idToken)
   │  └─ Validates Firebase ID Token using Admin SDK
   ├─ extractUserInfoFromToken(decodedToken)
   │  └─ Gets phone, firebaseUid, name from token
   └─ verifyTokenAndGetUserInfo(idToken)
      └─ Main method: verify + extract

2. token.service.js
   ├─ generateAccessToken(payload)
   │  └─ Creates JWT token (30 days expiry)
   ├─ verifyAccessToken(token)
   │  └─ Validates JWT token
   ├─ generateRefreshToken(payload)
   │  └─ Optional: refresh token for token rotation
   └─ generateTokenPair(userPayload)
      └─ Returns { accessToken, refreshToken, expiresIn, user }

3. auth.service.js
   ├─ loginWithFirebaseToken(idToken)
   │  └─ Main login method (Production)
   ├─ loginWithTestCredentials(phone, testToken)
   │  └─ For development/testing without Firebase
   ├─ verifyJWTToken(token)
   │  └─ Check if token is valid
   ├─ refreshAccessToken(refreshToken)
   │  └─ Get new access token
   └─ getUserProfile(token)
      └─ Get full user data

4. user.model.js (Updated)
   ├─ createUser(userData)
   ├─ getUserByPhone(phone)      -- PRIMARY LOOKUP
   ├─ getUserById(userId)
   └─ updateUser(userId, data)
*/

// ============================================================================
// 4. API ENDPOINTS
// ============================================================================

/*
POST /api/auth/login
├─ Purpose: Firebase OTP Login
├─ Auth: NO
├─ Request:
│  {
│    "firebaseToken": "eyJhbGciOiJIUzI1NiIs..."
│  }
├─ Response:
│  {
│    "success": true,
│    "token": "JWT_TOKEN",
│    "refreshToken": "REFRESH_TOKEN",
│    "user": {
│      "id": 1,
│      "phone": "+919876543210",
│      "name": "John Doe",
│      "shopId": 1,
│      "createdAt": "2024-04-25T10:00:00Z"
│    },
│    "expiresIn": 2592000
│  }
└─ Status: 200 (success), 401 (invalid token), 400 (missing phone)

POST /api/auth/login-test
├─ Purpose: Test login (development only)
├─ Auth: NO
├─ Request: { "phone": "9876543210" }
├─ Response: Same as /login
├─ Status: 403 in production
└─ Use for: Rapid testing without Firebase setup

GET /api/auth/profile
├─ Purpose: Get current user profile
├─ Auth: YES (JWT)
├─ Response: Full user data
└─ Status: 200, 401 (invalid token)

PUT /api/auth/profile
├─ Purpose: Update user profile
├─ Auth: YES (JWT)
├─ Request: { "name": "New Name" }
└─ Status: 200, 401

POST /api/auth/verify-token
├─ Purpose: Check if token is valid
├─ Auth: NO
├─ Request: { "token": "JWT_TOKEN" }
├─ Response: { "valid": true, "userId": 1, "phone": "+919..." }
└─ Status: 200, 401

POST /api/auth/refresh-token
├─ Purpose: Get new access token using refresh token
├─ Auth: NO
├─ Request: { "refreshToken": "REFRESH_TOKEN" }
├─ Response: { "token": "NEW_JWT", "expiresIn": 2592000 }
└─ Status: 200, 401

POST /api/auth/logout
├─ Purpose: Logout user
├─ Auth: YES (JWT)
├─ Response: { "success": true, "message": "..." }
└─ Status: 200
*/

// ============================================================================
// 5. USAGE - FRONTEND (React Native)
// ============================================================================

/*
STEP 1: Setup Firebase Authentication
─────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = { ... };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

STEP 2: Send OTP (Firebase handles this)
─────────────────────────────────────────
const sendOTP = async (phoneNumber) => {
  const appVerifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
  const confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber,
    appVerifier
  );
  // Store confirmationResult
};

STEP 3: Verify OTP & Get ID Token (Firebase)
─────────────────────────────────────────────
const verifyOTP = async (otp) => {
  const result = await confirmationResult.confirm(otp);
  const idToken = await result.user.getIdToken();
  return idToken;
};

STEP 4: Send to Backend
──────────────────────
const loginBackend = async (idToken) => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: idToken })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Save JWT to AsyncStorage
    await AsyncStorage.setItem('jwtToken', data.token);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    
    // User is now logged in
    return data.user;
  }
};

STEP 5: Use JWT in All Requests
───────────────────────────────
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('jwtToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Example: Get user profile
const getProfile = async () => {
  const headers = await getHeaders();
  const response = await fetch('http://localhost:5000/api/auth/profile', {
    headers
  });
  return await response.json();
};

STEP 6: Handle Token Expiry
──────────────────────────
// Check if token is expired
const isTokenExpired = async () => {
  const response = await fetch('http://localhost:5000/api/auth/verify-token', {
    method: 'POST',
    body: JSON.stringify({ 
      token: await AsyncStorage.getItem('jwtToken') 
    })
  });
  return !response.ok;
};

// Refresh token if needed
const refreshToken = async () => {
  const response = await fetch('http://localhost:5000/api/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken: await AsyncStorage.getItem('refreshToken')
    })
  });
  const data = await response.json();
  await AsyncStorage.setItem('jwtToken', data.token);
};

STEP 7: Logout
────────────
const logout = async () => {
  const headers = await getHeaders();
  await fetch('http://localhost:5000/api/auth/logout', {
    method: 'POST',
    headers
  });
  
  // Clear stored tokens
  await AsyncStorage.removeItem('jwtToken');
  await AsyncStorage.removeItem('refreshToken');
  await AsyncStorage.removeItem('user');
};
*/

// ============================================================================
// 6. USAGE - BACKEND (Middleware)
// ============================================================================

/*
// In your route files:

const authMiddleware = require('./middleware/auth');

// Protected route
router.get('/api/users/me', authMiddleware, (req, res) => {
  console.log(req.user); // { userId: 1, phone: "+919876543210" }
  res.json({ user: req.user });
});

// Public route
router.get('/api/public/data', (req, res) => {
  res.json({ data: 'anyone can access' });
});

// What authMiddleware does:
// 1. Extracts JWT from Authorization header
// 2. Validates token using TokenService
// 3. Attaches req.user with { userId, phone }
// 4. Calls next() to proceed
// 5. If invalid, returns 401 error
*/

// ============================================================================
// 7. PHONE NUMBER HANDLING
// ============================================================================

/*
Phone Normalization (E.164 Format)
──────────────────────────────────

All phone numbers are stored in E.164 format: +[country][number]
Example: +919876543210

File: src/utils/phoneUtils.js

const phoneUtils = require('./utils/phoneUtils');

// Normalize any phone format to E.164
phoneUtils.normalizePhone("9876543210")      // "+919876543210"
phoneUtils.normalizePhone("+91 98765 43210")  // "+919876543210"
phoneUtils.normalizePhone("91-98765-43210")   // "+919876543210"

// Validate phone
phoneUtils.isValidPhone("9876543210")        // true
phoneUtils.isValidPhone("invalid")           // false

// Compare phones
phoneUtils.phoneEquals("9876543210", "+919876543210")  // true

// Extract parts
phoneUtils.getCountryCode("+919876543210")   // "91"
phoneUtils.getLocalNumber("+919876543210")   // "9876543210"

// Format for display
phoneUtils.formatPhoneForDisplay("+919876543210")  // "+91 9876 543210"

WHY E.164?
- International standard
- Unique across countries
- Solves duplicate phone issues
- Enables multi-country support
*/

// ============================================================================
// 8. ENVIRONMENT SETUP
// ============================================================================

/*
DEVELOPMENT SETUP
─────────────────

1. Copy .env.example to .env:
   cp .env.example .env

2. Fill in required variables:

   # Database
   DATABASE_URL=postgresql://...

   # JWT (generate with: openssl rand -base64 32)
   JWT_SECRET=YOUR_RANDOM_STRING
   JWT_REFRESH_SECRET=YOUR_RANDOM_STRING_2
   JWT_EXPIRY=30d
   JWT_REFRESH_EXPIRY=60d

   # Firebase
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
   FIREBASE_PROJECT_ID=your-project
   FIREBASE_API_KEY=your-api-key

   # Other
   NODE_ENV=development
   PORT=5000

3. For testing without Firebase:
   - Use POST /api/auth/login-test
   - Send: { "phone": "9876543210" }
   - Works in development mode only

PRODUCTION SETUP
────────────────

1. Use environment variable service (Vercel, Heroku, AWS):
   - Never hardcode secrets in code
   - Use platform's secret management

2. Change sensitive values:
   - JWT_SECRET (secure random 32+ chars)
   - JWT_REFRESH_SECRET (different random string)
   - FIREBASE_SERVICE_ACCOUNT (production Firebase credentials)

3. Set:
   NODE_ENV=production

4. Disable test endpoints:
   - /api/auth/login-test returns 403 in production
*/

// ============================================================================
// 9. FUTURE-PROOFING - Multi-Provider Support
// ============================================================================

/*
Current System: Firebase OTP
────────────────────────────
- Phone: single identity
- auth_provider: 'firebase'
- Works as designed

Adding WhatsApp OTP (Future)
────────────────────────────

Database schema already supports this!

1. New WhatsApp service:
   src/services/whatsapp.service.js
   ├─ sendWhatsAppOTP(phone)
   └─ verifyWhatsAppOTP(phone, otp)

2. Update auth.service.js:
   exports.loginWithWhatsAppToken = async (phone, otp) => {
     // Verify WhatsApp OTP
     const verified = await WhatsAppService.verify(phone, otp);
     
     // Find/create user by PHONE (same logic!)
     let user = await UserModel.getUserByPhone(phone);
     if (!user) {
       user = await UserModel.createUser({
         phone,
         authProvider: 'whatsapp'  // Different provider
       });
     }
     
     // Issue JWT (same!)
     return TokenService.generateTokenPair(...);
   };

3. New endpoint:
   POST /api/auth/login-whatsapp
   Body: { phone, otp }
   Same response as Firebase login

4. Database migration:
   UPDATE users SET auth_provider = 'whatsapp' WHERE ...

BENEFITS:
✓ No user table changes needed
✓ Users can use any provider
✓ Same phone = same user identity
✓ Backward compatible
✓ Can migrate users gradually
*/

// ============================================================================
// 10. ERROR HANDLING
// ============================================================================

/*
Common Errors & Solutions
──────────────────────────

1. "Firebase token is required" (400)
   └─ Frontend not sending firebaseToken in request body

2. "Invalid Firebase token" (401)
   └─ Firebase didn't verify the token
   └─ Check: Is token actually from Firebase?
   └─ Check: Is Firebase configured in .env?

3. "Phone number not found in Firebase token" (400)
   └─ OTP was never verified on frontend
   └─ User didn't complete Firebase OTP process

4. "Token has expired. Please login again." (401)
   └─ JWT token is older than 30 days
   └─ Use refresh token to get new token
   └─ Or: User logs in again

5. "Invalid or expired refresh token" (401)
   └─ Refresh token is older than 60 days
   └─ User must login again

6. "Test login not available in production" (403)
   └─ /api/auth/login-test only works in development
   └─ Use /api/auth/login in production

DEBUGGING
─────────

// Check token validity:
POST /api/auth/verify-token
Body: { "token": "JWT_HERE" }

// View token contents (without verification):
Use jwt.io and paste token
(Shows payload without secret)

// Enable debug logging:
Set LOG_LEVEL=debug in .env
*/

// ============================================================================
// 11. SECURITY BEST PRACTICES
// ============================================================================

/*
What We Do Right
────────────────
✓ NEVER trust phone from frontend (only from Firebase token)
✓ JWT tokens are short-lived (30 days is reasonable for mobile)
✓ Refresh tokens for token rotation capability
✓ Phone number is unique (no duplicates)
✓ Firebase Admin SDK validates tokens (not just decode)
✓ All sensitive data in environment variables

What You Should Do
──────────────────
✓ Use HTTPS in production (enforce SSL/TLS)
✓ Store JWT in secure storage on mobile (AsyncStorage not ideal, use react-native-secure-storage)
✓ Implement token refresh automatically (before expiry)
✓ Log authentication attempts for security monitoring
✓ Rate limit /api/auth/login endpoint (already done: 100 requests/15min)
✓ Monitor for suspicious activity (same phone, multiple devices, rapid logins)
✓ Rotate JWT_SECRET periodically in production

NOT Recommended
───────────────
✗ Don't store sensitive data in JWT (it's decoded, not encrypted)
✗ Don't make JWT expiry too long (security risk if stolen)
✗ Don't store JWT in localStorage on web (vulnerable to XSS)
✗ Don't hardcode secrets in code
✗ Don't use Firebase tokens for backend requests (use JWT instead)
*/

// ============================================================================
// 12. TESTING
// ============================================================================

/*
MANUAL TESTING IN POSTMAN
──────────────────────────

1. Test Login:
   POST http://localhost:5000/api/auth/login-test
   Body: {
     "phone": "9876543210"
   }
   Result: Get JWT token

2. Copy JWT from response

3. Test Profile:
   GET http://localhost:5000/api/auth/profile
   Header: Authorization: Bearer JWT_HERE
   Result: User profile

4. Test Logout:
   POST http://localhost:5000/api/auth/logout
   Header: Authorization: Bearer JWT_HERE

AUTOMATED TESTING
──────────────────
Create tests/auth.test.js with:
- Test login endpoint
- Test profile endpoint
- Test token expiry
- Test invalid tokens
- Test phone normalization

Run: npm test
*/

// ============================================================================
// 13. DEPLOYMENT CHECKLIST
// ============================================================================

/*
Pre-Deployment
──────────────
□ Change JWT_SECRET (openssl rand -base64 32)
□ Change JWT_REFRESH_SECRET (different random string)
□ Set NODE_ENV=production
□ Disable login-test endpoint (automatic in production)
□ Set FIREBASE_SERVICE_ACCOUNT to production credentials
□ Database migrations applied (migration_auth_refactor.sql)
□ Test with real Firebase credentials
□ SSL/HTTPS enabled
□ Rate limiting verified (100 requests/15min)
□ Logging configured (LOG_LEVEL=warn)

Post-Deployment
───────────────
□ Monitor error logs (especially auth failures)
□ Test login flow end-to-end on mobile app
□ Verify token refresh works
□ Check database for new users
□ Monitor API performance
□ Set up alerts for high error rates
*/

module.exports = {};
