# 📮 POSTMAN TESTING GUIDE

## 🚀 Quick Start

### Base URL
```
http://localhost:5000
```

### Default Headers (for all requests)
```
Content-Type: application/json
```

---

## ✅ Health Check (Test Server Running)

### Endpoint
```
GET http://localhost:5000/health
```

### cURL
```bash
curl -X GET http://localhost:5000/health
```

### Expected Response
```json
{
  "status": "OK",
  "timestamp": "2026-04-26T10:30:00Z",
  "version": "1.0.0"
}
```

---

## 🔑 AUTHENTICATION ENDPOINTS

---

## 1️⃣ LOGIN WITH TEST CREDENTIALS (Development Only)

**BEST FOR TESTING** - No Firebase required

### Endpoint
```
POST http://localhost:5000/api/auth/login-test
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "phone": "9876543210"
}
```

### cURL
```bash
curl -X POST http://localhost:5000/api/auth/login-test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210"
  }'
```

### Expected Response (201 Created)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "30d",
    "user": {
      "id": 1,
      "phone": "+919876543210",
      "name": null,
      "authProvider": "firebase",
      "createdAt": "2026-04-26T10:30:00Z"
    }
  }
}
```

### Save Response
Copy the `token` value for next requests.

---

## 2️⃣ LOGIN WITH FIREBASE TOKEN (Production)

**For production use with real Firebase OTP**

### Endpoint
```
POST http://localhost:5000/api/auth/login
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "firebaseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### cURL
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseToken": "YOUR_FIREBASE_ID_TOKEN_HERE"
  }'
```

### Expected Response (201 Created)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "30d",
    "user": {
      "id": 1,
      "phone": "+919876543210",
      "name": null,
      "authProvider": "firebase",
      "createdAt": "2026-04-26T10:30:00Z"
    }
  }
}
```

### Get Firebase Token
1. Use Firebase Console or React Native Firebase SDK
2. Complete OTP verification
3. Get idToken from `user.getIdToken()`

---

## 3️⃣ GET USER PROFILE (Protected)

**Requires JWT Token**

### Endpoint
```
GET http://localhost:5000/api/auth/profile
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

### cURL
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": 1,
    "phone": "+919876543210",
    "name": null,
    "authProvider": "firebase",
    "shopId": null,
    "firebaseUid": "abc123xyz",
    "createdAt": "2026-04-26T10:30:00Z",
    "updatedAt": "2026-04-26T10:30:00Z"
  }
}
```

---

## 4️⃣ UPDATE USER PROFILE (Protected)

**Update user name**

### Endpoint
```
PUT http://localhost:5000/api/auth/profile
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

### Request Body
```json
{
  "name": "John Doe"
}
```

### cURL
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "John Doe"
  }'
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "phone": "+919876543210",
    "name": "John Doe",
    "authProvider": "firebase",
    "shopId": null,
    "firebaseUid": "abc123xyz",
    "createdAt": "2026-04-26T10:30:00Z",
    "updatedAt": "2026-04-26T10:30:00Z"
  }
}
```

---

## 5️⃣ VERIFY TOKEN

**Check if JWT token is valid**

### Endpoint
```
POST http://localhost:5000/api/auth/verify-token
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### cURL
```bash
curl -X POST http://localhost:5000/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "valid": true,
    "userId": 1,
    "phone": "+919876543210",
    "expiresAt": "2026-05-26T10:30:00Z"
  }
}
```

### Invalid Token Response (401 Unauthorized)
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "data": {
    "valid": false
  }
}
```

---

## 6️⃣ REFRESH TOKEN

**Get new JWT from refresh token**

### Endpoint
```
POST http://localhost:5000/api/auth/refresh-token
```

### Request Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### cURL
```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "30d"
  }
}
```

---

## 7️⃣ LOGOUT (Protected)

**Invalidate current token**

### Endpoint
```
POST http://localhost:5000/api/auth/logout
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

### cURL
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 📋 TESTING WORKFLOW

### Step 1: Test Server Health
```bash
curl -X GET http://localhost:5000/health
```

### Step 2: Login (Get JWT Token)
```bash
curl -X POST http://localhost:5000/api/auth/login-test \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

**Save the `token` value from response**

### Step 3: Get Profile (Use JWT Token)
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

### Step 4: Update Profile
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_TOKEN_HERE" \
  -d '{"name": "Your Name"}'
```

### Step 5: Verify Token
```bash
curl -X POST http://localhost:5000/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token": "PASTE_TOKEN_HERE"}'
```

### Step 6: Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

---

## 🔴 ERROR RESPONSES

### Missing Authorization Header (401)
```json
{
  "success": false,
  "message": "Authorization header missing",
  "code": "AUTH_HEADER_MISSING"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

### Missing Request Body (400)
```json
{
  "success": false,
  "message": "Phone number is required",
  "code": "MISSING_PHONE"
}
```

### Invalid Phone Format (400)
```json
{
  "success": false,
  "message": "Invalid phone number format",
  "code": "INVALID_PHONE"
}
```

### Firebase Token Invalid (401)
```json
{
  "success": false,
  "message": "Firebase token verification failed",
  "code": "FIREBASE_VERIFICATION_FAILED"
}
```

---

## 📌 POSTMAN SETUP (Optional)

### Create Postman Collection

1. **Open Postman**
2. **Create New Collection** → "Tailor Auth"
3. **Add Requests:**
   - Health Check
   - Login Test
   - Get Profile
   - Update Profile
   - Verify Token
   - Refresh Token
   - Logout

### Set Up Environment Variables

1. **Postman** → **Environments** → **Create New**
2. **Add Variables:**

| Variable | Value |
|----------|-------|
| `base_url` | http://localhost:5000 |
| `token` | (leave empty, will auto-fill) |
| `phone` | 9876543210 |

### Auto-capture Token

In **Login Test** request → **Tests** tab:
```javascript
var jsonData = pm.response.json();
pm.environment.set("token", jsonData.data.token);
```

Then use `{{token}}` in Authorization headers for other requests.

---

## ⚡ Quick Testing Commands (Copy & Paste)

### Test 1: Health Check
```bash
curl http://localhost:5000/health
```

### Test 2: Create User & Get Token
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login-test \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}' | jq -r '.data.token')
echo "Token: $TOKEN"
```

### Test 3: Get Profile
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: Update Name
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test User"}'
```

### Test 5: Verify Token
```bash
curl -X POST http://localhost:5000/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}"
```

### Test 6: Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🧪 Testing Checklist

- [ ] Server starts without errors
- [ ] Health check returns 200 OK
- [ ] Login-test returns JWT token
- [ ] Get profile returns user data
- [ ] Update profile saves name
- [ ] Verify-token confirms token valid
- [ ] Refresh-token generates new JWT
- [ ] Logout succeeds
- [ ] Protected endpoint fails without token
- [ ] Protected endpoint fails with invalid token

---

## 📊 Expected Test Flow

```
1. START SERVER
   npm run dev
   ✓ Server running on http://localhost:5000

2. HEALTH CHECK
   GET /health
   ✓ Response: { "status": "OK" }

3. LOGIN
   POST /api/auth/login-test
   ✓ Response includes: token, refreshToken, user

4. USE TOKEN
   GET /api/auth/profile
   Header: Authorization: Bearer TOKEN
   ✓ Response: user profile data

5. UPDATE PROFILE
   PUT /api/auth/profile
   ✓ Response: updated user

6. VERIFY TOKEN
   POST /api/auth/verify-token
   ✓ Response: { valid: true }

7. LOGOUT
   POST /api/auth/logout
   ✓ Response: success message

8. TEST PROTECTED ROUTE (should fail)
   GET /api/auth/profile (without token)
   ✗ Response: 401 Unauthorized
```

---

## 🎯 Common Issues

### Issue: "Cannot POST /api/auth/login-test"
**Solution:** Ensure server is running (`npm run dev`)

### Issue: "Authorization header missing"
**Solution:** Add `-H "Authorization: Bearer TOKEN"` to request

### Issue: "Invalid token"
**Solution:** Make sure you copied the full token value, with no extra spaces

### Issue: "CORS error"
**Solution:** Check CORS is enabled in backend (should be by default)

### Issue: "Database connection error"
**Solution:** Verify DATABASE_URL in .env is correct

---

## ✅ All Set!

You can now test all authentication endpoints. Start with **Login Test**, save the token, then use it for protected endpoints.

Happy testing! 🚀
