/**
 * PRODUCTION-READY IMPLEMENTATION GUIDE
 * Firebase OTP + JWT Authentication System
 * 
 * This file provides step-by-step instructions for implementation
 */

// ============================================================================
// PART 1: DATABASE MIGRATION
// ============================================================================

/*
STEP 1: Run Database Migration
──────────────────────────────

File: migrations/migration_auth_refactor.sql

This adds:
- name column (optional user display name)
- auth_provider column (for multi-provider support)
- shop_id column (link user to shop)
- Indexes for performance

Option A: Local PostgreSQL
```bash
psql tailor_app < migrations/migration_auth_refactor.sql
```

Option B: Supabase (recommended)
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Click "New Query"
4. Copy-paste contents of migration_auth_refactor.sql
5. Click "Run"

Verify migration worked:
```sql
\d users
-- Should show: name, auth_provider, shop_id columns
```

STEP 2: Test Connection
```sql
SELECT id, phone, name, auth_provider FROM users LIMIT 5;
```
*/

// ============================================================================
// PART 2: ENVIRONMENT SETUP
// ============================================================================

/*
STEP 1: Create .env file
────────────────────────

cp .env.example .env

STEP 2: Fill in Database URL
─────────────────────────────

Option A: Supabase (recommended)
1. Go to Supabase Dashboard
2. Settings > Database
3. Copy "Connection string"
4. Select "PostgreSQL"
5. Paste: DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db...:5432/postgres

Option B: Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/tailor_app

STEP 3: Generate JWT Secrets
─────────────────────────────

Run in terminal:
openssl rand -base64 32
openssl rand -base64 32

Output will be like:
  y7kL9mP2qR5xZ8nB3vC6dF1gH4jK5lM9
  aB3xK6mN9qR2vS5wZ8yE1hF4jG7lP0mX

Set in .env:
JWT_SECRET=y7kL9mP2qR5xZ8nB3vC6dF1gH4jK5lM9
JWT_REFRESH_SECRET=aB3xK6mN9qR2vS5wZ8yE1hF4jG7lP0mX

STEP 4: Configure Firebase
───────────────────────────

Get Firebase Service Account:
1. Go to Firebase Console
2. Project Settings > Service Accounts
3. Click "Generate New Private Key"
4. Copy the entire JSON content
5. Paste into FIREBASE_SERVICE_ACCOUNT (as a single line)

Or get from environment variable:
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'

STEP 5: Verify .env
───────────────────

.env should have:
✓ DATABASE_URL (with password)
✓ JWT_SECRET (random 32 chars)
✓ JWT_REFRESH_SECRET (random 32 chars)
✓ JWT_EXPIRY=30d
✓ JWT_REFRESH_EXPIRY=60d
✓ FIREBASE_SERVICE_ACCOUNT (JSON content)
✓ FIREBASE_PROJECT_ID
✓ NODE_ENV=development (or production)
✓ PORT=5000

STEP 6: Test Backend Starts
────────────────────────────

npm run dev

Expected output:
✓ Database connected successfully
✓ Firebase Admin SDK initialized
✓ Server started successfully
✓ Environment: development
✓ Server running on http://localhost:5000
*/

// ============================================================================
// PART 3: TESTING THE SYSTEM
// ============================================================================

/*
TEST 1: Health Check
────────────────────

GET http://localhost:5000/health

Expected:
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2024-04-25T10:00:00.000Z"
}

TEST 2: Test Login (Development Mode)
─────────────────────────────────────

POST http://localhost:5000/api/auth/login-test
Content-Type: application/json

Body:
{
  "phone": "9876543210"
}

Expected Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "phone": "+919876543210",
    "name": "Test User",
    "shopId": null,
    "createdAt": "2024-04-25T10:00:00Z"
  },
  "expiresIn": 2592000
}

✓ Copy the token value for next test

TEST 3: Get Profile (Protected Route)
─────────────────────────────────────

GET http://localhost:5000/api/auth/profile
Authorization: Bearer <TOKEN_FROM_TEST_2>

Expected:
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "id": 1,
    "phone": "+919876543210",
    "name": "Test User",
    "shopId": null,
    "authProvider": "test",
    "createdAt": "2024-04-25T10:00:00Z",
    "updatedAt": "2024-04-25T10:00:00Z"
  }
}

TEST 4: Verify Token
───────────────────

POST http://localhost:5000/api/auth/verify-token
Content-Type: application/json

Body:
{
  "token": "<TOKEN_FROM_TEST_2>"
}

Expected:
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "valid": true,
    "userId": 1,
    "phone": "+919876543210"
  }
}

TEST 5: Logout
──────────────

POST http://localhost:5000/api/auth/logout
Authorization: Bearer <TOKEN_FROM_TEST_2>

Expected:
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "success": true,
    "message": "Logged out successfully. Clear token from frontend storage."
  }
}

✅ All tests pass = System is working!
*/

// ============================================================================
// PART 4: FRONTEND INTEGRATION
// ============================================================================

/*
STEP 1: Install Firebase
────────────────────────

npm install firebase

STEP 2: Initialize Firebase
───────────────────────────

File: src/firebase.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

STEP 3: Phone Number Verification Screen
─────────────────────────────────────────

File: src/screens/LoginScreen.js

import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Send OTP
  const sendOTP = async () => {
    try {
      setLoading(true);
      const appVerifier = new RecaptchaVerifier('recaptcha-container', {
        size: 'invisible'
      }, auth);
      
      const result = await signInWithPhoneNumber(
        auth,
        '+91' + phone,  // Add country code
        appVerifier
      );
      
      setConfirmationResult(result);
      setLoading(false);
      // Show OTP input screen
    } catch (error) {
      setLoading(false);
      alert(error.message);
    }
  };

  // Step 2: Verify OTP and get Firebase token
  const verifyOTP = async () => {
    try {
      setLoading(true);
      const result = await confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      
      // Step 3: Send to backend
      loginBackend(idToken);
    } catch (error) {
      setLoading(false);
      alert('Invalid OTP');
    }
  };

  // Step 3: Call backend
  const loginBackend = async (idToken) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseToken: idToken })
      });

      const data = await response.json();

      if (data.success) {
        // Save JWT
        await AsyncStorage.setItem('jwtToken', data.token);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
        
        // Navigate to home
        navigation.navigate('Home', { user: data.user });
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {!confirmationResult ? (
        <>
          <TextInput
            placeholder="Enter phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Button 
            title="Send OTP" 
            onPress={sendOTP} 
            disabled={loading}
          />
        </>
      ) : (
        <>
          <TextInput
            placeholder="Enter OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
          />
          <Button 
            title="Verify OTP" 
            onPress={verifyOTP} 
            disabled={loading}
          />
        </>
      )}
      <div id="recaptcha-container" />
    </View>
  );
}

STEP 4: API Service with JWT
────────────────────────────

File: src/services/api.js

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:5000/api';

export const apiCall = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('jwtToken');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });

  const data = await response.json();

  // If token expired, try to refresh
  if (!response.ok && response.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      // Retry request with new token
      return apiCall(endpoint, options);
    }
  }

  return data;
};

export const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    const response = await fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();
    
    if (data.success) {
      await AsyncStorage.setItem('jwtToken', data.data.token);
      return data.data.token;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return null;
};

STEP 5: Use API in Screens
──────────────────────────

File: src/screens/HomeScreen.js

import { apiCall } from '../services/api';

export default function HomeScreen() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getProfile = async () => {
      const response = await apiCall('/auth/profile');
      if (response.success) {
        setUser(response.data);
      }
    };
    
    getProfile();
  }, []);

  return (
    <View>
      <Text>Welcome, {user?.name}</Text>
      <Text>Phone: {user?.phone}</Text>
    </View>
  );
}

STEP 6: Logout
──────────────

export const logout = async (navigation) => {
  try {
    const token = await AsyncStorage.getItem('jwtToken');
    
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    await AsyncStorage.removeItem('jwtToken');
    await AsyncStorage.removeItem('refreshToken');
    
    // Navigate to login
    navigation.navigate('Login');
  }
};
*/

// ============================================================================
// PART 5: PRODUCTION DEPLOYMENT
// ============================================================================

/*
CHECKLIST
─────────

DATABASE
□ Run migrations
□ Backup existing data
□ Verify all columns added
□ Check indexes exist
□ Connection string works

ENVIRONMENT
□ JWT_SECRET changed (openssl rand -base64 32)
□ JWT_REFRESH_SECRET changed
□ NODE_ENV=production
□ DATABASE_URL points to production DB
□ FIREBASE_SERVICE_ACCOUNT has production credentials
□ No secrets in code (all in .env)

CODE
□ Remove old OTP service files (optional)
□ Update auth.routes.js (already done)
□ Update auth.controller.js (already done)
□ All imports updated
□ No console.logs for sensitive data

SECURITY
□ HTTPS/SSL enabled
□ CORS only allows frontend domain
□ Rate limiting enabled (100/15min)
□ Database password secure
□ Firebase credentials rotated
□ Git doesn't contain .env

TESTING
□ Login endpoint works
□ Profile endpoint works
□ Token refresh works
□ Token expiry works
□ Logout works
□ Phone normalization works
□ New users created correctly
□ Existing users found by phone

MONITORING
□ Error logging enabled
□ Auth failures logged
□ Rate limit hits logged
□ Database connection monitored
□ Firebase quota checked

DEPLOYMENT
□ Backup database before deploy
□ Deploy code
□ Run migrations
□ Test login on production
□ Monitor error logs
□ Verify token generation
□ Check for rate limit hits
□ Performance acceptable
□ No 500 errors

POST-DEPLOYMENT
□ Users can login with Firebase OTP
□ JWT tokens valid for 30 days
□ Token refresh works
□ Protected endpoints secured
□ Logout works
□ Phone numbers normalized
□ No duplicate users
*/

// ============================================================================
// PART 6: TROUBLESHOOTING
// ============================================================================

/*
ISSUE: "Firebase is not initialized"
─────────────────────────────────────
Cause: FIREBASE_SERVICE_ACCOUNT not set in .env

Solution:
1. Get Firebase service account JSON
2. Set FIREBASE_SERVICE_ACCOUNT='{...json...}'
3. Restart server: npm run dev

ISSUE: "user already exists"
──────────────────────────────
Cause: Phone number is unique in database

Solution:
1. Use different phone number
2. Or: Delete existing user (if testing)
3. Then: Retry login

ISSUE: "Invalid Firebase token"
───────────────────────────────
Cause: Token not from Firebase

Solution:
1. Ensure Firebase OTP completed on frontend
2. Ensure token is from Firebase, not custom
3. Check firebase.service.js for errors

ISSUE: "Database connection error"
───────────────────────────────────
Cause: DATABASE_URL incorrect or database down

Solution:
1. Check DATABASE_URL in .env
2. Test connection: psql $DATABASE_URL
3. Verify database is running
4. Check username/password

ISSUE: "Token expired" on all requests
──────────────────────────────────────
Cause: JWT_SECRET changed in production

Solution:
1. Use same JWT_SECRET
2. OR: Users re-login to get new tokens
3. Don't change JWT_SECRET without plan

ISSUE: Users can't access protected routes
────────────────────────────────────────────
Cause: JWT not sent or middleware not applied

Solution:
1. Check Authorization header format
2. Format: "Bearer <TOKEN>"
3. Verify middleware is on route
4. Check token is in AsyncStorage (frontend)

ISSUE: Phone normalization issues
──────────────────────────────────
Cause: Phone in wrong format

Solution:
1. Check phoneUtils.normalizePhone()
2. All phones should be +91XXXXXXXXXX
3. Verify country code is correct
4. Test with: curl -X POST .../login-test -d '{"phone":"9876543210"}'

DEBUG: Check token validity
────────────────────────────
1. POST /api/auth/verify-token
2. Send your JWT token
3. Response shows if valid/expired
4. Or: Use jwt.io to decode (view contents, not secure)

DEBUG: Check database records
──────────────────────────────
psql tailor_app
SELECT * FROM users;
SELECT id, phone, name, auth_provider FROM users WHERE phone = '+919876543210';

DEBUG: Check server logs
─────────────────────────
npm run dev
Look for errors:
- "Firebase initialization error"
- "Database query error"
- "Token verification failed"
- "Authentication error"
*/

module.exports = {};
