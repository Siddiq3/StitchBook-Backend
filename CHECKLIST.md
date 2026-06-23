# 📋 IMPLEMENTATION CHECKLIST

## Phase 1: Setup (30 minutes)

### Database
- [ ] Backup existing database
- [ ] Run migration: `psql tailor_app < migrations/migration_auth_refactor.sql`
- [ ] Verify new columns: `psql tailor_app` → `\d users`
- [ ] Check indexes exist: `\di users*`

### Configuration
- [ ] Copy .env: `cp .env.example .env`
- [ ] Set DATABASE_URL (Supabase or local)
- [ ] Generate JWT_SECRET: `openssl rand -base64 32`
- [ ] Set JWT_SECRET in .env
- [ ] Generate JWT_REFRESH_SECRET: `openssl rand -base64 32`
- [ ] Set JWT_REFRESH_SECRET in .env
- [ ] Get FIREBASE_SERVICE_ACCOUNT (Firebase Console)
- [ ] Set FIREBASE_SERVICE_ACCOUNT in .env
- [ ] Set FIREBASE_PROJECT_ID in .env
- [ ] Verify all variables in .env

---

## Phase 2: Testing Backend (20 minutes)

### Start Server
- [ ] Run: `npm run dev`
- [ ] Verify: "✓ Server started successfully"
- [ ] Verify: "✓ Firebase Admin SDK initialized" (or "Using test mode")
- [ ] Verify: "✓ Database connected successfully"

### Test Health Check
- [ ] GET http://localhost:5000/health
- [ ] Expected: `{ "status": "OK", ... }`

### Test Login (Dev Mode)
- [ ] POST http://localhost:5000/api/auth/login-test
- [ ] Body: `{ "phone": "9876543210" }`
- [ ] Expected: `{ "success": true, "token": "...", "user": {...} }`
- [ ] Copy token from response

### Test Profile (Protected)
- [ ] GET http://localhost:5000/api/auth/profile
- [ ] Header: `Authorization: Bearer <TOKEN>`
- [ ] Expected: User profile with phone, name, id

### Test Verify Token
- [ ] POST http://localhost:5000/api/auth/verify-token
- [ ] Body: `{ "token": "<TOKEN>" }`
- [ ] Expected: `{ "success": true, "data": { "valid": true, ... } }`

### Test Logout
- [ ] POST http://localhost:5000/api/auth/logout
- [ ] Header: `Authorization: Bearer <TOKEN>`
- [ ] Expected: Success message

---

## Phase 3: Frontend Setup (Ongoing)

### Firebase Configuration
- [ ] Install: `npm install firebase`
- [ ] Create src/firebase.js
- [ ] Initialize Firebase with project config
- [ ] Test: `console.log(auth)` shows Firebase instance

### OTP Screen
- [ ] Create src/screens/LoginScreen.js
- [ ] Implement: Phone input
- [ ] Implement: `signInWithPhoneNumber()` (Firebase)
- [ ] Test: OTP sends to test phone

### OTP Verification
- [ ] Create OTP input screen
- [ ] Implement: `confirmationResult.confirm(otp)`
- [ ] Test: OTP verification works

### Backend Login
- [ ] Get idToken from Firebase
- [ ] Call: POST /api/auth/login
- [ ] Save JWT to AsyncStorage
- [ ] Navigate to Home screen

### API Service
- [ ] Create src/services/api.js
- [ ] Add JWT to all requests (Authorization header)
- [ ] Implement token refresh logic
- [ ] Test: Protected endpoints work

### Protected Routes
- [ ] Add authMiddleware check
- [ ] Test: Can't access without JWT
- [ ] Test: Can access with JWT

### Logout
- [ ] Implement logout button
- [ ] Clear AsyncStorage
- [ ] Navigate to login
- [ ] Test: Token removed, can't access protected routes

---

## Phase 4: Production Preparation (30 minutes)

### Code Review
- [ ] Review firebase.service.js for comments/console.logs
- [ ] Review token.service.js for security
- [ ] Review auth.service.js for error handling
- [ ] Check: No hardcoded secrets
- [ ] Check: No test endpoints exposed

### Security
- [ ] Change JWT_SECRET (new random value)
- [ ] Change JWT_REFRESH_SECRET (new random value)
- [ ] Set NODE_ENV=production
- [ ] Verify HTTPS enabled
- [ ] Configure CORS for production domain
- [ ] Check Firebase credentials are production

### Database
- [ ] Verify production database works
- [ ] Run migrations
- [ ] Backup database
- [ ] Test connection

### Testing
- [ ] Test full login flow (Firebase OTP to Home screen)
- [ ] Test protected endpoints
- [ ] Test token expiry (simulate 30+ days)
- [ ] Test logout
- [ ] Test invalid token handling
- [ ] Test phone normalization (different formats)

---

## Phase 5: Deployment (15 minutes)

### Backend Deployment
- [ ] Push code to git
- [ ] Deploy to hosting (Vercel, Railway, Heroku, AWS)
- [ ] Set environment variables on hosting platform
- [ ] Verify: Server starts with "✓ Database connected"
- [ ] Test: Health check endpoint works

### Database
- [ ] Run migration on production database
- [ ] Verify: New columns exist
- [ ] Backup: Create backup after migration
- [ ] Verify: Indexes created

### Frontend Deployment
- [ ] Update API_URL to production backend
- [ ] Update Firebase config to production project
- [ ] Build and deploy
- [ ] Test: Can login with production Firebase OTP

### Verification
- [ ] Test: Full login flow works
- [ ] Test: Can access protected endpoints
- [ ] Test: Token expiry works correctly
- [ ] Test: Logout works
- [ ] Monitor: Check logs for errors

---

## Phase 6: Post-Deployment (Ongoing)

### Monitoring
- [ ] Check error logs daily for first week
- [ ] Monitor login success/failure rates
- [ ] Check database for new users
- [ ] Verify token generation working
- [ ] Monitor API response times

### User Support
- [ ] Document login instructions for users
- [ ] Test with real users (beta group)
- [ ] Gather feedback
- [ ] Fix issues found

### Security
- [ ] Review access logs for suspicious activity
- [ ] Check rate limiting is working
- [ ] Verify no token leaks
- [ ] Monitor for brute force attempts

### Performance
- [ ] Check API response times
- [ ] Monitor database query performance
- [ ] Check for slow queries in logs
- [ ] Optimize if needed

---

## Documentation Checklist

- [ ] Read: AUTH_QUICK_REFERENCE.md (5 min)
- [ ] Read: AUTH_SYSTEM_DOCUMENTATION.md (30 min)
- [ ] Read: IMPLEMENTATION_GUIDE.md (20 min)
- [ ] Reference: Keep these files for team

---

## Troubleshooting Checklist

If something breaks:

### Backend Won't Start
- [ ] Check .env variables (npm run dev shows which ones)
- [ ] Verify DATABASE_URL (test with psql)
- [ ] Check if port 5000 is available
- [ ] Review error message carefully

### Firebase Token Error
- [ ] Check FIREBASE_SERVICE_ACCOUNT in .env
- [ ] Verify Firebase Admin SDK initialized (check logs)
- [ ] Ensure OTP completed on frontend
- [ ] Test with: POST /api/auth/login-test

### Database Errors
- [ ] Verify DATABASE_URL is correct
- [ ] Test connection: psql $DATABASE_URL
- [ ] Check if columns exist: SELECT * FROM users
- [ ] Run migration if needed

### Token Validation Fails
- [ ] Check JWT_SECRET is correct
- [ ] Verify token format (Bearer <TOKEN>)
- [ ] Test endpoint: POST /api/auth/verify-token
- [ ] Check token expiry

### Protected Routes Return 401
- [ ] Add Authorization header
- [ ] Format: "Bearer <JWT_TOKEN>"
- [ ] Verify middleware is on route
- [ ] Test with Postman

---

## Success Criteria

✅ Backend Implementation:
- [ ] firebase.service.js works (verifies Firebase tokens)
- [ ] token.service.js works (generates/verifies JWT)
- [ ] auth.service.js works (user lookup/creation)
- [ ] Auth endpoints respond correctly
- [ ] Phone normalization works
- [ ] Database schema updated

✅ Frontend Integration:
- [ ] Firebase OTP flow complete
- [ ] Backend login works
- [ ] JWT stored in AsyncStorage
- [ ] Protected endpoints work
- [ ] Logout works

✅ Security:
- [ ] Secrets in .env, not in code
- [ ] Firebase tokens verified
- [ ] JWTs properly signed
- [ ] Phone validated on backend
- [ ] Rate limiting working

✅ Production Ready:
- [ ] Database migrated
- [ ] Environment configured
- [ ] Error handling complete
- [ ] Logging working
- [ ] Tested end-to-end

---

## Final Sign-Off

When you check all boxes above:

✅ **System is production-ready**

Deploy with confidence! 🚀

---

## Questions?

Refer to:
1. **AUTH_QUICK_REFERENCE.md** - Quick answers
2. **AUTH_SYSTEM_DOCUMENTATION.md** - Complete guide
3. **IMPLEMENTATION_GUIDE.md** - Step-by-step + troubleshooting
4. **Source code comments** - Inline documentation

Good luck! 🎉
