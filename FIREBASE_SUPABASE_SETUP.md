# 🔧 COMPLETE SETUP GUIDE: FIREBASE + SUPABASE

## Part 1: SUPABASE (Database Setup)

### Step 1.1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **"Sign Up"** (top right)
3. Choose **"Sign up with GitHub"** (easiest)
4. Authorize Supabase
5. Create account

---

### Step 1.2: Create New Project

1. Click **"New Project"** (dashboard)
2. Fill in:
   - **Project name**: `tailor-app`
   - **Database password**: (create strong password, save it!)
   - **Region**: Choose closest to you (e.g., `ap-south-1` for India)
3. Click **"Create new project"**
4. **Wait 2-3 minutes** for project to initialize

---

### Step 1.3: Get Database Connection String

1. Go to **Settings** (bottom left)
2. Click **"Database"** (left sidebar)
3. Find section: **"Connection String"**
4. Copy the **PostgreSQL** connection string
5. It looks like:
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
   ```

---

### Step 1.4: Add Database Schema

1. In Supabase, go to **"SQL Editor"** (left sidebar)
2. Click **"New Query"**
3. Copy entire content from [database.sql](database.sql)
4. Paste into SQL Editor
5. Click **"Run"** (blue button)
6. Wait for success message

---

### Step 1.5: Update .env File

Edit `.env` file in your backend:

```bash
# Open .env
nano .env
```

Replace this line:
```env
DATABASE_URL=postgresql://localhost/tailor_app
```

With your Supabase connection string:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

Save: Press `CTRL+X` → `Y` → `Enter`

---

### Step 1.6: Test Database Connection

```bash
# Stop the server first
press CTRL+C

# Restart server
npm run dev
```

If server starts without errors → **Database is connected!** ✅

---

## Part 2: FIREBASE (OTP Setup)

### Step 2.1: Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Fill in:
   - **Project name**: `tailor-app`
   - Accept terms
4. Click **"Continue"**
5. Click **"Create project"** (skip analytics for now)
6. Wait for project creation

---

### Step 2.2: Enable Phone Authentication

1. In Firebase console, go to **"Authentication"** (left sidebar)
2. Click **"Get started"**
3. Click **"Phone"** (tab at bottom)
4. Click **"Enable"** (toggle)
5. Choose provider: **"Phone number / SMS"**
6. Click **"Save"**

---

### Step 2.3: Setup Recaptcha (for Phone OTP)

1. Still in Authentication → Phone tab
2. Under "reCAPTCHA config", follow the setup:
   - Keep default settings
   - Click **"Save"**

---

### Step 2.4: Get Firebase Credentials

1. Go to **"Project Settings"** (gear icon, top right)
2. Click **"Service Accounts"** tab
3. Click **"Generate New Private Key"** (blue button)
4. Save the JSON file (keep it safe!)

---

### Step 2.5: Get Firebase Web Credentials

1. Go to **"Project Settings"**
2. Click **"General"** tab
3. Scroll down to **"Your apps"** section
4. If no app, click **"Add app"** → **"Web"**
5. Register app with name: `tailor-app-web`
6. Copy the `firebaseConfig` object

It looks like:
```javascript
{
  apiKey: "AIzaSyxxxxxx",
  authDomain: "tailor-app.firebaseapp.com",
  projectId: "tailor-app",
  storageBucket: "tailor-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx"
}
```

---

### Step 2.6: Update Backend .env

Edit `.env` file and add:

```env
FIREBASE_API_KEY=AIzaSyxxxxxx
FIREBASE_AUTH_DOMAIN=tailor-app.firebaseapp.com
FIREBASE_PROJECT_ID=tailor-app
FIREBASE_STORAGE_BUCKET=tailor-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:xxxxx
```

---

### Step 2.7: Update Frontend .env (React Native)

Create `.env` in your React Native app:

**File: `stitchpro-app/.env`**

```env
# Firebase Web Config
REACT_APP_FIREBASE_API_KEY=AIzaSyxxxxxx
REACT_APP_FIREBASE_AUTH_DOMAIN=tailor-app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tailor-app
REACT_APP_FIREBASE_STORAGE_BUCKET=tailor-app.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:xxxxx

# Backend API
REACT_APP_API_URL=http://localhost:5001/api
```

---

### Step 2.8: Setup Firebase in React Native App

**File: `stitchpro-app/App.js`**

```javascript
import React, { useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, reactNativeLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: reactNativeLocalPersistence(AsyncStorage),
});

export default function App() {
  useEffect(() => {
    // Test Firebase is working
    console.log('Firebase initialized:', auth.currentUser);
  }, []);

  return (
    // Your app components
  );
}
```

---

## Part 3: VERIFICATION CHECKLIST

### Supabase ✓
- [ ] Account created
- [ ] Project created
- [ ] Database schema imported (from database.sql)
- [ ] Connection string copied to .env
- [ ] Server started without database errors

### Firebase ✓
- [ ] Firebase project created
- [ ] Phone authentication enabled
- [ ] Web app registered
- [ ] Credentials copied to backend .env
- [ ] Credentials copied to frontend .env
- [ ] Firebase initialized in React Native app

---

## Part 4: TEST THE SETUP

### Test 1: Backend Database Connection

```bash
# In backend directory
curl http://localhost:5001/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

### Test 2: Firebase Phone OTP (Frontend)

In React Native app, create a test screen:

```javascript
import { getAuth, signInWithPhoneNumber } from 'firebase/auth';

export default function FirebaseTestScreen() {
  const handleSendOTP = async () => {
    try {
      const auth = getAuth();
      const result = await signInWithPhoneNumber(auth, '+919876543210', window.recaptchaVerifier);
      console.log('OTP sent:', result);
      alert('OTP sent to +919876543210');
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <button onPress={handleSendOTP}>
      Send OTP to +919876543210
    </button>
  );
}
```

### Test 3: Create Test User

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "firebase_uid": "test_user_123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "firebase_uid": "test_user_123"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## Part 5: TROUBLESHOOTING

### Issue: "Cannot connect to database"
```
Solution:
1. Verify CONNECTION_STRING in .env
2. Check if Supabase project is running
3. Verify password is correct
4. Check firewall isn't blocking connection
```

### Issue: "Firebase project not found"
```
Solution:
1. Verify FIREBASE_PROJECT_ID is correct
2. Check project exists in Firebase console
3. Verify all 6 credentials are correct
```

### Issue: "Phone authentication not working"
```
Solution:
1. Verify Phone auth is ENABLED in Firebase
2. Check you're using correct country code (+91 for India)
3. Verify SMS is not blocked in your region
4. Try with a different phone number
```

### Issue: "recaptchaVerifier not defined"
```
Solution:
1. Need to add reCAPTCHA to your app
2. Install: npm install react-recaptcha-v3
3. Initialize in App.js (Firebase will handle it automatically)
```

---

## Part 6: WHAT'S NEXT?

Once everything is set up:

1. ✅ Test login with Firebase OTP
2. ✅ Test creating shops and customers
3. ✅ Setup Razorpay (follow SETUP_STEP_7_RAZORPAY.md)
4. ✅ Deploy to production (follow SETUP_STEP_8_DEPLOYMENT.md)

---

## 🔑 Important Files to Keep Safe

- **Supabase**: Connection string (in .env)
- **Firebase**: Private key JSON (keep in secure location)
- **JWT Secret**: In .env (strong random key)
- **Razorpay Keys**: In .env when needed

**NEVER commit .env files to git!** ❌

---

## ✅ SUCCESS CRITERIA

You'll know it's working when:

1. ✅ `curl http://localhost:5001/api/health` returns ok
2. ✅ Tables appear in Supabase SQL Editor
3. ✅ You can send OTP via Firebase
4. ✅ Login endpoint returns JWT token
5. ✅ Can create shops/customers via API

---

**Need help?** Check these docs:
- [Supabase Docs](https://supabase.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [SETUP_STEP_1_DATABASE.md](SETUP_STEP_1_DATABASE.md)
- [SETUP_STEP_2_ENV.md](SETUP_STEP_2_ENV.md)

Done! 🎉
