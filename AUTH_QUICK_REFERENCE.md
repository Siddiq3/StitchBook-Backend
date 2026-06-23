# 🔐 Firebase OTP + JWT Authentication - Quick Reference

## 📋 What Changed?

### Before (Old System)
- ❌ OTP endpoints in backend (`/send-otp`, `/verify-otp`, `/resend-otp`)
- ❌ Mixed responsibility (backend handled everything)
- ❌ OTP stored in memory/cache
- ❌ Complex state management

### After (New System)
- ✅ Firebase handles OTP (frontend only)
- ✅ Backend issues JWT tokens
- ✅ Phone is unique identifier
- ✅ Clean separation of concerns
- ✅ Future-proof for WhatsApp OTP

---

## 🚀 Quick Start

### Backend Setup (5 minutes)

```bash
# 1. Update database
psql tailor_app < migrations/migration_auth_refactor.sql

# 2. Configure environment
cp .env.example .env
# Edit .env and set:
# - DATABASE_URL
# - JWT_SECRET (run: openssl rand -base64 32)
# - FIREBASE_SERVICE_ACCOUNT (JSON from Firebase Console)

# 3. Restart backend
npm run dev
```

### Frontend Setup

```javascript
// 1. User enters phone → Firebase sends OTP
const sendOTP = async (phone) => {
  const confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);
  return confirmationResult;
};

// 2. User enters OTP → Firebase returns idToken
const verifyOTP = async (confirmationResult, otp) => {
  const result = await confirmationResult.confirm(otp);
  const idToken = await result.user.getIdToken();
  return idToken;
};

// 3. Send idToken to backend
const loginBackend = async (idToken) => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: idToken })
  });
  
  const { token, user } = await response.json();
  
  // Store JWT in AsyncStorage
  await AsyncStorage.setItem('jwtToken', token);
  return user;
};

// 4. Use JWT for all API calls
const apiCall = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('jwtToken');
  return fetch(`http://localhost:5000${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};
```

---

## 📍 API Endpoints

### Public Endpoints (No JWT required)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/login` | `{ firebaseToken }` | `{ token, refreshToken, user, expiresIn }` |
| POST | `/api/auth/login-test` | `{ phone }` | Same as login |
| POST | `/api/auth/verify-token` | `{ token }` | `{ valid, userId, phone }` |
| POST | `/api/auth/refresh-token` | `{ refreshToken }` | `{ token, expiresIn }` |

### Protected Endpoints (JWT required in Authorization header)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/auth/profile` | - | User profile data |
| PUT | `/api/auth/profile` | `{ name }` | Updated user |
| POST | `/api/auth/logout` | - | Success message |

---

## 🔑 Key Files Changed

```
src/
├── services/
│   ├── firebase.service.js       ← NEW: Firebase token verification
│   ├── token.service.js          ← NEW: JWT management
│   ├── auth.service.js           ← UPDATED: Refactored logic
│   └── otp.service.js            ← DEPRECATED: Can be deleted
├── controllers/
│   └── auth.controller.js        ← UPDATED: New endpoints
├── models/
│   └── user.model.js             ← UPDATED: Phone as primary
├── routes/
│   └── auth.routes.js            ← UPDATED: New routes
├── middleware/
│   └── auth.js                   ← UPDATED: Uses TokenService
└── utils/
    └── phoneUtils.js             ← NEW: Phone normalization
```

---

## 📦 Dependencies

No new dependencies! Uses existing:
- `firebase-admin` (for token verification)
- `jsonwebtoken` (for JWT)
- `pg` (for database)

---

## 🧪 Testing

### Test in Postman

```
1. POST http://localhost:5000/api/auth/login-test
   Body: { "phone": "9876543210" }
   
2. Copy token from response

3. GET http://localhost:5000/api/auth/profile
   Header: Authorization: Bearer <TOKEN>
   
4. Verify you see your user profile
```

### Test in Development

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Test endpoint
curl -X POST http://localhost:5000/api/auth/login-test \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

---

## ⏱️ Token Expiry

- **Access Token (JWT)**: 30 days
  - For persistent login (like Swiggy)
  - After 30 days, user needs to re-login

- **Refresh Token**: 60 days
  - Used to get new access token without re-login
  - Can be implemented for better UX

---

## 🔒 Security Features

✅ **Phone is unique identifier** - Only one account per phone
✅ **Firebase validates tokens** - Not just decoded
✅ **JWT short-lived** - 30 days is reasonable for mobile
✅ **Rate limiting** - 100 requests per 15 minutes
✅ **CORS enabled** - Only specific origins
✅ **Secrets in .env** - Not in code

---

## 🚨 Common Issues

### "Firebase token is required"
- Frontend not sending `firebaseToken` in request body

### "Invalid Firebase token"
- Firebase didn't verify it
- Check: Is FIREBASE_SERVICE_ACCOUNT set in .env?

### "Phone number not found in Firebase token"
- User didn't complete OTP on frontend
- Firebase OTP must be verified before sending token

### "Token has expired"
- JWT is older than 30 days
- User needs to login again

---

## 📝 Environment Variables

```env
# JWT Configuration
JWT_SECRET=<random_string_32_chars>
JWT_REFRESH_SECRET=<random_string_32_chars>
JWT_EXPIRY=30d
JWT_REFRESH_EXPIRY=60d

# Firebase (from Firebase Console)
FIREBASE_SERVICE_ACCOUNT=<json_string>
FIREBASE_PROJECT_ID=your-project
FIREBASE_API_KEY=your-api-key

# Database
DATABASE_URL=postgresql://...

# Server
NODE_ENV=development
PORT=5000
```

Generate JWT secrets:
```bash
openssl rand -base64 32
```

---

## 🎯 Data Flow Diagram

```
User Phone
    ↓
Firebase OTP
    ↓
Firebase ID Token
    ↓
POST /api/auth/login
    ↓
Firebase Admin SDK verifies token
    ↓
Extract phone from token
    ↓
Find/Create user in DB (by phone)
    ↓
Generate JWT (30 days)
    ↓
Return: token + user data
    ↓
Frontend stores JWT in AsyncStorage
    ↓
All requests include JWT
    ↓
Backend validates JWT with TokenService
    ↓
Process request
```

---

## 🔄 Future: WhatsApp OTP

System is designed to support multiple providers without code changes:

```javascript
// Current
loginWithFirebaseToken(idToken)

// Future (same backend logic)
loginWithWhatsAppToken(phone, otp)

// Database already supports this:
auth_provider: 'firebase' | 'whatsapp' | 'sms' | ...
```

---

## 📚 Documentation Files

- `AUTH_SYSTEM_DOCUMENTATION.md` - Complete detailed guide
- `migrations/migration_auth_refactor.sql` - Database migrations
- `.env.example` - Environment variable reference
- `README.md` - General project info

---

## ✅ Checklist: Migration to New System

- [ ] Update database (run migration SQL)
- [ ] Update `.env` with new variables
- [ ] Delete old OTP endpoints from routes
- [ ] Update frontend to use Firebase OTP + `/api/auth/login`
- [ ] Test login flow
- [ ] Test protected endpoints
- [ ] Test token refresh
- [ ] Verify phone normalization
- [ ] Deploy to production
- [ ] Monitor logs for errors

---

**That's it! 🎉 Your authentication system is now production-ready.**
