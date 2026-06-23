# OpenAPI v2.0.0 - Quick Reference & Test Examples

**Last Updated:** April 29, 2026

---

## 📌 Quick Reference - All Endpoints by Category

### 🔐 Authentication (4 public + 2 protected)
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | /auth/login | ❌ No | Firebase OTP login |
| POST | /auth/login-test | ❌ No | Development test login |
| POST | /auth/verify-token | ❌ No | Verify token validity |
| POST | /auth/refresh-token | ❌ No | Refresh access token |
| GET | /auth/profile | ✅ Yes | Get user profile |
| PUT | /auth/profile | ✅ Yes | Update user profile |

### 🏪 Shop Management (4 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /shop | Create shop |
| GET | /shop | Get user's shop |
| PUT | /shop | Update shop |
| DELETE | /shop | Delete shop |

### 👥 Customer Management (6 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /customer | Create customer |
| GET | /customer | List customers (paginated, searchable) |
| GET | /customer/{id} | Get customer details |
| PUT | /customer/{id} | Update customer |
| DELETE | /customer/{id} | Delete customer |
| GET | /customer/search | Search customers |

### 📦 Order Management (8 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /order | Create order (NEW UNIFIED FORMAT) |
| GET | /order | List all orders |
| GET | /order/{id} | Get order details |
| PUT | /order/{id} | Update order |
| DELETE | /order/{id} | Delete order |
| PUT | /order/{id}/status | Update order status (workflow) |
| GET | /order/status/{status} | Filter by status |
| GET | /order/customer/{customerId} | Get orders for customer |

### 📏 Measurement Management (6 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /measurement | Create measurement (JSONB) |
| GET | /measurement/customer/{customerId} | Get customer measurements |
| GET | /measurement/{id} | Get single measurement |
| PUT | /measurement/{id} | Update measurement |
| DELETE | /measurement/{id} | Delete measurement |
| GET | /measurement/latest/{customerId} | Get latest measurement |

### 💰 Payment Management (3 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /payment | Record payment |
| GET | /payment/order/{orderId} | Get payments for order |
| DELETE | /payment/{id} | Delete payment |

### 📝 Activity & Audit (2 endpoints)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /activity/order/{orderId} | Get activity log |
| POST | /activity/order/{orderId} | Add activity note |

### 📊 Dashboard & Analytics (1 endpoint)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /dashboard/stats | Get analytics (today/week/month/year) |

### 🎨 Portfolio (4 endpoints)
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | /portfolio | ✅ Yes | Create portfolio item |
| GET | /portfolio | ✅ Yes | Get user's portfolio |
| GET | /portfolio/public/{shopId} | ❌ No | Get public portfolio |
| DELETE | /portfolio/{id} | ✅ Yes | Delete portfolio item |

### 📤 File Upload (1 endpoint)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /upload | Upload image (multipart/form-data) |

### 💳 Subscription (6 endpoints)
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | /subscription/verify | ❌ No | Verify subscription status |
| POST | /subscription/create | ✅ Yes | Create subscription |
| GET | /subscription/status | ✅ Yes | Get subscription status |
| POST | /subscription/check-active | ✅ Yes | Check if subscription active |
| PUT | /subscription/{id}/status | ✅ Yes | Update subscription status |
| DELETE | /subscription/{id} | ✅ Yes | Cancel subscription |

**TOTAL: 58 Endpoints**

---

## 🧪 Test Examples (cURL)

### 1. Test Login
```bash
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"firebaseToken": "your_firebase_token"}'

# Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800,
    "user": {
      "id": 1,
      "phone": "+1234567890",
      "name": "John Doe",
      "shopId": 1,
      "createdAt": "2026-04-29T..."
    }
  }
}
```

### 2. Test Create Shop
```bash
curl -X POST http://localhost:5002/api/shop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "John Tailoring",
    "phone": "+1234567890",
    "location": "123 Main Street"
  }'

# Response
{
  "success": true,
  "message": "Shop created",
  "data": {
    "id": 1,
    "userId": 1,
    "name": "John Tailoring",
    "location": "123 Main Street",
    "phone": "+1234567890",
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

### 3. Test Create Customer
```bash
curl -X POST http://localhost:5002/api/customer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Jane Smith",
    "phone": "+9876543210",
    "address": "456 Oak Avenue",
    "gender": "female",
    "email": "jane@example.com",
    "date_of_birth": "1990-05-15"
  }'

# Response
{
  "success": true,
  "message": "Customer created",
  "data": {
    "id": 1,
    "shopId": 1,
    "name": "Jane Smith",
    "phone": "+9876543210",
    "address": "456 Oak Avenue",
    "notes": null,
    "gender": "female",
    "email": "jane@example.com",
    "date_of_birth": "1990-05-15",
    "photo_url": null,
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

### 4. Test Create Measurement (JSONB - Flexible Fields)
```bash
curl -X POST http://localhost:5002/api/measurement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "customer_id": 1,
    "measurements_data": {
      "chest": 40,
      "waist": 32,
      "length": 28,
      "sleeve": 24,
      "neck": 16,
      "shoulder": 18
    }
  }'

# Response
{
  "success": true,
  "message": "Measurement created",
  "data": {
    "id": 1,
    "customerId": 1,
    "measurementsData": {
      "chest": 40,
      "waist": 32,
      "length": 28,
      "sleeve": 24,
      "neck": 16,
      "shoulder": 18
    },
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

### 5. Test Create Order (NEW UNIFIED FORMAT) ⭐ IMPORTANT
```bash
curl -X POST http://localhost:5002/api/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "customer_id": 1,
    "items": [
      {
        "type": "shirt",
        "fabric": "Cotton",
        "quantity": 2,
        "price": 500
      },
      {
        "type": "pant",
        "fabric": "Silk",
        "quantity": 1,
        "price": 750
      },
      {
        "type": "waistcoat",
        "fabric": "Wool",
        "quantity": 1,
        "price": 1000
      }
    ],
    "delivery_date": "2026-05-15"
  }'

# Response (camelCase fields in response)
{
  "success": true,
  "message": "Order created",
  "data": {
    "id": 1,
    "customerId": 1,
    "shopId": 1,
    "items": [
      {
        "type": "shirt",
        "fabric": "Cotton",
        "quantity": 2,
        "price": 500
      },
      {
        "type": "pant",
        "fabric": "Silk",
        "quantity": 1,
        "price": 750
      },
      {
        "type": "waistcoat",
        "fabric": "Wool",
        "quantity": 1,
        "price": 1000
      }
    ],
    "totalAmount": 2750,
    "status": "pending",
    "deliveryDate": "2026-05-15",
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

### 6. Test Update Order Status (WORKFLOW VALIDATION) ⭐ IMPORTANT
```bash
# Step 1: pending → in_progress
curl -X PUT http://localhost:5002/api/order/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "in_progress"}'

# Response
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "id": 1,
    "status": "in_progress",
    "updatedAt": "2026-04-29T..."
  }
}

# Step 2: in_progress → ready
curl -X PUT http://localhost:5002/api/order/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "ready"}'

# Step 3: ready → delivered
curl -X PUT http://localhost:5002/api/order/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "delivered"}'

# ❌ INVALID: Skip stages (will fail)
curl -X PUT http://localhost:5002/api/order/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"status": "delivered"}'

# Error Response
{
  "success": false,
  "message": "Invalid status transition",
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "details": {
      "from": "pending",
      "to": "delivered",
      "allowed": ["in_progress"]
    }
  }
}
```

### 7. Test Record Payment
```bash
curl -X POST http://localhost:5002/api/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "orderId": 1,
    "amount": 1000,
    "paymentMethod": "cash",
    "paymentDate": "2026-04-29T10:30:00Z",
    "notes": "Half payment received"
  }'

# Response
{
  "success": true,
  "message": "Payment recorded",
  "data": {
    "id": 1,
    "orderId": 1,
    "shopId": 1,
    "amount": 1000,
    "paymentMethod": "cash",
    "paymentDate": "2026-04-29T10:30:00Z",
    "userId": 1,
    "notes": "Half payment received",
    "createdAt": "2026-04-29T..."
  }
}
```

### 8. Test Add Activity Note
```bash
curl -X POST http://localhost:5002/api/activity/order/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"notes": "Customer approved the fabric selection"}'

# Response
{
  "success": true,
  "message": "Activity note added",
  "data": {
    "id": 1,
    "orderId": 1,
    "userId": 1,
    "action": "note_added",
    "notes": "Customer approved the fabric selection",
    "createdAt": "2026-04-29T..."
  }
}
```

### 9. Test Get Dashboard Stats
```bash
curl -X GET "http://localhost:5002/api/dashboard/stats?period=month" \
  -H "Authorization: Bearer {token}"

# Response
{
  "success": true,
  "message": "Dashboard stats retrieved",
  "data": {
    "period": "month",
    "totalOrders": 45,
    "orderCounts": {
      "pending": 10,
      "in_progress": 15,
      "ready": 12,
      "delivered": 8
    },
    "totalRevenue": 125000,
    "totalPayments": 95000,
    "pendingAmount": 30000,
    "totalCustomers": 28
  }
}
```

### 10. Test Get Public Portfolio (NO AUTH)
```bash
curl -X GET "http://localhost:5002/api/portfolio/public/1"

# Response
{
  "success": true,
  "message": "Portfolio items retrieved",
  "data": {
    "items": [
      {
        "id": 1,
        "shopId": 1,
        "title": "Wedding Shirt",
        "description": "Custom silk wedding shirt",
        "imageUrl": "https://...",
        "isPublic": true,
        "createdAt": "2026-04-29T..."
      }
    ]
  }
}
```

### 11. Test File Upload
```bash
curl -X POST http://localhost:5002/api/upload \
  -H "Authorization: Bearer {token}" \
  -F "image=@/path/to/image.jpg"

# Response
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "fileName": "image_1234567890.jpg",
    "fileUrl": "https://storage.example.com/uploads/image_1234567890.jpg",
    "uploadedAt": "2026-04-29T..."
  }
}
```

### 12. Test Verify Subscription (NO AUTH)
```bash
curl -X POST http://localhost:5002/api/subscription/verify \
  -H "Content-Type: application/json" \
  -d '{"shopId": 1}'

# Response
{
  "success": true,
  "message": "Subscription verified",
  "data": {
    "shopId": 1,
    "isActive": true,
    "planType": "premium",
    "expiresAt": "2026-05-29T..."
  }
}
```

---

## 🔑 Key Field Mappings Summary

### Request vs Response Field Names

| Request Field | Response Field | Type | Example |
|---------------|----------------|------|---------|
| customer_id | customerId | int | 1 |
| delivery_date | deliveryDate | date | 2026-05-15 |
| measurements_data | measurementsData | object | {"chest": 40} |
| payment_method | paymentMethod | string | "cash" |
| payment_date | paymentDate | datetime | 2026-04-29T... |

### Order Status Workflow
```
pending (start)
    ↓
in_progress
    ↓
ready
    ↓
delivered (end)
```

---

## 🛠️ HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success (GET, PUT, DELETE) | Order retrieved |
| 201 | Created (POST) | Order created |
| 400 | Bad Request | Invalid status transition |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Customer not found |
| 500 | Server Error | Internal server error |

---

## 📝 Common Error Responses

### Invalid Status Transition
```json
{
  "success": false,
  "message": "Invalid status transition from pending to delivered",
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "details": {
      "from": "pending",
      "to": "delivered",
      "allowed": ["in_progress"]
    }
  }
}
```

### Duplicate Phone
```json
{
  "success": false,
  "message": "Customer with this phone already exists",
  "error": {
    "code": "DUPLICATE_PHONE",
    "details": { "phone": "+1234567890" }
  }
}
```

### Resource Not Found
```json
{
  "success": false,
  "message": "Customer not found",
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "details": { "id": 999 }
  }
}
```

### Invalid Input
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "INVALID_INPUT",
    "details": {
      "field": "name",
      "reason": "required"
    }
  }
}
```

---

## 🔄 Pagination Example

### Request
```bash
curl -X GET "http://localhost:5002/api/customer?page=2&limit=20&search=john"
```

### Response
```json
{
  "success": true,
  "message": "Customers retrieved",
  "data": {
    "items": [
      { "id": 21, "name": "John Smith", ... },
      { "id": 22, "name": "Johnny Doe", ... }
    ],
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 150
    }
  }
}
```

---

## ✅ Pre-Integration Checklist

- [ ] Read openapi.yaml completely
- [ ] Understand NEW unified order format
- [ ] Understand order status workflow (cannot skip stages)
- [ ] Implement snake_case → camelCase field mapping
- [ ] Add Authorization header to all protected endpoints
- [ ] Handle token refresh (401 responses)
- [ ] Test all 58 endpoints locally
- [ ] Verify error handling for all error codes
- [ ] Test pagination on list endpoints
- [ ] Test file upload with valid image formats
- [ ] Test multi-tenant isolation (verify data scoping)

---

## 📞 Integration Support

**Spec File:** `/tailor-backend/docs/openapi.yaml`  
**Summary:** `/tailor-backend/OPENAPI_UPDATE_SUMMARY.md`  
**Critical Changes:** `/tailor-backend/OPENAPI_CRITICAL_CHANGES.md`  
**This File:** `/tailor-backend/OPENAPI_QUICK_REFERENCE.md`

**Swagger UI:** http://localhost:5002/api-docs (Interactive testing)

---

**Last Updated:** April 29, 2026  
**Status:** ✅ Production-Ready  
**Next:** Start integration and testing!
