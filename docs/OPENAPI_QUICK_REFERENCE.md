# OpenAPI Documentation - Quick Reference

**Updated:** May 10, 2026  
**API Base:** `http://localhost:5002/api` or `https://api.tailorcrm.com/api`

---

## 🚀 Quick Start

### 1. Health Checks (Monitoring)

```bash
# Basic health check (returns immediately)
curl http://localhost:5002/api/health

# Readiness check (verifies Redis + all dependencies)
curl http://localhost:5002/api/ready
```

### 2. Authentication Flow

```bash
# Step 1: Firebase OTP → Get ID Token
# (Done in mobile app - Firebase SDK)

# Step 2: Trade Firebase token for JWT tokens
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"firebaseToken": "FIREBASE_ID_TOKEN"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "token": "JWT_ACCESS_TOKEN",
#     "refreshToken": "JWT_REFRESH_TOKEN",
#     "expiresIn": 604800,  // 7 days in seconds
#     "user": { ... }
#   }
# }

# Step 3: Use token in all authenticated requests
curl http://localhost:5002/api/auth/profile \
  -H "Authorization: Bearer JWT_ACCESS_TOKEN"

# Step 4: When token expires, refresh it
curl -X POST http://localhost:5002/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "JWT_REFRESH_TOKEN"}'

# Step 5: Logout (revokes all tokens)
curl -X POST http://localhost:5002/api/auth/logout \
  -H "Authorization: Bearer JWT_ACCESS_TOKEN"
```

---

## 📊 Rate Limiting

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| Global default | 100 req | 15 min |
| POST /auth/login | 5 req | 15 min |
| POST /auth/verify-token | 3 req | 15 min |
| POST /auth/refresh-token | 10 req | 15 min |
| POST /upload | 20 req | 15 min |

### Rate Limit Response

When limit exceeded (HTTP 429):

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "rateLimit": {
    "limit": 100,
    "window": "15 minutes",
    "remaining": 0,
    "resetAt": "2026-05-10T12:45:00Z"
  }
}
```

**Response Headers:**
- `RateLimit-Limit: 100`
- `RateLimit-Remaining: 0`
- `RateLimit-Reset: 1715418300`

---

## 🔐 Token Management

### Token Lifecycle

1. **Login** → Get access + refresh tokens
2. **Use access token** for API calls (7 days valid)
3. **Access token expires** → Get 401 UNAUTHORIZED
4. **Call refresh** → Get new tokens (old ones revoked)
5. **Logout** → All tokens blacklisted (cannot be used)

### What Causes 401?

| Scenario | Solution |
|----------|----------|
| Token expired | Call `POST /auth/refresh-token` |
| Token revoked | Must call `POST /auth/login` again |
| Token malformed | Check Authorization header format |
| Header missing | Include `Authorization: Bearer TOKEN` |
| Wrong header format | Must be "Bearer " not "Token " |

### Token Rotation Details

When you call `POST /auth/refresh-token`:

1. **Old access token** → Added to blacklist
2. **Old refresh token** → Made invalid (single-use)
3. **New access token** → Issued (7-day expiry)
4. **New refresh token** → Issued
5. **Session ID** → Remains same (for tracking)

**Important:** Old tokens cannot be reused after refresh.

---

## 📤 File Upload

### Upload an Image

```bash
curl -X POST http://localhost:5002/api/upload \
  -H "Authorization: Bearer JWT_TOKEN" \
  -F "image=@/path/to/photo.jpg"
```

### Upload Restrictions

- **Max size:** 10 MB
- **Allowed types:** JPEG, PNG, GIF, WebP
- **Rate limit:** 20 uploads / 15 minutes
- **Storage:** Server-managed (unique filename)
- **Access:** Public URL returned

### Response Example

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "url": "http://localhost:5002/uploads/1715334000000_cloth_photo.jpg",
    "filename": "1715334000000_cloth_photo.jpg",
    "size": 245678,
    "mimeType": "image/jpeg"
  }
}
```

### Common Upload Errors

```json
// File too large
{
  "success": false,
  "message": "File size exceeds 10MB limit",
  "error": {
    "code": "INVALID_INPUT",
    "details": {
      "maxSize": 10485760,
      "actualSize": 15728640
    }
  }
}

// Invalid file type
{
  "success": false,
  "message": "Only jpg, jpeg, png, gif, webp files are allowed",
  "error": { "code": "INVALID_INPUT" }
}

// No file provided
{
  "success": false,
  "message": "No image file provided",
  "error": { "code": "INVALID_INPUT" }
}
```

---

## ❌ Error Codes Reference

| Code | HTTP | Meaning | Solution |
|------|------|---------|----------|
| INVALID_INPUT | 400 | Bad request format | Check request body/params |
| UNAUTHORIZED | 401 | Invalid/expired token | Call refresh or login |
| FORBIDDEN | 403 | Access denied | Check permissions/shop ID |
| NOT_FOUND | 404 | Resource doesn't exist | Verify ID is correct |
| DUPLICATE_PHONE | 400 | Phone already exists | Use different phone |
| INVALID_STATUS_TRANSITION | 400 | Can't change status that way | Check order status flow |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Wait 15 minutes |
| SERVICE_UNAVAILABLE | 503 | Redis/critical service down | Retry in 30s |
| GATEWAY_TIMEOUT | 504 | Request took >30s | Simplify request/retry |

---

## 🔍 Monitoring

### Health Check (Liveness)

```bash
curl http://localhost:5002/api/health

# Returns 200 always if server is running
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2026-05-10T12:34:56.789Z"
}
```

### Readiness Check (Kubernetes)

```bash
curl http://localhost:5002/api/ready

# Returns 200 if all dependencies ready
{
  "ready": true,
  "status": "ready",
  "redis": "connected",
  "timestamp": "2026-05-10T12:34:56.789Z"
}

# Returns 503 if Redis down
{
  "ready": false,
  "status": "degraded",
  "redis": "disconnected",
  "message": "Redis cache is unavailable",
  "timestamp": "2026-05-10T12:34:56.789Z"
}
```

---

## 🎯 Common Tasks

### Create an Order

```bash
curl -X POST http://localhost:5002/api/order \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "items": [
      {"type": "shirt", "fabric": "Cotton", "quantity": 2, "price": 500}
    ],
    "delivery_date": "2026-05-15",
    "trial_date": "2026-05-10",
    "priority": "urgent"
  }'
```

### Update Order Status

```bash
# Valid transitions: pending → in_progress → ready → delivered
curl -X PUT http://localhost:5002/api/order/1/status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Record Payment

```bash
curl -X POST http://localhost:5002/api/payment \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1,
    "amount": 500.00,
    "paymentMethod": "upi",
    "paymentDate": "2026-05-10",
    "notes": "Advance via GPay"
  }'
```

### Get Dashboard Stats

```bash
curl "http://localhost:5002/api/dashboard/stats?period=month&order_type=stitching" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🚨 Troubleshooting

### I'm Getting 401 Unauthorized

**Causes:**
1. ❌ Header missing: `Authorization: Bearer TOKEN`
2. ❌ Wrong format: Should be "Bearer " not "Token "
3. ❌ Token expired (7 days old)
4. ❌ Token was revoked (called logout)

**Solution:**
1. ✅ Check header format: `Authorization: Bearer JWT_TOKEN`
2. ✅ Call `POST /auth/refresh-token` if expired
3. ✅ Call `POST /auth/login` if revoked

### I'm Getting 429 Too Many Requests

**Cause:** Rate limit exceeded

**Solution:**
1. Check response header `RateLimit-Reset`
2. Wait that many seconds before retrying
3. Implement exponential backoff in client

### I'm Getting 503 Service Unavailable

**Cause:** Redis cache is down

**Solution:**
1. This is a temporary issue (infrastructure problem)
2. Retry request after 30 seconds
3. Contact support if persists >5 minutes

### I'm Getting 504 Gateway Timeout

**Cause:** Request took >30 seconds

**Solution:**
1. Your query is too complex (e.g., large date range)
2. Simplify request (smaller date range, fewer filters)
3. Try again if it's a one-time spike

---

## 📖 API Documentation

**Full OpenAPI Spec:** `docs/openapi.yaml`

**Tools to View:**
- Swagger UI: `docs/swagger-ui.html`
- ReDoc: `docs/redoc.html`
- Postman: Import `docs/postman-collection.json`

---

## 🔗 Related Endpoints

### Authentication
- `POST /auth/login` - Start session
- `POST /auth/refresh-token` - Renew tokens
- `POST /auth/logout` - End session
- `GET /auth/profile` - Get current user
- `PUT /auth/profile` - Update name
- `POST /auth/verify-token` - Check token validity

### System
- `GET /health` - Health check
- `GET /ready` - Readiness probe

### Business
- `POST /customer` - Create customer
- `GET /customer` - List customers
- `POST /order` - Create order
- `PUT /order/{id}/status` - Update status
- `POST /payment` - Record payment
- `GET /dashboard/stats` - Dashboard data
- `POST /upload` - Upload image

---

**Questions?** Check the full OpenAPI spec at `docs/openapi.yaml`  
**Last Updated:** May 10, 2026
