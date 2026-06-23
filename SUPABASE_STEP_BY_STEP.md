# 📝 SUPABASE SETUP: DETAILED STEPS

## STEP 1: Get Connection String

### 1.1 Login to Supabase

1. Go to [app.supabase.com](https://app.supabase.com)
2. Login with your email/GitHub
3. You'll see your project listed

### 1.2 Find Database Connection String

**Follow these clicks:**

```
Dashboard Home
  ↓
Click on your project "tailor-app"
  ↓
Left sidebar → "Settings" (bottom)
  ↓
Click "Database" (left menu)
  ↓
Find section: "Connection string"
  ↓
Choose "PostgreSQL" tab
  ↓
Copy the full URL
```

### 1.3 What You'll Copy

It looks like:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**What each part means:**
- `postgres` = username
- `YOUR_PASSWORD` = your database password (you set during project creation)
- `db.xxxxx.supabase.co` = your database host
- `5432` = database port (standard for PostgreSQL)
- `postgres` = database name

### 1.4 Copy the URL

Click the **copy icon** next to the connection string
(Or manually select and copy)

**SAVE THIS URL - you'll need it next!** 🔑

---

## STEP 2: Import Database Schema

### 2.1 Open SQL Editor in Supabase

**Follow these clicks:**

```
Your Project Dashboard
  ↓
Left sidebar → "SQL Editor"
  ↓
Click "New Query" (blue button)
  ↓
You'll see empty SQL editor
```

### 2.2 Get the database.sql File

You already have it: `/tailor-backend/database.sql`

**View it:**
```bash
cat /Users/siddiqkolimi/Desktop/studygargae/tailor-backend/database.sql
```

Or open in VS Code:
- Open file: `database.sql`
- Select ALL: `Ctrl+A` (or `Cmd+A`)
- Copy: `Ctrl+C` (or `Cmd+C`)

### 2.3 Paste into Supabase SQL Editor

1. Click in the SQL editor (white area)
2. Paste the SQL code: `Ctrl+V` (or `Cmd+V`)
3. You'll see all the CREATE TABLE commands

### 2.4 Run the SQL

Look for the **blue "RUN" button** (top right of editor)

Click it!

**Wait for the message:** ✅ "Query successful"

### 2.5 Verify Tables Created

After running, do one of these:

**Option A: In Supabase SQL Editor**
```sql
-- Paste this and click RUN:
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public';
```

**Option B: Check visually**
```
Left sidebar → "Table Editor"
You should see:
  - users
  - shops
  - customers
  - measurements
  - orders
  - subscriptions
```

---

## STEP 3: Update .env File

### 3.1 Open .env File

In your terminal:
```bash
# Navigate to backend
cd /Users/siddiqkolimi/Desktop/studygargae/tailor-backend

# Open .env in editor
nano .env
```

Or open in VS Code:
- File → Open: `.env`

### 3.2 Find This Line

Look for:
```env
DATABASE_URL=postgresql://localhost/tailor_app
```

### 3.3 Replace with Supabase URL

Delete that line and replace with:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**Use the exact URL you copied from Supabase!**

### 3.4 Save File

If using `nano`:
```
Press: CTRL+X
Press: Y (yes to save)
Press: Enter
```

If using VS Code:
```
Press: Cmd+S (or Ctrl+S)
```

### 3.5 Verify Changes

```bash
# View the .env file
cat .env
```

You should see your Supabase URL there ✅

---

## STEP 4: Test Connection

### 4.1 Restart Backend Server

```bash
# Stop the server (if running)
Press CTRL+C

# Start again
npm run dev
```

### 4.2 Check Output

You should see:
```
✓ Server started successfully
✓ Environment: development
✓ Server running on http://localhost:5001
✓ Health check: http://localhost:5001/health
```

**No errors?** → **Database is connected!** ✅

### 4.3 Test API

```bash
curl http://localhost:5001/api/health
```

Expected output:
```json
{"status":"ok","timestamp":"2026-04-11T05:30:00Z"}
```

### 4.4 Test Database Access

Create a test user:

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
      "firebase_uid": "test_user_123",
      "created_at": "2026-04-11T05:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Got a token?** → **Database is working!** ✅🎉

---

## VISUAL GUIDE

### Supabase Dashboard Navigation

```
📊 SUPABASE CONSOLE
│
├─ 🏠 Dashboard
│  └─ [Your Project: tailor-app]
│
├─ ⚙️ Settings (bottom left)
│  └─ Database
│     └─ Connection String (copy here!)
│
├─ 📋 SQL Editor (left sidebar)
│  └─ New Query → Paste database.sql → Run
│
└─ 📺 Table Editor (left sidebar)
   └─ View all created tables
```

---

## TROUBLESHOOTING

### Issue: "Cannot connect to database"

```
Error: ECONNREFUSED or connection timeout

Solutions:
1. Double-check the CONNECTION_STRING
2. Verify Supabase project is active (check dashboard)
3. Wait 1 minute and try again
4. Verify password is correct (no typos!)
5. Check internet connection
```

### Issue: "Tables already exist"

```
Error: relation "users" already exists

Solution:
1. The tables were already created (good!)
2. You can skip running SQL again
3. Just use the connection string
```

### Issue: "SQL errors when running database.sql"

```
Error: syntax error or permission denied

Solutions:
1. Make sure you have all the SQL code
2. Try deleting old tables first:
   DROP TABLE IF EXISTS subscriptions CASCADE;
   DROP TABLE IF EXISTS orders CASCADE;
   ... etc
3. Then run database.sql again
```

### Issue: ".env file not found"

```
Error: ENOENT: no such file or directory '.env'

Solution:
1. You're in wrong directory
2. Make sure you're in: /tailor-backend
3. Run: pwd (should show .../tailor-backend)
4. Create .env: cp .env.example .env
```

---

## COMPLETE CHECKLIST

```
✓ Step 1: Get Connection String
  [ ] Logged into Supabase
  [ ] Found "Connection String" section
  [ ] Copied PostgreSQL URL
  [ ] Saved the URL

✓ Step 2: Import Database Schema
  [ ] Opened SQL Editor
  [ ] Pasted entire database.sql
  [ ] Clicked "RUN"
  [ ] Got success message
  [ ] Verified 6 tables created

✓ Step 3: Update .env File
  [ ] Opened .env file
  [ ] Found DATABASE_URL line
  [ ] Replaced with Supabase URL
  [ ] Saved file
  [ ] Verified connection string is correct

✓ Step 4: Test Connection
  [ ] Restarted npm run dev
  [ ] No database errors
  [ ] Health check worked
  [ ] Created test user successfully
  [ ] Got JWT token back
```

---

## 🎯 WHAT YOU'VE DONE

By completing these 4 steps:

1. ✅ Connected backend to Supabase PostgreSQL database
2. ✅ Created all 6 tables (users, shops, customers, etc.)
3. ✅ Configured environment variables
4. ✅ Verified database works with API

**Next:** Setup Firebase OTP (follow FIREBASE_SUPABASE_SETUP.md Part 2)

---

**✅ DATABASE SETUP COMPLETE!** 🗄️

Your backend is now connected to production-ready PostgreSQL! 🚀
