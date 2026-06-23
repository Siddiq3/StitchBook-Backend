# 🧪 STEP 4: API TESTING WITH POSTMAN COLLECTION

## Overview
Test all backend APIs using Postman. This step verifies that your backend is working correctly before connecting the frontend.

---

## 🎯 Goal
- ✅ Import Postman collection
- ✅ Set up variables (base_url, jwt_token)
- ✅ Test authentication endpoint
- ✅ Test all major API endpoints
- ✅ Verify backend is working

---

## 📱 What is Postman?

**Postman** is a tool for testing APIs:
```
Postman = API Testing Tool
- Send HTTP requests
- View responses
- Save request collections
- Test workflows
```

**Download Postman:**
```
Website: https://www.postman.com/downloads/
Choose your OS (Windows, Mac, Linux)
Install and create free account
```

---

## 🚀 STEP 1: Import Postman Collection

### Option A: Import JSON File (Recommended)

1. **Open Postman**
2. Click **"Import"** button (top-left)
3. Click **"Upload Files"**
4. Select: `tailor-api-postman.json`
5. Click **"Import"**

### Option B: Import from Code

1. **Open Postman**
2. Click **"Import"** button
3. Click **"Raw text"** tab
4. Copy content from `tailor-api-postman.json`
5. Paste into text area
6. Click **"Continue"** → **"Import"**

### Expected Result

You should see a collection named **"Tailor Management Backend API"** with folders:
- ✅ Authentication
- ✅ User Management
- ✅ Shop Management
- ✅ Customer Management
- ✅ Measurements
- ✅ Orders
- ✅ Subscriptions
- ✅ Health Check

---

## 🔧 STEP 2: Configure Variables

Postman uses **variables** to dynamically fill values in requests.

### Set Base URL

1. Click on the collection name
2. Go to **"Variables"** tab
3. Find **"base_url"** variable
4. Set **Current value**: `http://localhost:5000/api`
5. Click **Save**

```
Variable: base_url
Value: http://localhost:5000/api
```

### Set JWT Token (After Login)

1. Same **Variables** tab
2. Find **"jwt_token"** variable
3. Leave empty for now (we'll get it from login)
4. After login, copy token and paste here

```
Variable: jwt_token
Value: (empty initially, fill after login)
```

---

## ✅ STEP 3: Test Server Health

Before testing APIs, verify server is running:

### Test 1: Health Check Endpoint
```
1. Click "Health Check" folder
2. Click "Server Health" request
3. Click "Send" button
4. Should see: "status": "OK"
```

**Expected Response (200 OK):**
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2026-04-11T10:30:45.123Z"
}
```

If this fails:
- [ ] Is backend running? (`npm run dev`)
- [ ] Is database connected?
- [ ] Check .env file

---

## 🔑 STEP 4: Test Authentication

### Test: Login & Get JWT Token

1. Go to **Authentication** folder
2. Click **"1. Login / Register User"**
3. Click **"Send"** button

**Request:**
```json
{
  "phone": "9876543210",
  "firebase_uid": "firebase_uid_demo_123"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "created_at": "2026-04-11T10:30:45.123Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Extract JWT Token

1. Copy the long `token` value from response
2. Go to Collection **Variables** tab
3. Paste token in **jwt_token** variable
4. Click **Save**

Now all requests can use this token!

---

## 🧪 STEP 5: Test All Endpoints

### Testing Checklist

Follow this order to test complete workflow:

#### 1. **User Management**
```
✅ Get User Profile
   - Click: User Management > Get User Profile
   - Send
   - Should return user info

✅ Update User Profile
   - Click: User Management > Update User Profile
   - Send
   - Should update successfully
```

#### 2. **Shop Management**
```
✅ Create Shop
   - Click: Shop Management > Create Shop
   - Edit phone/name if needed
   - Send
   - Note the returned shop_id

✅ Get My Shop
   - Click: Shop Management > Get My Shop
   - Send
   - Should return shop details

✅ Update Shop
   - Change shop_id in URL if needed
   - Send
   - Should update successfully
```

#### 3. **Customer Management**
```
✅ Add Customer
   - Click: Customer Management > Add Customer
   - Update shop_id if needed
   - Send
   - Note the returned customer_id

✅ Get All Customers
   - Update shop_id in URL
   - Send
   - Should list all customers

✅ Search Customers
   - Update shop_id in URL
   - Change query 'q' parameter
   - Send
   - Should find matching customers

✅ Update Customer
   - Update customer_id in URL
   - Send
   - Should update successfully
```

#### 4. **Measurements**
```
✅ Add Measurement
   - Click: Measurements > Add Measurement
   - Update customer_id
   - Send
   - Note the returned measurement_id

✅ Get Latest Measurement
   - Update customer_id in URL
   - Send
   - Should return latest measurement

✅ Get All Measurements
   - Update customer_id in URL
   - Send
   - Should return all measurements
```

#### 5. **Orders**
```
✅ Create Order
   - Click: Orders > Create Order
   - Update customer_id and shop_id
   - Send
   - Note the returned order_id

✅ Get Order Details
   - Update order_id in URL
   - Send
   - Should return order info

✅ Get Shop Orders
   - Update shop_id in URL
   - Optional: add ?status=pending
   - Send
   - Should list orders

✅ Update Order Status
   - Update order_id in URL
   - Change status to: "stitching"
   - Send
   - Should update successfully

✅ Get Order Stats
   - Update shop_id in URL
   - Send
   - Should return stats
```

#### 6. **Subscriptions**
```
✅ Get Subscription Status
   - Click: Subscriptions > Get Subscription Status
   - Send
   - Should return subscription (or free if not subscribed)

✅ Create Subscription
   - Click: Subscriptions > Create Subscription
   - Send
   - Should create subscription

✅ Check if Active
   - Click: Subscriptions > Check if Active
   - Send
   - Should return is_active: true/false
```

---

## 📊 Creating New Requests

If you need to create new test requests:

### Steps:

1. Click on a folder in collection
2. Click **"Add request"**
3. Name the request
4. Set method (GET, POST, PUT, DELETE)
5. Set URL: `{{base_url}}/your/endpoint`
6. Add body if needed (for POST/PUT):
   ```
   Click "Body" tab
   Select "raw" and "JSON"
   Paste JSON data
   ```
7. Add headers:
   ```
   For protected routes add:
   Authorization: Bearer {{jwt_token}}
   ```
8. Click **"Send"**
9. View response

---

## 🔍 Understanding Response Codes

### Success Responses

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Success, no response body |

### Error Responses

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body format |
| 401 | Unauthorized | Add JWT token in Authorization header |
| 404 | Not Found | Check resource ID exists |
| 409 | Conflict | Resource already exists (e.g., shop exists) |
| 500 | Server Error | Check backend logs |

---

## 💡 Common Issues & Solutions

### Issue 1: "Authorization header missing"
```
Solution:
1. Make sure jwt_token variable is set
2. Login first to get token
3. Add: Authorization: Bearer {{jwt_token}}
```

### Issue 2: "Customer not found"
```
Solution:
1. Create customer first
2. Use correct customer_id
3. Check shop_id is correct
```

### Issue 3: "Shop not found"
```
Solution:
1. Create shop first
2. Use correct shop_id
3. Verify user owns the shop
```

### Issue 4: "Request body invalid"
```
Solution:
1. Check JSON format (valid brackets)
2. Verify all required fields
3. Check field names match exactly
```

---

## 📝 Sample Workflow

Here's a complete workflow from start to finish:

### 1. Login
```
POST /auth/login
Body: {
  "phone": "9876543210",
  "firebase_uid": "firebase_demo_123"
}
Response: Get jwt_token
```

### 2. Create Shop
```
POST /shop/create
Headers: Authorization: Bearer {jwt_token}
Body: {
  "name": "My Tailor",
  "location": "Mumbai",
  "phone": "9876543210"
}
Response: Get shop_id
```

### 3. Add Customer
```
POST /customer/add
Headers: Authorization: Bearer {jwt_token}
Body: {
  "shop_id": 1,
  "name": "John",
  "phone": "9123456789"
}
Response: Get customer_id
```

### 4. Add Measurement
```
POST /measurement/add
Headers: Authorization: Bearer {jwt_token}
Body: {
  "customer_id": 1,
  "measurements_data": {"chest": "42", "waist": "36"}
}
```

### 5. Create Order
```
POST /order/create
Headers: Authorization: Bearer {jwt_token}
Body: {
  "customer_id": 1,
  "shop_id": 1,
  "description": "Shirt",
  "price": 500,
  "delivery_date": "2026-04-25"
}
```

---

## 📚 API Summary Table

| Endpoint | Method | Auth? | Purpose |
|----------|--------|-------|---------|
| `/auth/login` | POST | ❌ | Login/Register |
| `/user/profile` | GET | ✅ | Get user info |
| `/shop/create` | POST | ✅ | Create shop |
| `/shop` | GET | ✅ | Get my shop |
| `/customer/add` | POST | ✅ | Add customer |
| `/customer/shop/:id` | GET | ✅ | List customers |
| `/order/create` | POST | ✅ | Create order |
| `/order/shop/:id` | GET | ✅ | List orders |
| `/measurement/add` | POST | ✅ | Add measurement |
| `/subscription/status` | GET | ✅ | Check subscription |

---

## ✅ Verification Checklist

After testing, verify:

- [ ] Health check works
- [ ] Login returns JWT token
- [ ] Can create shop
- [ ] Can add customer
- [ ] Can create order
- [ ] Can add measurement
- [ ] Can check subscription status
- [ ] All endpoints return proper responses
- [ ] No 500 errors in responses

---

## 🎓 Learning Resources

### Postman Documentation
- https://learning.postman.com/docs/getting-started/overview/

### API Basics
- https://www.postman.com/resources/postman-rest-level-1-certification/

### REST API Best Practices
- https://restfulapi.net/

---

## 📞 Next Steps

Once all APIs are tested:

1. **Verify** all endpoints work correctly
2. **Note** any errors and fix in backend
3. **Proceed to STEP 5**: Connect React Native frontend

---

## 📁 Files Reference

```
tailor-api-postman.json    ← Import this into Postman
SETUP_STEP_4_POSTMAN.md    ← This file
```

---

**✅ STEP 4 COMPLETE!** 🎉

All APIs tested and working! Proceed to **STEP 5: Connect React Native Frontend**
