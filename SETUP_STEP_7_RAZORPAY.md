# 💳 STEP 7: RAZORPAY PAYMENT INTEGRATION

## Overview
Implement Razorpay payment gateway for subscription plans. Handle payments and subscription management.

---

## 🎯 Goal
- ✅ Understand subscription flow
- ✅ Create Razorpay orders
- ✅ Verify payments
- ✅ Store subscriptions in database
- ✅ Handle webhooks

---

## 💰 How Razorpay Subscription Works

```
Payment Flow:
1. User selects subscription plan
2. Frontend calls backend: POST /api/subscription/create-order
3. Backend creates Razorpay order
4. Backend returns order details
5. Frontend shows Razorpay payment modal
6. User enters card details
7. Razorpay processes payment
8. Payment success/failure callback
9. Frontend confirms with backend
10. Backend marks subscription as active
11. User gets access ✅

Webhook (for payment verification):
1. Razorpay sends webhook to backend
2. Backend verifies signature
3. Backend updates subscription status
4. Database persists subscription data
```

---

## 🛠 STEP 1: Install Razorpay Package

### Backend
```bash
cd /path/to/tailor-backend

# Install Razorpay Node SDK
npm install razorpay
```

### Frontend (React Native)
```bash
cd /path/to/stitchpro-app

# Install Razorpay React Native
npm install razorpay-react-native

# Link native modules
npx react-native link razorpay-react-native
```

---

## 🛠 STEP 2: Update .env with Razorpay Credentials

Add to `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=webhook_secret_here

# Webhook URL (for Razorpay to send payment updates)
RAZORPAY_WEBHOOK_URL=http://localhost:5000/api/subscription/webhook
```

Get credentials from [Razorpay Dashboard](https://dashboard.razorpay.com)

---

## 🛠 STEP 3: Create Razorpay Service Module

**File: `src/services/razorpay.service.js`** (Backend)

```javascript
/**
 * Razorpay Payment Service
 * Handles order creation, payment verification, webhook management
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../config/database');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create Razorpay order
 * @param {number} amount - Amount in paise (e.g., 99900 = ₹999)
 * @param {string} planName - Plan name (e.g., 'basic', 'pro', 'premium')
 * @param {number} shopId - Shop ID
 * @param {string} customerEmail - Customer email
 * @param {string} customerPhone - Customer phone
 * @returns {Promise}
 */
async function createOrder(amount, planName, shopId, customerEmail, customerPhone) {
  try {
    const options = {
      amount: amount, // in paise
      currency: 'INR',
      receipt: `receipt_${shopId}_${Date.now()}`,
      description: `${planName} Plan Subscription`,
      notes: {
        shop_id: shopId,
        plan_name: planName,
      },
      customer_notify: 1,
      timeout: 600, // 10 minutes
    };

    const order = await razorpay.orders.create(options);

    console.log('Razorpay Order Created:', order.id);

    return {
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      data: order,
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Verify payment signature from Razorpay
 * @param {object} paymentData - {order_id, payment_id, signature}
 * @returns {boolean} - True if valid, false otherwise
 */
function verifyPaymentSignature(paymentData) {
  try {
    const { order_id, payment_id, signature } = paymentData;

    // Create signature body
    const body = `${order_id}|${payment_id}`;

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    // Compare
    const isValid = expectedSignature === signature;

    console.log('Payment Signature Valid:', isValid);

    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Get payment details from Razorpay
 * @param {string} paymentId - Payment ID from Razorpay
 * @returns {Promise}
 */
async function getPaymentDetails(paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      data: payment,
    };
  } catch (error) {
    console.error('Error fetching payment:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Handle webhook from Razorpay
 * Called when payment is completed
 * @param {object} webhookData - Webhook payload from Razorpay
 * @param {string} signature - Webhook signature for verification
 * @returns {Promise}
 */
async function handleWebhook(webhookData, signature) {
  try {
    // Verify webhook signature
    const body = JSON.stringify(webhookData);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Invalid webhook signature');
      return {
        success: false,
        message: 'Invalid signature',
      };
    }

    // Extract event and data
    const event = webhookData.event;
    const eventData = webhookData.data;

    console.log('Webhook Event:', event);

    if (event === 'payment.authorized' || event === 'payment.captured') {
      // Payment successful
      const payment = eventData.payment;
      const shopId = payment.notes?.shop_id;
      const planName = payment.notes?.plan_name;

      // Update subscription in database
      const query = `
        UPDATE subscriptions
        SET 
          status = 'active',
          razorpay_payment_id = $1,
          razorpay_order_id = $2,
          updated_at = NOW()
        WHERE shop_id = $3 AND status = 'pending'
        RETURNING *
      `;

      const result = await db.query(query, [
        payment.id,
        payment.order_id,
        shopId,
      ]);

      console.log('Subscription updated:', result.rows[0]);

      return {
        success: true,
        message: 'Subscription activated',
        data: result.rows[0],
      };
    } else if (event === 'payment.failed') {
      // Payment failed
      const payment = eventData.payment;
      const shopId = payment.notes?.shop_id;

      const query = `
        UPDATE subscriptions
        SET status = 'failed'
        WHERE shop_id = $1 AND status = 'pending'
        RETURNING *
      `;

      await db.query(query, [shopId]);

      return {
        success: false,
        message: 'Payment failed',
      };
    }

    return {
      success: true,
      message: 'Webhook processed',
    };
  } catch (error) {
    console.error('Error handling webhook:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  razorpay,
  createOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  handleWebhook,
};
```

---

## 🛠 STEP 4: Create Subscription API Routes

**File: `src/routes/subscription.routes.js`** (Backend)

Add these endpoints (or update existing):

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const razorpayService = require('../services/razorpay.service');
const db = require('../config/database');

/**
 * POST /api/subscription/create-order
 * Create Razorpay order for subscription
 */
router.post('/create-order', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const shopId = req.user.shop_id;

    // Verify plan
    const validPlans = {
      basic: { amount: 4999, duration: 30 }, // ₹49.99/month
      pro: { amount: 9999, duration: 30 },   // ₹99.99/month
      premium: { amount: 19999, duration: 30 }, // ₹199.99/month
    };

    if (!validPlans[plan]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan',
      });
    }

    // Get shop email
    const shopQuery = `
      SELECT email, phone FROM shops WHERE id = $1
    `;
    const shopResult = await db.query(shopQuery, [shopId]);
    const shop = shopResult.rows[0];

    // Create Razorpay order
    const result = await razorpayService.createOrder(
      validPlans[plan].amount,
      plan,
      shopId,
      shop.email,
      shop.phone
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Save order to database
    const saveQuery = `
      INSERT INTO subscriptions (shop_id, plan, razorpay_order_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'pending', NOW(), NOW())
      RETURNING *
    `;

    const saveResult = await db.query(saveQuery, [
      shopId,
      plan,
      result.order_id,
    ]);

    res.json({
      success: true,
      message: 'Order created',
      data: {
        order: result.data,
        subscription: saveResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/subscription/verify-payment
 * Verify payment and activate subscription
 */
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;
    const shopId = req.user.shop_id;

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature({
      order_id,
      payment_id,
      signature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    // Get subscription
    const query = `
      SELECT * FROM subscriptions
      WHERE shop_id = $1 AND razorpay_order_id = $2
    `;

    const result = await db.query(query, [shopId, order_id]);
    const subscription = result.rows[0];

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    // Update subscription
    const updateQuery = `
      UPDATE subscriptions
      SET 
        status = 'active',
        razorpay_payment_id = $1,
        expiry_date = NOW() + INTERVAL '30 days',
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await db.query(updateQuery, [payment_id, subscription.id]);

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/subscription/webhook
 * Razorpay webhook (no auth required)
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    const result = await razorpayService.handleWebhook(req.body, signature);

    // Always return 200 to acknowledge webhook
    res.json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ // Still 200 to acknowledge
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/subscription/status
 * Get current subscription status
 */
router.get('/status', auth, async (req, res) => {
  try {
    const shopId = req.user.shop_id;

    const query = `
      SELECT * FROM subscriptions
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [shopId]);
    const subscription = result.rows[0];

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          active: false,
          plan: null,
          message: 'No active subscription',
        },
      });
    }

    const isActive = subscription.status === 'active' && 
                     new Date(subscription.expiry_date) > new Date();

    res.json({
      success: true,
      data: {
        active: isActive,
        plan: subscription.plan,
        status: subscription.status,
        expiry_date: subscription.expiry_date,
        created_at: subscription.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
```

---

## 🛠 STEP 5: Frontend Payment Integration

**File: `services/payment.js`** (React Native)

```javascript
/**
 * Razorpay Payment Service
 * Handles payment processing on frontend
 */

import RazorpayCheckout from 'razorpay-react-native';
import * as api from './api';

/**
 * Initialize Razorpay
 * @param {string} key_id - Razorpay public key
 */
export const initializeRazorpay = (key_id) => {
  RazorpayCheckout.setKeyID(key_id);
};

/**
 * Process subscription payment
 * @param {object} orderData - {order_id, shop_name, amount, plan}
 * @returns {Promise}
 */
export const processPayment = async (orderData) => {
  try {
    const { order_id, shop_name, amount, plan } = orderData;

    const options = {
      description: `${plan} Plan Subscription`,
      image: 'https://your-logo-url',
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxx',
      amount: amount * 100, // Convert to paise
      order_id: order_id,
      name: 'TailorPro',
      prefill: {
        email: shop_name,
        contact: shop_name,
      },
      theme: { color: '#007AFF' },
    };

    return new Promise((resolve, reject) => {
      RazorpayCheckout.open(options)
        .then((data) => {
          // Payment successful
          resolve({
            success: true,
            payment_id: data.razorpay_payment_id,
            order_id: data.razorpay_order_id,
            signature: data.razorpay_signature,
          });
        })
        .catch((error) => {
          // Payment failed
          reject({
            success: false,
            message: error.description || 'Payment cancelled',
          });
        });
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Complete subscription flow
 * @param {string} plan - Plan name ('basic', 'pro', 'premium')
 * @returns {Promise}
 */
export const startSubscription = async (plan) => {
  try {
    // STEP 1: Create order on backend
    const orderResponse = await api.post('/subscription/create-order', {
      plan,
    });

    if (!orderResponse.success) {
      throw new Error(orderResponse.message);
    }

    const { order, amount } = orderResponse.data;

    // STEP 2: Process payment with Razorpay
    const paymentResult = await processPayment({
      order_id: order.id,
      shop_name: order.receipt,
      amount: order.amount / 100, // Convert from paise
      plan: plan,
    });

    if (!paymentResult.success) {
      throw new Error(paymentResult.message);
    }

    // STEP 3: Verify payment on backend
    const verifyResponse = await api.post('/subscription/verify-payment', {
      order_id: paymentResult.order_id,
      payment_id: paymentResult.payment_id,
      signature: paymentResult.signature,
    });

    return verifyResponse;
  } catch (error) {
    console.error('Subscription error:', error);
    throw error;
  }
};
```

---

## 🛠 STEP 6: Payment Screen Component

**File: `screens/SubscriptionScreen.js`** (React Native)

```javascript
/**
 * Subscription/Payment Screen
 * Display plans and process payments
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as paymentService from '../services/payment';

export default function SubscriptionScreen() {
  const [loading, setLoading] = useState(false);

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '₹49.99',
      duration: 'per month',
      features: ['5 Customers', '10 Orders', 'Basic Reports'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '₹99.99',
      duration: 'per month',
      features: ['50 Customers', '100 Orders', 'Advanced Reports', 'Custom Measurements'],
      popular: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '₹199.99',
      duration: 'per month',
      features: ['Unlimited Customers', 'Unlimited Orders', 'Full Analytics', 'Priority Support'],
    },
  ];

  const handleSubscribe = async (plan) => {
    setLoading(true);
    try {
      const result = await paymentService.startSubscription(plan.id);
      
      if (result.success) {
        Alert.alert('Success', 'Subscription activated!');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPlan = ({ item }) => (
    <View
      style={{
        backgroundColor: item.popular ? '#007AFF' : '#f5f5f5',
        padding: 20,
        marginBottom: 15,
        borderRadius: 10,
        borderWidth: item.popular ? 0 : 1,
        borderColor: '#ddd',
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: 'bold',
          color: item.popular ? '#fff' : '#000',
        }}
      >
        {item.name}
      </Text>
      
      <Text
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: item.popular ? '#fff' : '#000',
          marginTop: 10,
        }}
      >
        {item.price}
      </Text>
      
      <Text
        style={{
          color: item.popular ? '#ffffff' : '#666',
          marginBottom: 15,
        }}
      >
        {item.duration}
      </Text>

      {item.features.map((feature, index) => (
        <Text
          key={index}
          style={{
            color: item.popular ? '#fff' : '#000',
            marginBottom: 5,
          }}
        >
          ✓ {feature}
        </Text>
      ))}

      <TouchableOpacity
        onPress={() => handleSubscribe(item)}
        disabled={loading}
        style={{
          backgroundColor: item.popular ? '#fff' : '#007AFF',
          padding: 12,
          borderRadius: 5,
          marginTop: 15,
          alignItems: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text
            style={{
              color: item.popular ? '#007AFF' : '#fff',
              fontWeight: 'bold',
            }}
          >
            Subscribe Now
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Choose Your Plan
      </Text>

      <FlatList
        data={plans}
        renderItem={renderPlan}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
    </View>
  );
}
```

---

## 📋 Subscription Database Schema

The subscription table already exists:

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL,
  plan VARCHAR(50),
  razorpay_subscription_id VARCHAR(100),
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, expired, failed
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);
```

---

## 🧪 Test Payment Flow

### 1. Create Order
```
POST http://localhost:5000/api/subscription/create-order
Header: Authorization: Bearer {jwt_token}
Body:
{
  "plan": "pro"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_xxxxx",
      "amount": 9999
    }
  }
}
```

### 2. Process Payment
- Use Razorpay test card: 4111111111111111
- Expiry: 12/25
- CVV: 123

### 3. Verify Payment
```
POST http://localhost:5000/api/subscription/verify-payment
Header: Authorization: Bearer {jwt_token}
Body:
{
  "order_id": "order_xxxxx",
  "payment_id": "pay_xxxxx",
  "signature": "signature_xxxxx"
}
```

---

## 🔑 Razorpay Test Credentials

Get from [Razorpay Dashboard](https://dashboard.razorpay.com):

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=webhook_secret
```

Test cards:
- Success: 4111111111111111
- Decline: 4000000000000002
- International: 4008576000402457

---

## ✅ Checklist

```
Backend:
  [ ] Install razorpay npm package
  [ ] Create razorpay.service.js
  [ ] Add subscription routes
  [ ] Add webhook endpoint
  [ ] Add .env variables
  [ ] Test API endpoints in Postman

Frontend:
  [ ] Install razorpay-react-native
  [ ] Create payment.js service
  [ ] Create SubscriptionScreen
  [ ] Test payment flow
  [ ] Handle success/failure

Database:
  [ ] Subscriptions table exists
  [ ] Foreign keys set
  [ ] Can query subscription status
```

---

## 🆘 Troubleshooting

### Issue: "Invalid Razorpay Key"
```
Solution:
1. Verify KEY_ID and KEY_SECRET in .env
2. Ensure no typos
3. Use test keys (rzp_test_xxx) for development
```

### Issue: "Payment verification failed"
```
Solution:
1. Verify signature is correct
2. Check order_id and payment_id exist
3. Ensure webhook secret is correct
```

### Issue: "Webhook not received"
```
Solution:
1. Configure webhook URL in Razorpay dashboard
2. URL must be publicly accessible (use ngrok for testing)
3. Backend must return 200 status
```

---

## 📞 Next Steps

1. ✅ Test payment integration
2. ✅ Verify webhook handling
3. ✅ Proceed to **STEP 8**: Deployment

---

**✅ STEP 7 COMPLETE!** 🎉

Payment integration is now ready! Users can subscribe to plans.
