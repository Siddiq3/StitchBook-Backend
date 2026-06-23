# Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup PostgreSQL Database

#### Option A: Local PostgreSQL
```bash
# Create database
createdb tailor_app

# Connect and run schema
psql tailor_app < database.sql
```

#### Option B: Supabase (Cloud)
1. Create account at https://supabase.com
2. Create new project
3. Go to SQL Editor
4. Copy-paste content from `database.sql`
5. Execute

### Step 3: Configure Environment
```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your credentials
```

**Example .env:**
```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tailor_app
DB_USER=postgres
DB_PASSWORD=password123

JWT_SECRET=my_super_secret_key_123
JWT_EXPIRY=7d

FIREBASE_PROJECT_ID=your_firebase_project
FIREBASE_API_KEY=your_firebase_key

RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Step 4: Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### Step 5: Test API

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "firebase_uid": "firebase_uid_example"
  }'
```

---

## 📁 Project Structure Summary

```
src/
├── config/          # Database & JWT config
├── models/          # Database queries
├── services/        # Business logic
├── controllers/     # HTTP handlers
├── routes/          # API endpoints
├── middleware/      # Auth & error handling
└── utils/           # Helpers (logger, responder)
```

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `src/app.js` | Express setup |
| `src/server.js` | Server entry |
| `src/config/database.js` | DB connection |
| `database.sql` | Schema |
| `.env.example` | Config template |

---

## 🔑 API Quick Reference

| Method | Endpoint | Auth? | Purpose |
|--------|----------|-------|---------|
| POST | `/api/auth/login` | ❌ | Login user |
| GET | `/api/user/profile` | ✓ | Get profile |
| POST | `/api/shop/create` | ✓ | Create shop |
| POST | `/api/customer/add` | ✓ | Add customer |
| POST | `/api/order/create` | ✓ | Create order |
| PUT | `/api/order/:id` | ✓ | Update order |
| POST | `/api/subscription/verify` | ❌ | Verify payment |

---

## 🎯 Common Tasks

### Add New API Endpoint

1. Create model in `src/models/`
2. Create service in `src/services/`
3. Create controller in `src/controllers/`
4. Create route in `src/routes/`
5. Import route in `src/app.js`

### Query Structure
```javascript
// Model - Database queries
async getUser(id) { /* SQL */ }

// Service - Business logic
async getUserProfile(id) { /* validation, logic */ }

// Controller - HTTP handling
async getProfile(req, res) { /* call service */ }

// Route - API endpoint
router.get('/profile', controller.getProfile)
```

---

## 🚨 Troubleshooting

### Port already in use?
```bash
# Use different port
PORT=5001 npm run dev
```

### Database connection error?
Check:
- PostgreSQL is running: `psql -U postgres`
- .env credentials are correct
- Database exists: `psql -l | grep tailor_app`

### Module not found?
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Next Steps

1. ✅ Database setup complete
2. ✅ Server running
3. 📋 Connect to React Native frontend
4. 📋 Setup Razorpay integration
5. 📋 Setup Firebase OTP verification
6. 📋 Deploy to production (Heroku, AWS, Railway)

---

## 🔗 Integration with Frontend

**React Native Setup:**
```javascript
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Set token
API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Usage
const response = await API.get('/user/profile');
```

---

## 📞 Need Help?

1. Check README.md for full documentation
2. Read code comments in `src/` files
3. Check error logs in console
4. Verify database schema with: `\d` in psql

---

**You're all set! 🚀 Server is running and ready for your React Native app.**
