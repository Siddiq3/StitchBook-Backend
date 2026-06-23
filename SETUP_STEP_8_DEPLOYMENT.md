# 🚀 STEP 8: DEPLOYMENT SETUP

## Overview
Deploy your backend to production on Render or Railway. This step covers everything needed to go live.

---

## 🎯 Goal
- ✅ Choose deployment platform
- ✅ Deploy backend server
- ✅ Setup production database
- ✅ Configure environment variables
- ✅ Setup domain and SSL
- ✅ Monitor application

---

## 🌐 Deployment Architecture

```
Frontend (React Native)
  ↓ API Calls
  ↓ https://api.yourdomain.com
Production Backend (Node.js)
  ↓ Database Queries
PostgreSQL Database (Production)
  ↓ Data Storage
```

---

## 📋 STEP 1: Choose Deployment Platform

### Option A: Render (Recommended for beginners)
- Easy deployment
- Free tier available
- Built-in PostgreSQL option
- Free SSL certificate
- Pay as you grow

### Option B: Railway
- Simple Git integration
- Free tier ($5/month credits)
- PostgreSQL included
- Pay usage model

### Option C: Heroku
- Simplest deployment
- No longer has free tier (paid only)
- Good documentation

**We'll use Render** (free tier available)

---

## 🛠 STEP 2: Prepare Code for Production

### Update package.json

Ensure `package.json` has correct scripts:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### Create .gitignore

Ensure these are NOT committed:

```
node_modules/
.env
.env.local
.env.*.local
.DS_Store
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
dist/
build/
.idea/
.vscode/
*.swp
```

### Create .env.production

Create this file (don't commit - use platform env vars):

```env
# Production Environment
NODE_ENV=production
PORT=5000

# Production Database (will be set on platform)
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT Secret (use strong random key)
JWT_SECRET=your-super-secret-production-key-change-this
JWT_EXPIRY=7d

# Razorpay (Production keys)
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_live_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Firebase
FIREBASE_API_KEY=prod_firebase_key
FIREBASE_PROJECT_ID=prod_project_id

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Logging
LOG_LEVEL=info

# Other
CORS_ORIGIN=https://yourdomain.com
```

---

## 🛠 STEP 3: Deploy on Render

### 3.1 Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up (use GitHub for easier deploy)
3. Connect GitHub account

### 3.2 Create New Service

1. Click "New +"
2. Select "Web Service"
3. Connect to your repository
4. Fill in details:

```
Name: tailor-backend
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 3.3 Set Environment Variables

In Render dashboard → Environment:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=generate_random_key_here
JWT_EXPIRY=7d
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
FIREBASE_API_KEY=xxx
LOG_LEVEL=info
FRONTEND_URL=https://yourdomain.com
```

### 3.4 Create PostgreSQL Database

1. In Render dashboard → "New +"
2. Select "PostgreSQL"
3. Fill in details:

```
Name: tailor-db
PostgreSQL Version: 14
```

4. Copy `DATABASE_URL`
5. Paste in Web Service environment variables

### 3.5 Run Database Migration

On Render shell (via dashboard):

```bash
# SSH into your service
curl -X POST https://api.render.com/v1/services/{service_id}/execute

# Or manually run migration:
psql your_database_url < database.sql
```

---

## 🛠 STEP 4: Deploy on Railway (Alternative)

### 4.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up
3. Connect GitHub

### 4.2 Create Project

1. New Project
2. Deploy from GitHub
3. Select your repository

### 4.3 Configure Services

Add PostgreSQL plugin:
1. Click "Add"
2. Select "PostgreSQL"
3. Railway creates database

### 4.4 Set Variables

In Railway variables:

```
NODE_ENV=production
DATABASE_URL=get_from_postgresql_service
JWT_SECRET=generate_random_key
RAZORPAY_KEY_ID=xxx
RAZORPAY_KEY_SECRET=xxx
...
```

---

## 🔐 STEP 5: Setup Custom Domain

### On Render

1. Go to Settings → Custom Domain
2. Add your domain
3. Update DNS records at your domain provider:

```
CNAME: your-service-name.onrender.com
```

### SSL Certificate

Render provides FREE SSL automatically!

---

## 🛠 STEP 6: Verify Production Deployment

### Test Health Check

```bash
curl https://your-api.onrender.com/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-04-11T04:30:00Z"
}
```

### Test API Endpoints

```bash
# Test login (without Firebase_uid test data)
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "firebase_uid": "test_uid_123"
  }'
```

### Test Database Connection

Connect from local machine:

```bash
psql postgresql://user:password@host:5432/database

# Should connect successfully
```

---

## 🛠 STEP 7: Setup Monitoring & Logging

### Render Logs

View in Render dashboard:
```
Logs → Runtime Log
```

Monitor:
- Application crashes
- Database errors
- API response times

### Email Alerts

Render settings:
1. Go to Team Settings
2. Add notification email
3. Get alerts on deployments/failures

### Application Monitoring (Optional)

Use services like:
- **Datadog** (advanced)
- **New Relic** (advanced)
- **SimpleBackend** (simple)

For now, Render dashboard is sufficient.

---

## 🛠 STEP 8: Setup Razorpay Webhooks

### Update Webhook URL

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Settings → Webhooks
3. Add webhook:

```
URL: https://your-api.onrender.com/api/subscription/webhook
Events: payment.authorize, payment.failed
Secret: your_webhook_secret
```

4. Keep secret in .env: `RAZORPAY_WEBHOOK_SECRET`

---

## 🛠 STEP 9: Update Frontend API URLs

In your React Native app `/services/api.js`:

```javascript
// Production API URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api'
  : 'https://your-api.onrender.com/api';
```

Or use environment variables:

```javascript
import { API_BASE_URL } from '@env';

const api = axios.create({
  baseURL: API_BASE_URL,
});
```

---

## 📋 Production Checklist

```
Before Going Live:
  [ ] Database restored in production
  [ ] All environment variables set
  [ ] SSL certificate active
  [ ] Custom domain configured
  [ ] Health check working
  [ ] API endpoints tested
  [ ] Razorpay production keys configured
  [ ] Webhooks setup
  [ ] Firebase production keys set
  [ ] Logging enabled
  [ ] Monitoring setup
  [ ] Backup strategy defined
  [ ] Error handling verified
  [ ] CORS configured correctly
  [ ] Rate limiting enabled
  [ ] Authentication tested
  [ ] Payment flow tested (test card)

After Going Live:
  [ ] Monitor logs daily
  [ ] Check uptime status
  [ ] Verify backup completion
  [ ] Monitor error rates
  [ ] Check database performance
  [ ] Plan for scaling
  [ ] Update API docs with production URL
  [ ] Inform users of new URL
```

---

## 🆘 Troubleshooting

### Issue: "Cannot connect to database"
```
Solution:
1. Verify DATABASE_URL in environment
2. Check database is running
3. Verify firewall rules
4. Test connection locally first
```

### Issue: "502 Bad Gateway"
```
Solution:
1. Check application logs
2. Verify NODE_ENV is set
3. Check for startup errors
4. Verify PORT matches (usually 5000)
```

### Issue: "Webhook not working"
```
Solution:
1. Verify webhook URL is correct
2. Check backend can receive POST requests
3. Verify webhook secret matches
4. Check logs for webhook errors
```

### Issue: "High response time"
```
Solution:
1. Check database queries (add indexes)
2. Enable caching
3. Use Redis for sessions
4. Consider upgrading plan
```

---

## 🔄 Deployment Workflow

For future deployments:

```bash
# 1. Make code changes locally
git add .
git commit -m "Your changes"

# 2. Test locally
npm run dev

# 3. Push to GitHub
git push origin main

# 4. Render deploys automatically!
# Monitor in dashboard

# 5. If database schema changed:
# - Use Render shell or psql
# - Run migration: psql url < database.sql
```

---

## 💾 Database Backup Strategy

### Render Backups

1. Go to PostgreSQL service
2. Backups tab
3. Automatic backups every 7 days
4. Keep at least 2 backups

### Manual Backup

```bash
# Where SERVICE_HOST contains: host:5432
pg_dump postgresql://user:pass@SERVICE_HOST/dbname > backup.sql

# Restore
psql postgresql://user:pass@SERVICE_HOST/dbname < backup.sql
```

---

## 🔑 Security Best Practices

- ✅ Environment variables NOT in code
- ✅ JWT secrets are strong (30+ chars)
- ✅ SSL/HTTPS for all requests
- ✅ Rate limiting enabled
- ✅ CORS restricted to frontend origin
- ✅ Sensitive data logged only in dev
- ✅ Razorpay keys are production-specific
- ✅ Database backups scheduled
- ✅ Monitor for suspicious activity

---

## 📊 Performance Tips

- Use database indexes on frequently queried columns
- Enable response compression
- Implement caching where applicable
- Monitor API response times
- Consider CDN for static assets
- Use connection pooling
- Optimize database queries

---

## 🎯 Summary

Your backend is now:

1. ✅ Hosted on Render (or Railway)
2. ✅ Running production PostgreSQL database
3. ✅ Using SSL/HTTPS
4. ✅ Connected to Razorpay webhooks
5. ✅ Monitored and backed up
6. ✅ Ready for users!

---

## 📞 Next Steps

1. ✅ Share API URL with frontend team
2. ✅ Update React Native app with production URL
3. ✅ Monitor logs for issues
4. ✅ Plan scaling strategy
5. ✅ Setup team collaboration

---

**✅ STEP 8 COMPLETE!** 🎉🚀

Congratulations! Your backend is now live in production!

---

## 📚 Useful Links

- [Render Docs](https://render.com/docs)
- [Railway Docs](https://docs.railway.app)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Express.js Docs](https://expressjs.com)
- [Node.js Best Practices](https://nodejs.org/en/docs)
- [Security Checklist](https://cheatsheetseries.owasp.org)

---

**ALL 8 STEPS COMPLETED!** ✨

Your Tailor Management SaaS backend is now:
- Developed ✅
- Tested ✅
- Deployed ✅
- Production-ready ✅

Ready to scale! 🚀
