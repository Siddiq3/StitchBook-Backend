# 📊 STEP 1: DATABASE SETUP (Supabase PostgreSQL)

## Overview
This step sets up your PostgreSQL database with all required tables and relationships. Choose either **Local PostgreSQL** or **Supabase** (cloud).

---

## 🎯 Goal
- ✅ Create PostgreSQL database
- ✅ Create all 6 tables with proper relationships
- ✅ Setup indexes for performance
- ✅ Verify database schema

---

## 📋 Database Schema (6 Tables)

```
users (Profile info + Firebase auth)
  ↓ (1-to-1)
shops (Tailor shop details)
  ↓ (1-to-many)
customers (Customer records)
  ├─→ measurements (Flexible measurement data)
  └─→ orders (Tailoring jobs)

subscriptions (Linked to users - for Razorpay payments)
```

---

## 🚀 OPTION A: Supabase (Recommended for Beginners)

### What is Supabase?
- Cloud-hosted PostgreSQL database
- Free tier included
- No installation needed
- Easy to use dashboard

### Step-by-Step Setup

#### 1. Create Supabase Account
```
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with email (or GitHub)
4. Verify email
```

#### 2. Create New Project
```
1. Click "New Project"
2. Enter project name: "tailor-app"
3. Enter password (save this securely!)
4. Choose region closest to you (e.g., Asia-Mumbai)
5. Wait for database to be created (2-3 minutes)
```

#### 3. Access SQL Editor
```
1. Open your project
2. Go to "SQL Editor" (left sidebar)
3. Click "New Query"
```

#### 4. Create Database Schema
```
1. Copy all SQL from: database.sql
2. Paste into SQL Editor
3. Click "Run" button
4. Wait for success message
```

#### 5. Get Connection String
```
1. Go to Settings (left sidebar)
2. Click "Database"
3. Find "Connection String"
4. Copy the PostgreSQL connection string
5. It looks like: postgresql://user:password@host:5432/dbname
```

#### 6. Save Connection String
```
Add to your .env file:
DATABASE_URL=postgresql://user:password@host:5432/postgres

Replace:
- user: Your database user (usually: postgres)
- password: Your database password
- host: Your database host (from connection string)
```

### Verify Setup
In Supabase SQL Editor, run:
```sql
-- View all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public';

-- View all indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname='public';
```

Expected output should show 6 tables:
- users
- shops
- customers
- measurements
- orders
- subscriptions

---

## 🛠 OPTION B: Local PostgreSQL (Advanced)

### Prerequisites
- macOS: `brew install postgresql`
- Linux: `apt-get install postgresql`
- Windows: Download from https://www.postgresql.org/download/

### Setup Steps

#### 1. Start PostgreSQL Service

**macOS:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo service postgresql start
```

**Windows:**
PostgreSQL service starts automatically

#### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE tailor_app;

# Exit psql
\q
```

#### 3. Run Database Schema
```bash
# Navigate to your project folder
cd /path/to/tailor-backend

# Run SQL schema
psql -U postgres -d tailor_app -f database.sql
```

Expected output:
```
CREATE TYPE
CREATE TYPE
CREATE TABLE
CREATE TABLE
CREATE TABLE
...
CREATE INDEX
```

#### 4. Verify Setup
```bash
psql -U postgres -d tailor_app

# List all tables
\dt

# List all indexes
\di

# Exit
\q
```

#### 5. Get Connection String
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/tailor_app

Replace "password" with your PostgreSQL password
```

---

## 🔍 Verification Checklist

After setup, verify everything is correct:

### ✅ Check 1: All Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' 
ORDER BY table_name;
```

Expected tables (6):
- customers
- measurements
- orders
- shops
- subscriptions
- users

### ✅ Check 2: Foreign Keys Setup
```sql
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_schema='public';
```

Should show relationships like:
- shops → users
- customers → shops
- orders → shops & customers
- measurements → customers
- subscriptions → users

### ✅ Check 3: Indexes Created
```sql
SELECT indexname FROM pg_indexes 
WHERE schemaname='public' 
ORDER BY indexname;
```

Should show 9 indexes:
- idx_customers_phone
- idx_customers_shop_id
- idx_measurements_customer_id
- idx_orders_customer_id
- idx_orders_shop_id
- idx_orders_status
- idx_shops_user_id
- idx_subscriptions_razorpay_id
- idx_subscriptions_user_id

### ✅ Check 4: ENUM Types Created
```sql
SELECT typname FROM pg_type 
WHERE typtype='e' 
ORDER BY typname;
```

Should show:
- order_status
- subscription_status

---

## 📝 Sample Data (Optional Testing)

To test your database with sample data:

```sql
-- 1. Create test user
INSERT INTO users (phone, firebase_uid) 
VALUES ('9876543210', 'firebase_demo_123');

-- 2. Create test shop
INSERT INTO shops (user_id, name, location, phone) 
VALUES (1, 'Fashion Tailor Studio', 'Mumbai', '9876543210');

-- 3. Create test customer
INSERT INTO customers (shop_id, name, phone, notes) 
VALUES (1, 'John Doe', '9123456789', 'Regular customer');

-- 4. Create test measurement
INSERT INTO measurements (customer_id, measurements_data) 
VALUES (1, '{"chest": "42", "waist": "36", "shoulder": "18"}');

-- 5. Create test order
INSERT INTO orders (customer_id, shop_id, description, price, status, delivery_date) 
VALUES (1, 1, 'Shirt stitching', 500, 'pending', '2026-04-25');

-- 6. Create test subscription
INSERT INTO subscriptions (user_id, plan, status, expiry_date) 
VALUES (1, 'premium', 'active', '2026-12-31');

-- Verify data
SELECT * FROM users;
SELECT * FROM shops;
SELECT * FROM customers;
SELECT * FROM measurements;
SELECT * FROM orders;
SELECT * FROM subscriptions;
```

---

## 🆘 Troubleshooting

### Issue: "Database already exists"
```
Solution: 
Option 1: Delete existing database and recreate
Option 2: Use different database name
```

### Issue: "Connection refused"
```
Solution (Local PostgreSQL):
1. Check if PostgreSQL is running
2. Verify connection string in .env
3. Test connection: psql -U postgres
```

### Issue: "Permission denied"
```
Solution:
1. Check database user permissions
2. Make sure you're using correct username/password
3. Verify port (usually 5432)
```

### Issue: "Table already exists"
```
Solution:
1. Drop existing database: DROP DATABASE tailor_app;
2. Recreate and run schema again
```

---

## 📚 Understanding the Schema

### users Table
```
Stores basic user info
- id: Auto-generated ID
- phone: Unique phone for login
- firebase_uid: Firebase authentication token
- timestamps: Auto-updated
```

### shops Table
```
One shop per user (1:1 relationship)
- id: Shop ID
- user_id: Links to users (UNIQUE - one shop per user)
- name: Shop name
- location: Shop address
- phone: Shop phone
```

### customers Table
```
Many customers per shop
- id: Customer ID
- shop_id: Links to shops
- name: Customer name
- phone: Customer phone
- notes: Custom notes
```

### measurements Table
```
Many measurements per customer (history)
- id: Measurement ID
- customer_id: Links to customers
- measurements_data: JSON object with flexible fields
  Example: {"chest": "42", "waist": "36"}
```

### orders Table
```
Many orders per customer
- id: Order ID
- customer_id: Links to customers
- shop_id: Links to shops
- description: What to stitch
- price: Order price
- status: pending/stitching/completed
- delivery_date: Expected completion date
```

### subscriptions Table
```
Subscription/payment tracking
- id: Subscription ID
- user_id: Links to users
- plan: Plan name (basic, premium, etc.)
- razorpay_subscription_id: Razorpay payment ID
- status: active/inactive/expired
- expiry_date: Subscription expiry date
```

---

## ✅ Next Steps

Once database is setup:

1. **Save CONNECTION STRING** in safe place
2. **Verify data** using sample queries above
3. **Proceed to STEP 2**: Configure .env file
4. Test connection from Node.js backend

---

## 📞 Quick Reference

| Platform | Free Tier | Setup Time | Best For |
|----------|-----------|-----------|----------|
| **Supabase** | 500MB + | 5 minutes | Beginners (Recommended) |
| **Local PG** | Unlimited | 10 minutes | Development |
| **AWS RDS** | 12 months | 15 minutes | Production |
| **Railway** | $5/month | 5 minutes | Easy Deployment |

---

**✅ STEP 1 COMPLETE!** 🎉

Database is now ready. Proceed to **STEP 2: Configure .env file**
