# 🔐 STEP 2: ENVIRONMENT VARIABLES CONFIGURATION

## Overview
Environment variables store sensitive information like database credentials, API keys, and secrets. They keep your code safe and secure.

---

## 🎯 Goal
- ✅ Copy .env.example to .env
- ✅ Understand what each variable does
- ✅ Get values for each variable
- ✅ Configure .env properly

---

## 📋 What is .env File?

### Purpose
```
Stores sensitive data that should NOT be in code:
- Database passwords
- API keys
- JWT secrets
- Payment gateway keys
```

### Security Rules
```
❌ Never commit .env to git
❌ Never share .env with anyone
✅ Always add .env to .gitignore (already done)
✅ Use .env.example as template
✅ Change all values in production
```

---

## 🚀 STEP-BY-STEP SETUP

### Step 1: Create .env File

Navigate to tailor-backend folder and copy example:

```bash
cd /Users/siddiqkolimi/Desktop/studygargae/tailor-backend
cp .env.example .env
```

This creates a `.env` file in your project root with default values.

### Step 2: Open .env in Editor

Open the newly created `.env` file and you'll see:

```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@host:5432/postgres
JWT_SECRET=change_this_to_random_string_in_production_min_32_chars
JWT_EXPIRY=7d
...
```

Now fill in each value following the guide below.

---

## 📝 VARIABLE REFERENCE

### 1. PORT
```
Default: 5000
What it does: Server listening port
Where to use:
- Development: 5000 (default)
- Production: 3000 or 8000

Example:
PORT=5000
```

### 2. NODE_ENV
```
Options: development OR production
What it does: Sets application mode
Where to use:
- During development: development
- For production deployment: production

Example:
NODE_ENV=development
```

### 3. DATABASE_URL (MOST IMPORTANT!)
```
This is your database connection string.
Gets all database info in one URL.

HOW TO GET IT:

From Supabase (Recommended):
1. Go to https://supabase.com/dashboard
2. Open your project
3. Click "Settings" (left sidebar)
4. Click "Database"
5. Find "Connection String"
6. Click on "PostgreSQL" tab
7. Copy the connection string
8. It looks like:
   postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres

Replace "YOUR_PASSWORD" with your actual database password!

Format:
postgresql://username:password@host:port/database

Example (Supabase):
DATABASE_URL=postgresql://postgres:my_password_123@db.gvbuwftkzvnqixrh.supabase.co:5432/postgres

Example (Local):
DATABASE_URL=postgresql://postgres:password123@localhost:5432/tailor_app
```

### 4. JWT_SECRET (CRITICAL FOR SECURITY!)
```
What it does: Secret key to sign JWT tokens
Rules:
- Must be random string
- Should be at least 32 characters
- Change in production!

HOW TO GENERATE:

Using OpenSSL (Mac/Linux):
openssl rand -base64 32

Output will look like:
rZ9kL3mN7vQ2xP5tY8wJ6hG1cF4dB9eM2

Using Online Generator:
Visit: https://randomkeygen.com/
Copy "CodeIgniter Encryption Keys" (192-bit)

Paste in .env:
JWT_SECRET=rZ9kL3mN7vQ2xP5tY8wJ6hG1cF4dB9eM2

⚠️ NEVER use example values in production!
```

### 5. JWT_EXPIRY
```
How long JWT tokens remain valid
Options: 7d, 24h, 30d, 60d, etc.

Recommendations:
- Development: 7d (testing convenience)
- Production: 24h or 7d (security)

Examples:
JWT_EXPIRY=7d     # 7 days
JWT_EXPIRY=24h    # 24 hours
JWT_EXPIRY=30d    # 30 days
```

### 6. FIREBASE_PROJECT_ID & FIREBASE_API_KEY
```
For Firebase OTP verification (frontend only)
Get from: Firebase Console

HOW TO GET:

1. Go to https://console.firebase.google.com
2. Select your project (create if needed)
3. Click "Settings" (gear icon)
4. Click "Project Settings"
5. Click "Web" (if not selected)
6. Copy "Project ID" and "API Key"

Example:
FIREBASE_PROJECT_ID=tailor-app-12345
FIREBASE_API_KEY=AIzaSyDpZY6e_8L2W9Q5R6S7T8U9V0W1X2Y3Z4

Note: Backend doesn't use these directly
(Frontend handles OTP verification)
```

### 7. RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET
```
For Razorpay payment processing
Get from: Razorpay Dashboard

HOW TO GET:

1. Go to https://dashboard.razorpay.com
2. Log in / Sign up
3. Go to "Settings" > "API Keys"
4. Copy "Key ID" and "Key Secret"
5. Make sure you're using TEST keys (not Live!)

Format:
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxx

Important:
- Use TEST keys during development
- Switch to LIVE keys only for production
- Never share these keys
```

### 8. LOG_LEVEL
```
How much logging detail to show
Options: error, warn, info, debug

Recommendations:
- Development: info (shows useful info)
- Production: warn (only warnings and errors)

Example:
LOG_LEVEL=info
```

### 9. FRONTEND_URL (Optional)
```
Where your React Native app runs
Used for CORS configuration

Format:
http://localhost:3000    # Development
https://yourdomain.com   # Production

Example:
FRONTEND_URL=http://localhost:3000
```

---

## 📋 COMPLETE .env FILE EXAMPLE

Here's what a fully configured .env looks like:

```bash
# Server
PORT=5000
NODE_ENV=development

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:password123@db.abc123.supabase.co:5432/postgres

# JWT
JWT_SECRET=rZ9kL3mN7vQ2xP5tY8wJ6hG1cF4dB9eM2
JWT_EXPIRY=7d

# Firebase
FIREBASE_PROJECT_ID=tailor-app-12345
FIREBASE_API_KEY=AIzaSyDpZY6e_8L2W9Q5R6S7T8U9V0W1X2Y3Z4

# Razorpay
RAZORPAY_KEY_ID=rzp_test_FJ7n8mA9pQ2
RAZORPAY_KEY_SECRET=xK8pL9mN2vR5tQ1

# Logging
LOG_LEVEL=info

# Frontend
FRONTEND_URL=http://localhost:3000
```

---

## ✅ VERIFICATION CHECKLIST

After creating .env, verify:

### ✅ Check 1: File Exists
```bash
ls -la .env
# Should show the .env file
```

### ✅ Check 2: .env in .gitignore
```bash
cat .gitignore | grep .env
# Should show: .env
```

### ✅ Check 3: All Variables Filled
Your .env should have:
- [ ] PORT
- [ ] NODE_ENV
- [ ] DATABASE_URL
- [ ] JWT_SECRET
- [ ] JWT_EXPIRY
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_API_KEY
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] LOG_LEVEL

### ✅ Check 4: No Placeholder Values
Make sure you replaced:
- [ ] DATABASE_URL - actual connection string
- [ ] JWT_SECRET - random generated key
- [ ] RAZORPAY Keys - real keys from Razorpay
- [ ] FIREBASE Keys - real keys from Firebase

---

## 🆘 TROUBLESHOOTING

### Issue: "Cannot find module dotenv"
```
Solution: Make sure you run: npm install
(Will install all dependencies including dotenv)
```

### Issue: "DATABASE_URL is undefined"
```
Solution:
1. Check if .env file exists
2. Verify DATABASE_URL is filled in .env
3. Restart server: npm run dev
```

### Issue: "JWT_SECRET should be longer"
```
Solution: Generate longer random string
Run: openssl rand -base64 32
Use at least 32 characters
```

### Issue: "Port 5000 already in use"
```
Solution: Either
1. Stop other process using port 5000
2. Change PORT in .env to 5001 or 5002
```

---

## 🔒 SECURITY BEST PRACTICES

### DO ✅
```
✅ Use strong, random JWT_SECRET
✅ Keep different values for dev and production
✅ Store .env safely (not on GitHub)
✅ Rotate JWT_SECRET periodically
✅ Use TEST keys first, then LIVE keys
✅ Never commit .env or secrets
```

### DON'T ❌
```
❌ Hardcode secrets in code
❌ Commit .env to git
❌ Share .env with others
❌ Use same secret for dev and production
❌ Leave .env empty
❌ Use weak passwords
```

---

## 📞 GETTING VALUES - QUICK LINKS

| Variable | Where to Get | Link |
|----------|-------------|------|
| DATABASE_URL | Supabase | https://app.supabase.com |
| JWT_SECRET | Generate | `openssl rand -base64 32` |
| FIREBASE Keys | Firebase | https://console.firebase.google.com |
| RAZORPAY Keys | Razorpay | https://dashboard.razorpay.com |

---

## 🎯 TIME ESTIMATE

- Copy .env.example → 30 seconds
- Get DATABASE_URL → 2 minutes
- Generate JWT_SECRET → 1 minute
- Get Firebase keys → 2 minutes
- Get Razorpay keys → 2 minutes
- Fill in .env → 2 minutes

**Total: 10 minutes**

---

## ✅ Next Steps

Once .env is configured:

1. **Verify** all environment variables are filled
2. **Save** the .env file
3. **Proceed to STEP 3**: Backend setup - npm install & npm run dev

---

**✅ STEP 2 COMPLETE!** 🎉

Environment variables are now configured. Proceed to **STEP 3: Backend Setup**
