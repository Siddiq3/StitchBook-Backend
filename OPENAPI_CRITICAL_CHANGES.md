# 🎯 OpenAPI Specification - Critical Changes & Fixes

## Version: 1.0.0 → 2.0.0

**Status:** ✅ COMPLETE  
**Last Updated:** April 29, 2026

---

## 🔴 CRITICAL CHANGES (Breaking/Important)

### 1. NEW Unified Order Format
**Status:** Must update frontend immediately

**OLD FORMAT (DEPRECATED):**
```json
❌ Inconsistent/flexible item structure
```

**NEW FORMAT (REQUIRED):**
```json
POST /order
{
  "customer_id": 1,          // Uses snake_case in request
  "items": [
    {
      "type": "shirt",        // Garment type
      "fabric": "Cotton",     // Fabric material
      "quantity": 2,          // Quantity
      "price": 500           // Price per item
    }
  ],
  "delivery_date": "2026-05-01"
}

// Response uses camelCase:
{
  "success": true,
  "data": {
    "customerId": 1,        // camelCase in response
    "deliveryDate": "2026-05-01",
    "totalAmount": 1000,
    ...
  }
}
```

**Action Required:** Update order creation endpoint in frontend

---

### 2. Order Status Flow is Now Strictly Validated
**Status:** Backend enforces flow

**Valid Flow:**
```
pending → in_progress → ready → delivered
```

**Invalid (Will be rejected):**
- ❌ pending → ready
- ❌ pending → delivered
- ❌ in_progress → pending
- ❌ Any skipping of stages

**Action Required:** 
- Frontend must respect this flow
- Use PUT `/order/{id}/status` with correct sequence

---

### 3. Request Field Naming - SNAKE_CASE
**Status:** All requests must use snake_case

| Field | Type | Usage |
|-------|------|-------|
| customer_id | integer | POST /order, POST /measurement |
| delivery_date | date | POST /order |
| measurements_data | object | POST /measurement |
| payment_method | string | POST /payment |
| payment_date | datetime | POST /payment |

**Action Required:** Update all API calls to use snake_case

---

### 4. Response Field Naming - CAMEL_CASE
**Status:** All responses now use camelCase

| Field | Type | Usage |
|-------|------|-------|
| customerId | integer | Order, Measurement, Customer responses |
| deliveryDate | date | Order responses |
| measurementsData | object | Measurement responses |
| paymentMethod | string | Payment responses |
| paymentDate | datetime | Payment responses |
| totalAmount | number | Order responses |
| createdAt | datetime | All resource responses |
| updatedAt | datetime | All resource responses |

**Action Required:** Update response parsing to expect camelCase

---

## 🟢 NEW ENDPOINTS (58 Total)

### Payment Management (3 endpoints)
```
POST   /payment                     - Record payment
GET    /payment/order/{orderId}    - Get payments for order
DELETE /payment/{id}               - Delete payment
```

### Activity Logs (2 endpoints)
```
GET  /activity/order/{orderId}  - Get activity logs
POST /activity/order/{orderId}  - Add note/comment
```

### Dashboard Analytics (1 endpoint)
```
GET /dashboard/stats?period=month  - Get analytics
```

### Portfolio Management (4 endpoints)
```
POST    /portfolio                  - Create item
GET     /portfolio                  - Get user's portfolio
GET     /portfolio/public/{shopId}  - Public portfolio (NO AUTH!)
DELETE  /portfolio/{id}             - Delete item
```

### File Upload (1 endpoint)
```
POST /upload  - Upload image (multipart/form-data)
```

### Subscription Management (6 endpoints)
```
POST   /subscription/verify                  - Check subscription (NO AUTH!)
POST   /subscription/create                  - Create subscription
GET    /subscription/status                  - Get status
POST   /subscription/check-active            - Check if active
PUT    /subscription/{id}/status             - Update status
DELETE /subscription/{id}                    - Cancel
```

### User Profile (2 endpoints)
```
GET /auth/profile      - Get user profile
PUT /auth/profile      - Update profile
```

**Total New Endpoints:** 19

---

## 🟡 DEPRECATED/REMOVED

### None - All old endpoints still work
The specification now documents ALL endpoints including previously undocumented ones.

---

## 📊 Schema Changes

### New Request Schemas
- LoginRequest
- LoginTestRequest
- RefreshTokenRequest
- VerifyTokenRequest
- ShopRequest / ShopUpdateRequest
- CustomerRequest / CustomerUpdateRequest
- **OrderRequest (NEW UNIFIED FORMAT)**
- **OrderUpdateRequest**
- **OrderStatusRequest**
- MeasurementRequest / MeasurementUpdateRequest
- PaymentRequest
- ActivityNoteRequest
- PortfolioItemRequest

### New Response Schemas
- Payment
- Activity
- DashboardStats
- PortfolioItem
- Subscription
- Paginated Response

---

## 🔐 Security Changes

### Public Endpoints (No JWT Required)
- POST /auth/login
- POST /auth/login-test
- POST /auth/verify-token
- POST /auth/refresh-token
- POST /subscription/verify
- GET /portfolio/public/{shopId}

### Protected Endpoints (JWT Required)
- All other endpoints

**Action Required:** 
- Add `Authorization: Bearer {token}` header to all protected requests
- Handle token expiry and use refresh endpoint

---

## 🗺️ Field Mapping Quick Reference

### POST /order (Request)
```javascript
{
  "customer_id": 1,                    // ← snake_case
  "items": [...],
  "delivery_date": "2026-05-01"        // ← snake_case
}
```

### Response from POST /order
```javascript
{
  "success": true,
  "data": {
    "id": 1,
    "customerId": 1,                   // ← camelCase
    "items": [...],
    "deliveryDate": "2026-05-01",      // ← camelCase
    "totalAmount": 1000,
    "status": "pending",
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

### POST /measurement (Request)
```javascript
{
  "customer_id": 1,                    // ← snake_case
  "measurements_data": {              // ← snake_case
    "chest": 40,
    "waist": 32,
    "length": 28
  }
}
```

### Response from POST /measurement
```javascript
{
  "success": true,
  "data": {
    "id": 1,
    "customerId": 1,                   // ← camelCase
    "measurementsData": {              // ← camelCase
      "chest": 40,
      "waist": 32,
      "length": 28
    },
    "createdAt": "2026-04-29T...",
    "updatedAt": "2026-04-29T..."
  }
}
```

---

## 📋 Implementation Checklist

- [ ] **Frontend - Update API Client:**
  - [ ] Use snake_case for all request fields (customer_id, delivery_date, etc.)
  - [ ] Parse responses expecting camelCase (customerId, deliveryDate, etc.)
  - [ ] Update order creation to use new unified format

- [ ] **Frontend - Update Order Flow:**
  - [ ] Implement strict status transitions (pending → in_progress → ready → delivered)
  - [ ] Validate on frontend before sending to backend
  - [ ] Handle 400 "Invalid status transition" errors

- [ ] **Frontend - Add New Features:**
  - [ ] Integrate payment recording (POST /payment)
  - [ ] Add activity comments (POST /activity/order/{orderId})
  - [ ] Display dashboard stats (GET /dashboard/stats)
  - [ ] Portfolio showcase (GET /portfolio/public/{shopId})

- [ ] **Frontend - Authentication:**
  - [ ] Handle token refresh (POST /auth/refresh-token)
  - [ ] Add Authorization header to all requests
  - [ ] Handle 401 responses

- [ ] **Testing:**
  - [ ] Test all 58 endpoints
  - [ ] Test order status flow validation
  - [ ] Test payment recording
  - [ ] Test customer isolation (multi-tenant)
  - [ ] Test file upload

- [ ] **Documentation:**
  - [ ] Share openapi.yaml with team
  - [ ] Update integration docs
  - [ ] Update API client library

---

## 🚀 How to Access

### Swagger UI (Interactive)
```
http://localhost:5002/api-docs
```

### OpenAPI Spec (Raw YAML)
```
/tailor-backend/docs/openapi.yaml
```

### Quick Links
- **API Server:** http://localhost:5002/api
- **Health Check:** http://localhost:5002/health
- **API Docs:** http://localhost:5002/api-docs

---

## ❓ FAQ

**Q: Do old order creation endpoints still work?**
A: Yes, but use the new unified format documented here. Old formats might fail validation.

**Q: What if I skip order status stages?**
A: Backend will return 400 error: "Invalid status transition from 'pending' to 'delivered'. Allowed: in_progress"

**Q: How do I handle camelCase vs snake_case?**
A: Request uses snake_case, response uses camelCase. This is consistent with REST best practices.

**Q: Can I get portfolio without authentication?**
A: Yes! GET /portfolio/public/{shopId} is public.

**Q: How do I upload files?**
A: POST /upload with multipart/form-data. Field name must be "image".

**Q: How do I verify subscription status?**
A: Use POST /subscription/verify with shopId. No authentication needed.

---

## 📞 Support

If you encounter issues:
1. Check the endpoint documentation in openapi.yaml
2. Verify you're using correct field names (snake_case for requests)
3. Check error response code and message
4. Review the status code meaning (400, 401, 403, 404, 500)

**All field mappings documented above. Follow them exactly.**

---

## Version History

| Version | Date | Status | Changes |
|---------|------|--------|---------|
| 2.0.0 | Apr 29, 2026 | ✅ Current | Complete rewrite with all 58 endpoints, unified order format, new schemas |
| 1.0.0 | Previous | ⚠️ Outdated | Partial documentation, missing endpoints |

---

**OpenAPI 2.0.0 is production-ready. Follow this guide for successful integration.**
