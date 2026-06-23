# Tailor Management SaaS Backend

Complete backend for a Tailor Management Application (similar to Darzee) built with Node.js, Express, PostgreSQL, and JWT authentication.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Best Practices](#best-practices)

## ✨ Features

### Core Features
- **OTP-based Authentication** - Firebase integration ready
- **User & Shop Management** - One shop per user
- **Customer Management** - Add, update, delete, list customers
- **Dynamic Measurements** - Store custom measurement fields as JSON
- **Order Management** - Create, track, and update orders
- **Subscription System** - Razorpay integration ready
- **JWT Token Protection** - Secure API endpoints
- **Rate Limiting** - Protect API from abuse
- **Error Handling** - Comprehensive error management
- **Logging** - Simple logging system with timestamps

### Technical Features
- **MVC Architecture** - Clean separation of concerns
- **RESTful API** - Standard REST endpoints
- **Async/Await** - Modern async patterns
- **Connection Pooling** - Efficient database connections
- **CORS Enabled** - Frontend integration ready
- **Environment Variables** - Secure configuration

## 🛠 Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database (Supabase compatible)
- **JWT** - Authentication
- **BCrypt** - Password hashing
- **Dotenv** - Environment variables
- **Express Rate Limit** - Rate limiting
- **CORS** - Cross-origin resource sharing

## 📁 Project Structure

```
tailor-backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Database connection
│   │   └── jwt.js               # JWT utilities
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── shop.controller.js
│   │   ├── customer.controller.js
│   │   ├── measurement.controller.js
│   │   ├── order.controller.js
│   │   └── subscription.controller.js
│   ├── models/
│   │   ├── user.model.js
│   │   ├── shop.model.js
│   │   ├── customer.model.js
│   │   ├── measurement.model.js
│   │   ├── order.model.js
│   │   └── subscription.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── shop.routes.js
│   │   ├── customer.routes.js
│   │   ├── measurement.routes.js
│   │   ├── order.routes.js
│   │   └── subscription.routes.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── shop.service.js
│   │   ├── customer.service.js
│   │   ├── measurement.service.js
│   │   ├── order.service.js
│   │   └── subscription.service.js
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   └── error.js             # Error handling
│   ├── utils/
│   │   ├── logger.js            # Logging utility
│   │   └── responder.js         # Response formatter
│   ├── app.js                   # Express configuration
│   └── server.js                # Server entry point
├── package.json
├── .env.example
├── database.sql                 # PostgreSQL schema
└── README.md
```

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (local or Supabase)
- npm or yarn package manager

### 2. Installation Steps

#### Clone or create the project
```bash
cd tailor-backend
```

#### Install dependencies
```bash
npm install
```

#### Create environment file
```bash
cp .env.example .env
```

#### Configure .env file
```
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tailor_app
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRY=7d

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_API_KEY=your_firebase_api_key

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

#### Setup PostgreSQL Database

1. **Using psql:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE tailor_app;

# Connect to database
\c tailor_app

# Run schema (copy content from database.sql)
# Or use: psql -U postgres -d tailor_app -f database.sql
```

2. **Using Supabase:**
   - Create new project
   - Go to SQL Editor
   - Run queries from `database.sql`

#### Start the server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

**Health check:**
```bash
curl http://localhost:5000/health
```

## 🔐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development|production |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | tailor_app |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | your_password |
| `JWT_SECRET` | JWT signing key | your_secret_key |
| `JWT_EXPIRY` | Token expiry time | 7d |
| `FIREBASE_PROJECT_ID` | Firebase project ID | your_project_id |
| `FIREBASE_API_KEY` | Firebase API key | your_api_key |
| `RAZORPAY_KEY_ID` | Razorpay key ID | your_key_id |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | your_secret |

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Header
```
Authorization: Bearer {JWT_TOKEN}
```

### Response Format
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Error details"
}
```

---

## 🔑 Auth Endpoints

### POST `/auth/login`
Login with phone and Firebase UID (after OTP verification)

**Request:**
```json
{
  "phone": "9876543210",
  "firebase_uid": "firebase_uid_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "created_at": "2024-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST `/auth/verify-token`
Verify if a token is valid

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 👤 User Endpoints

### GET `/user/profile`
Get current user profile (requires auth)

**Response:**
```json
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "id": 1,
    "phone": "9876543210",
    "firebase_uid": "firebase_uid_123",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### PUT `/user/profile`
Update user profile (requires auth)

---

## 🏪 Shop Endpoints

### POST `/shop/create`
Create a new shop (requires auth)

**Request:**
```json
{
  "name": "My Tailor Shop",
  "location": "Mumbai, India",
  "phone": "9876543210"
}
```

### GET `/shop`
Get shop for authenticated user (requires auth)

### GET `/shop/:shopId`
Get shop by ID (requires auth)

### PUT `/shop/:shopId`
Update shop (requires auth)

### DELETE `/shop/:shopId`
Delete shop (requires auth)

---

## 👥 Customer Endpoints

### POST `/customer/add`
Add a new customer (requires auth)

**Request:**
```json
{
  "shop_id": 1,
  "name": "John Doe",
  "phone": "9123456789",
  "notes": "Prefers cotton fabrics"
}
```

### GET `/customer/:customerId`
Get customer by ID (requires auth)

### GET `/customer/shop/:shopId?page=1&limit=20`
Get all customers for a shop (requires auth)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)

### GET `/customer/search/:shopId?q=John`
Search customers (requires auth)

### PUT `/customer/:customerId`
Update customer (requires auth)

### DELETE `/customer/:customerId`
Delete customer (requires auth)

---

## 📏 Measurement Endpoints

### POST `/measurement/add`
Create a new measurement (requires auth)

**Request:**
```json
{
  "customer_id": 1,
  "measurements_data": {
    "chest": "42 inches",
    "waist": "36 inches",
    "length": "28 inches",
    "shoulder": "18 inches"
  }
}
```

### GET `/measurement/latest/:customerId`
Get latest measurement for customer (requires auth)

### GET `/measurement/:customerId`
Get all measurements for customer (requires auth)

### GET `/measurement/record/:measurementId`
Get measurement by ID (requires auth)

### PUT `/measurement/:measurementId`
Update measurement (requires auth)

### DELETE `/measurement/:measurementId`
Delete measurement (requires auth)

---

## 📦 Order Endpoints

### POST `/order/create`
Create a new order (requires auth)

**Request:**
```json
{
  "customer_id": 1,
  "shop_id": 1,
  "description": "Shirt stitching",
  "price": 500,
  "delivery_date": "2024-02-15"
}
```

### GET `/order/:orderId`
Get order by ID (requires auth)

### GET `/order/shop/:shopId?status=pending&page=1&limit=20`
Get orders for shop (requires auth)

**Query Parameters:**
- `status` - Filter by status (pending, stitching, completed)
- `page` - Page number
- `limit` - Records per page

### GET `/order/customer/:customerId`
Get orders for customer (requires auth)

### PUT `/order/:orderId`
Update order (requires auth)

**Request:**
```json
{
  "status": "stitching",
  "delivery_date": "2024-02-20"
}
```

### DELETE `/order/:orderId`
Delete order (requires auth)

### GET `/order/stats/:shopId`
Get order statistics (requires auth)

**Response:**
```json
{
  "success": true,
  "message": "Statistics retrieved",
  "data": {
    "pending": 5,
    "stitching": 3,
    "completed": 12,
    "total": 20
  }
}
```

---

## 💳 Subscription Endpoints

### POST `/subscription/create`
Create subscription (requires auth, after Razorpay payment)

**Request:**
```json
{
  "plan": "premium",
  "razorpay_subscription_id": "sub_123456",
  "status": "active",
  "expiry_date": "2024-12-31"
}
```

### GET `/subscription/status`
Get subscription status (requires auth)

### POST `/subscription/verify`
Verify subscription after Razorpay payment

**Request:**
```json
{
  "razorpay_subscription_id": "sub_123456",
  "plan": "premium",
  "status": "active",
  "expiry_date": "2024-12-31"
}
```

### POST `/subscription/check-active`
Check if user has active subscription (requires auth)

### PUT `/subscription/:subscriptionId/status`
Update subscription status (requires auth)

### DELETE `/subscription/:subscriptionId`
Cancel subscription (requires auth)

---

## 🗄 Database Schema

### Users Table
```sql
id (Primary Key)
phone (Unique, Required)
firebase_uid (Unique, Required)
created_at
updated_at
```

### Shops Table
```sql
id (Primary Key)
user_id (Foreign Key, Unique)
name (Required)
location
phone (Required)
created_at
updated_at
```

### Customers Table
```sql
id (Primary Key)
shop_id (Foreign Key)
name (Required)
phone (Required)
notes
created_at
updated_at
```

### Measurements Table
```sql
id (Primary Key)
customer_id (Foreign Key)
measurements_data (JSON)
created_at
updated_at
```

### Orders Table
```sql
id (Primary Key)
customer_id (Foreign Key)
shop_id (Foreign Key)
description (Required)
price (Decimal)
status (Enum: pending, stitching, completed)
delivery_date
created_at
updated_at
```

### Subscriptions Table
```sql
id (Primary Key)
user_id (Foreign Key)
plan (Required)
razorpay_subscription_id (Unique)
status (Enum: active, inactive, expired)
expiry_date
created_at
updated_at
```

---

## 🏆 Best Practices Implemented

✅ **MVC Architecture** - Clean separation of concerns
✅ **Async/Await** - Modern JavaScript patterns
✅ **Error Handling** - Comprehensive try-catch blocks
✅ **Input Validation** - Request validation at controller level
✅ **Security** - JWT tokens, parameterized queries
✅ **Database Pooling** - Efficient connection management
✅ **Logging** - Timestamped logging for debugging
✅ **Rate Limiting** - API protection
✅ **CORS** - Cross-origin support
✅ **Environment Variables** - Secure configuration
✅ **Modular Code** - Reusable services and middleware
✅ **API Documentation** - Well-documented endpoints

---

## 🔒 Security Notes

1. **Never commit `.env` file** - It contains sensitive data
2. **Use strong JWT_SECRET** - Change the default value in production
3. **Use HTTPS in production** - Always use SSL/TLS
4. **Validate all inputs** - Check request data
5. **Use environment variables** - Never hardcode secrets
6. **Rate limiting** - Protect APIs from abuse
7. **Database user permissions** - Use least privilege principle

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running and credentials in `.env` are correct

### JWT Token Error
```
Error: Token verification failed
```
**Solution:** Check if token is expired or JWT_SECRET is changed

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Add your frontend URL to CORS origins in `src/app.js`

---

## 📝 Sample Usage

### Getting Started

1. **Login User**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "firebase_uid": "firebase_uid_123"
  }'
```

2. **Create Shop**
```bash
curl -X POST http://localhost:5000/api/shop/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Tailor",
    "location": "Mumbai",
    "phone": "9876543210"
  }'
```

3. **Add Customer**
```bash
curl -X POST http://localhost:5000/api/customer/add \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": 1,
    "name": "John Doe",
    "phone": "9123456789",
    "notes": "Regular customer"
  }'
```

---

## 📞 Support

For issues or questions, please refer to this README or check the code comments for detailed explanations.

---

## 📄 License

This project is provided as-is for educational and commercial purposes.

---

**Happy Coding! 🚀**
