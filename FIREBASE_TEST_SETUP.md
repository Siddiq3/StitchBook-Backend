# Firebase Test Phone Numbers Setup Guide

## What Are Test Phone Numbers?

Test phone numbers allow you to:
- ✅ Test OTP flow without sending real SMS
- ✅ Hardcode specific OTP codes
- ✅ Test in development environment
- ✅ Save costs (no SMS charges)

---

## Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **tailor-app-d2860**
3. Go to **Authentication** → **Sign-in method** (left sidebar)
4. Click on **Phone** authentication

---

## Step 2: Add Test Phone Numbers

### In the Phone Authentication section:

1. Scroll down to **"Phone numbers for testing"** section
2. Click **"Add phone number"**
3. Fill in:
   - **Phone number**: `+919876543210` (with country code)
   - **OTP code**: `123456` (any 6 digits)

**Add more test numbers:**

| Phone Number | OTP Code |
|---|---|
| +919876543210 | 123456 |
| +919705116606 | 123456 |
| +918888888888 | 123456 |
| +919999999999 | 654321 |

4. Click **"Save"** for each number

---

## Step 3: How Backend Uses Test Numbers

### In Development (NODE_ENV=development):

```javascript
// When user sends OTP to test number
POST /api/auth/send-otp
{ "phone": "+919876543210" }

// Response:
{
  "success": true,
  "sessionInfo": "test_session_...",
  "isTest": true,
  "testOTP": "123456",  // Shown in logs for development
  "message": "[TEST MODE] Use OTP: 123456"
}

// User receives NO SMS - just use the OTP shown
// Then verify:
POST /api/auth/verify-otp
{
  "sessionInfo": "test_session_...",
  "otp": "123456",
  "phone": "+919876543210"
}

// Response:
{
  "success": true,
  "data": {
    "user": { "id": 1, "phone": "+919876543210" },
    "token": "eyJhbGc..."
  },
  "isTest": true
}
```

### In Production (NODE_ENV=production):

- Test numbers are **ignored**
- Real Firebase Phone Auth API is used
- Requires reCAPTCHA from frontend
- Real SMS with real OTP is sent

---

## Step 4: Update .env

Your `.env` already has `NODE_ENV=development`, so test mode is active:

```env
NODE_ENV=development  # Test mode ON
NODE_ENV=production   # Test mode OFF (real Firebase)
```

---

## Step 5: Test It Locally

### Terminal 1: Start Server

```bash
cd /Users/siddiqkolimi/Desktop/studygargae/tailor-backend
node src/server.js
```

Expected output:
```
✓ Server running on http://localhost:5002
```

### Terminal 2: Test Send OTP

```bash
curl -X POST http://localhost:5002/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionInfo": "test_session_1775892956789_9876543210",
    "isTest": true,
    "testOTP": "123456",
    "message": "[TEST MODE] OTP sent to +919876543210. Use OTP: 123456"
  }
}
```

### Terminal 2: Test Verify OTP

Paste `sessionInfo` from response above:

```bash
curl -X POST http://localhost:5002/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "sessionInfo":"test_session_1775892956789_9876543210",
    "otp":"123456",
    "phone":"+919876543210"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "id": 1,
      "phone": "+919876543210",
      "created_at": "2026-04-11T08:03:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJwaG9uZSI6IiszOTE5ODc2NTQzMjEwIiwiaWF0IjoxNzc1ODkyOTU2LCJleHAiOjE3NzY0OTc3NTZ9.xyz123",
    "isTest": true
  }
}
```

---

## Step 6: Test Wrong OTP

```bash
curl -X POST http://localhost:5002/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "sessionInfo":"test_session_1775892956789_9876543210",
    "otp":"000000",
    "phone":"+919876543210"
  }'
```

Expected response (should fail):
```json
{
  "success": false,
  "message": "OTP verification failed",
  "error": "Invalid OTP. Expected: 123456"
}
```

---

## Step 7: Test Non-Test Phone Number (Production Behavior)

```bash
curl -X POST http://localhost:5002/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919111111111"}'
```

Response (tries real Firebase):
```json
{
  "success": false,
  "message": "Failed to send OTP",
  "error": "Firebase Error: CONFIGURATION_NOT_FOUND"
}
```

This is expected because Firebase reCAPTCHA is only on frontend. In production with reCAPTCHA token from frontend, it will work.

---

## Step 8: Production Deployment

### When deploying to production:

1. **Update .env:**
   ```env
   NODE_ENV=production
   ```

2. **Set up Firebase reCAPTCHA** in your React Native app (will be done in frontend setup)

3. **Test numbers will be IGNORED** - only real Firebase Phone Auth works

---

## Summary

| Mode | Test Numbers | Real SMS |
|------|---|---|
| Development (NODE_ENV=dev) | ✅ Work instantly | ❌ No |
| Production (NODE_ENV=prod) | ❌ Ignored | ✅ Yes (needs reCAPTCHA) |

---

## Troubleshooting

### Getting "Invalid phone number format"?
- Must include country code: `+919876543210`
- Cannot use: `9876543210` or `919876543210`

### Getting "Test OTP doesn't match"?
- Check Firebase Console for exact OTP you set
- OTP is case-sensitive

### Getting "CONFIGURATION_NOT_FOUND"?
- This happens with non-test numbers in dev mode
- It's expected - only test numbers work in dev without reCAPTCHA
- For other numbers, switch to production mode (but then needs reCAPTCHA)

---

## Next Steps

After testing locally:
1. Test with your React Native app
2. Deploy backend to production
3. Set up reCAPTCHA in React Native frontend
4. Deploy React Native app
5. Switch to production mode

