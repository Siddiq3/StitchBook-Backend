# 🔗 STEP 5: CONNECT REACT NATIVE FRONTEND

## Overview
Connect your React Native app to the backend API. This step shows how to make API calls from your mobile app.

---

## 🎯 Goal
- ✅ Understand API communication
- ✅ Create API service module
- ✅ Make authentication requests
- ✅ Handle responses and errors
- ✅ Store JWT tokens securely

---

## 📡 How Frontend-Backend Communication Works

```
Frontend (React Native)
    ↓ (API Request)
    │  Method: POST/GET/PUT/DELETE
    │  URL: http://localhost:5000/api/endpoint
    │  Headers: Authorization: Bearer {token}
    │  Body: {json data}
    ↓
Backend (Node.js + Express)
    ↓ (Validates request)
    │  Check JWT token
    │  Validate data
    │  Query database
    ↓
    ↓ (API Response)
    │  Status: 200, 400, 500, etc.
    │  Body: {success, message, data}
    ↓
Frontend (React Native)
    ↓ (Handle response)
    │  Display data
    │  Show errors
    │  Update state
```

---

## 🛠 STEP 1: Create API Service Module

Create a new file for API communication:

**File: `services/api.js`** (in your React Native project)

```javascript
/**
 * API Service Module
 * Handles all HTTP requests to the backend
 * 
 * Created for: stitchpro-app
 * Backend: http://localhost:5000/api
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Intercept all requests to add JWT token
 */
api.interceptors.request.use(
  async (config) => {
    try {
      // Get JWT token from storage
      const token = await AsyncStorage.getItem('jwt_token');
      
      // Add token to Authorization header if it exists
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    } catch (error) {
      console.error('Error getting token:', error);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

/**
 * Intercept responses to handle errors
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      console.error('API Error:', errorData.message);
      return Promise.reject(errorData);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
      return Promise.reject({
        success: false,
        message: 'Network error. Check your internet connection.',
      });
    } else {
      return Promise.reject({
        success: false,
        message: error.message,
      });
    }
  }
);

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * Login / Register user
 * @param {string} phone - User phone number
 * @param {string} firebase_uid - Firebase authentication token
 * @returns {Promise} - User data and JWT token
 */
export const authLogin = async (phone, firebase_uid) => {
  try {
    const response = await api.post('/auth/login', {
      phone,
      firebase_uid,
    });
    
    // Save JWT token to storage
    if (response.data && response.data.token) {
      await AsyncStorage.setItem('jwt_token', response.data.token);
      await AsyncStorage.setItem('user_id', String(response.data.user.id));
    }
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise}
 */
export const verifyToken = async (token) => {
  return api.post('/auth/verify-token', { token });
};

/**
 * Logout user
 */
export const authLogout = async () => {
  try {
    await AsyncStorage.removeItem('jwt_token');
    await AsyncStorage.removeItem('user_id');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// ============================================================================
// USER ENDPOINTS
// ============================================================================

/**
 * Get user profile
 * @returns {Promise} - User profile data
 */
export const getUserProfile = async () => {
  return api.get('/user/profile');
};

/**
 * Update user profile
 * @param {object} updateData - Data to update
 * @returns {Promise}
 */
export const updateUserProfile = async (updateData) => {
  return api.put('/user/profile', updateData);
};

// ============================================================================
// SHOP ENDPOINTS
// ============================================================================

/**
 * Create a new shop
 * @param {object} shopData - {name, location, phone}
 * @returns {Promise} - Created shop
 */
export const createShop = async (shopData) => {
  return api.post('/shop/create', shopData);
};

/**
 * Get current user's shop
 * @returns {Promise} - Shop data
 */
export const getMyShop = async () => {
  return api.get('/shop');
};

/**
 * Get shop by ID
 * @param {number} shopId - Shop ID
 * @returns {Promise}
 */
export const getShop = async (shopId) => {
  return api.get(`/shop/${shopId}`);
};

/**
 * Update shop
 * @param {number} shopId - Shop ID
 * @param {object} updateData - Data to update
 * @returns {Promise}
 */
export const updateShop = async (shopId, updateData) => {
  return api.put(`/shop/${shopId}`, updateData);
};

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * Add new customer
 * @param {object} customerData - {shop_id, name, phone, notes}
 * @returns {Promise}
 */
export const addCustomer = async (customerData) => {
  return api.post('/customer/add', customerData);
};

/**
 * Get customer details
 * @param {number} customerId - Customer ID
 * @returns {Promise}
 */
export const getCustomer = async (customerId) => {
  return api.get(`/customer/${customerId}`);
};

/**
 * Get all customers for shop
 * @param {number} shopId - Shop ID
 * @param {number} page - Page number
 * @param {number} limit - Records per page
 * @returns {Promise}
 */
export const getShopCustomers = async (shopId, page = 1, limit = 20) => {
  return api.get(`/customer/shop/${shopId}`, {
    params: { page, limit },
  });
};

/**
 * Search customers
 * @param {number} shopId - Shop ID
 * @param {string} searchTerm - Search term
 * @returns {Promise}
 */
export const searchCustomers = async (shopId, searchTerm) => {
  return api.get(`/customer/search/${shopId}`, {
    params: { q: searchTerm },
  });
};

/**
 * Update customer
 * @param {number} customerId - Customer ID
 * @param {object} updateData - Data to update
 * @returns {Promise}
 */
export const updateCustomer = async (customerId, updateData) => {
  return api.put(`/customer/${customerId}`, updateData);
};

/**
 * Delete customer
 * @param {number} customerId - Customer ID
 * @returns {Promise}
 */
export const deleteCustomer = async (customerId) => {
  return api.delete(`/customer/${customerId}`);
};

// ============================================================================
// MEASUREMENT ENDPOINTS
// ============================================================================

/**
 * Add measurement
 * @param {number} customerId - Customer ID
 * @param {object} measurementsData - Measurement data
 * @returns {Promise}
 */
export const addMeasurement = async (customerId, measurementsData) => {
  return api.post('/measurement/add', {
    customer_id: customerId,
    measurements_data: measurementsData,
  });
};

/**
 * Get latest measurement
 * @param {number} customerId - Customer ID
 * @returns {Promise}
 */
export const getLatestMeasurement = async (customerId) => {
  return api.get(`/measurement/latest/${customerId}`);
};

/**
 * Get all measurements
 * @param {number} customerId - Customer ID
 * @returns {Promise}
 */
export const getMeasurements = async (customerId) => {
  return api.get(`/measurement/${customerId}`);
};

/**
 * Update measurement
 * @param {number} measurementId - Measurement ID
 * @param {object} measurementsData - Updated measurement data
 * @returns {Promise}
 */
export const updateMeasurement = async (measurementId, measurementsData) => {
  return api.put(`/measurement/${measurementId}`, {
    measurements_data: measurementsData,
  });
};

/**
 * Delete measurement
 * @param {number} measurementId - Measurement ID
 * @returns {Promise}
 */
export const deleteMeasurement = async (measurementId) => {
  return api.delete(`/measurement/${measurementId}`);
};

// ============================================================================
// ORDER ENDPOINTS
// ============================================================================

/**
 * Create order
 * @param {object} orderData - {customer_id, shop_id, description, price, delivery_date}
 * @returns {Promise}
 */
export const createOrder = async (orderData) => {
  return api.post('/order/create', orderData);
};

/**
 * Get order details
 * @param {number} orderId - Order ID
 * @returns {Promise}
 */
export const getOrder = async (orderId) => {
  return api.get(`/order/${orderId}`);
};

/**
 * Get shop orders
 * @param {number} shopId - Shop ID
 * @param {string} status - Optional status filter (pending, stitching, completed)
 * @param {number} page - Page number
 * @returns {Promise}
 */
export const getShopOrders = async (shopId, status = null, page = 1) => {
  const params = { page, limit: 20 };
  if (status) params.status = status;
  
  return api.get(`/order/shop/${shopId}`, { params });
};

/**
 * Get customer orders
 * @param {number} customerId - Customer ID
 * @returns {Promise}
 */
export const getCustomerOrders = async (customerId) => {
  return api.get(`/order/customer/${customerId}`);
};

/**
 * Update order
 * @param {number} orderId - Order ID
 * @param {object} updateData - Data to update
 * @returns {Promise}
 */
export const updateOrder = async (orderId, updateData) => {
  return api.put(`/order/${orderId}`, updateData);
};

/**
 * Get order statistics
 * @param {number} shopId - Shop ID
 * @returns {Promise}
 */
export const getOrderStats = async (shopId) => {
  return api.get(`/order/stats/${shopId}`);
};

/**
 * Delete order
 * @param {number} orderId - Order ID
 * @returns {Promise}
 */
export const deleteOrder = async (orderId) => {
  return api.delete(`/order/${orderId}`);
};

// ============================================================================
// SUBSCRIPTION ENDPOINTS
// ============================================================================

/**
 * Get subscription status
 * @returns {Promise}
 */
export const getSubscriptionStatus = async () => {
  return api.get('/subscription/status');
};

/**
 * Check if subscription is active
 * @returns {Promise}
 */
export const checkActiveSubscription = async () => {
  return api.post('/subscription/check-active');
};

/**
 * Create subscription after payment
 * @param {object} subscriptionData - {plan, razorpay_subscription_id, status, expiry_date}
 * @returns {Promise}
 */
export const createSubscription = async (subscriptionData) => {
  return api.post('/subscription/create', subscriptionData);
};

/**
 * Verify subscription (called after Razorpay payment)
 * @param {object} verificationData - {razorpay_subscription_id, plan, status, expiry_date}
 * @returns {Promise}
 */
export const verifySubscription = async (verificationData) => {
  return api.post('/subscription/verify', verificationData);
};

export default api;
```

---

## 🧩 STEP 2: Use API Service in Components

### Example 1: Login Screen

```javascript
/**
 * File: screens/LoginScreen.js
 * Example of using API in React Native component
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as api from '../services/api';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // This is called after Firebase OTP verification
  const handleLogin = async (firebaseUid) => {
    if (!phone) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    setLoading(true);
    try {
      // Call backend API
      const response = await api.authLogin(phone, firebaseUid);
      
      // Success
      Alert.alert('Success', 'Logged in successfully!');
      
      // Navigate to home screen
      navigation.navigate('Home');
    } catch (error) {
      // Error handling
      Alert.alert('Login Failed', error.message || 'Something went wrong');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Enter Phone Number</Text>
      <TextInput
        placeholder="9876543210"
        value={phone}
        onChangeText={setPhone}
      />
      <TouchableOpacity
        onPress={() => handleLogin('firebase_uid_123')}
        disabled={loading}
      >
        <Text>{loading ? 'Logging in...' : 'Login'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Example 2: Get Customer List

```javascript
/**
 * File: screens/CustomersScreen.js
 * Display list of customers
 */

import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, ActivityIndicator } from 'react-native';
import * as api from '../services/api';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState(1); // Get from context/storage

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      // Get customers for shop
      const response = await api.getShopCustomers(shopId);
      
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={customers}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text>{item.name}</Text>
            <Text>{item.phone}</Text>
            <Text>{item.notes}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

### Example 3: Create Order

```javascript
/**
 * File: screens/CreateOrderScreen.js
 * Create a new order
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import * as api from '../services/api';

export default function CreateOrderScreen({ route, navigation }) {
  const { customerId, shopId } = route.params;
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateOrder = async () => {
    if (!description || !price) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.createOrder({
        customer_id: customerId,
        shop_id: shopId,
        description,
        price: parseFloat(price),
        delivery_date: deliveryDate || null,
      });

      Alert.alert('Success', 'Order created successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        placeholder="Price"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />
      <TextInput
        placeholder="Delivery Date (YYYY-MM-DD)"
        value={deliveryDate}
        onChangeText={setDeliveryDate}
      />
      <TouchableOpacity
        onPress={handleCreateOrder}
        disabled={loading}
      >
        <Text>{loading ? 'Creating...' : 'Create Order'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 📋 Install Required Dependencies

```bash
# Navigate to your React Native project
cd /path/to/stitchpro-app

# Install axios (for HTTP requests)
npm install axios

# Install AsyncStorage (for storing JWT token)
npm install @react-native-async-storage/async-storage

# For React Native CLI projects
npx react-native link @react-native-async-storage/async-storage
```

---

## 🔐 Store JWT Token Securely

### Using AsyncStorage:

```javascript
// Save token after login
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save
await AsyncStorage.setItem('jwt_token', token);
await AsyncStorage.setItem('user_id', userId);

// Retrieve
const token = await AsyncStorage.getItem('jwt_token');
const userId = await AsyncStorage.getItem('user_id');

// Remove (on logout)
await AsyncStorage.removeItem('jwt_token');
await AsyncStorage.removeItem('user_id');

// Check if logged in
const token = await AsyncStorage.getItem('jwt_token');
const isLoggedIn = token !== null;
```

---

## 🌍 Update Backend URL for Different Environments

```javascript
// config/apiConfig.js

export const API_CONFIG = {
  // Development (local)
  development: {
    baseURL: 'http://localhost:5000/api',
  },
  
  // Staging
  staging: {
    baseURL: 'https://staging-api.yourdomain.com/api',
  },
  
  // Production
  production: {
    baseURL: 'https://api.yourdomain.com/api',
  },
};

// Get current environment
const ENV = __DEV__ ? 'development' : 'production';
const currentConfig = API_CONFIG[ENV];

// Use in your api.js:
const api = axios.create({
  baseURL: currentConfig.baseURL,
  // ...
});
```

---

## 🔄 Handle Token Expiry

```javascript
/**
 * Auto-refresh token when expired
 */

// In api.js interceptor
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // If 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token (if you implement refresh endpoint)
        const newToken = await refreshToken();
        
        // Update token in storage
        await AsyncStorage.setItem('jwt_token', newToken);
        
        // Retry request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.removeItem('jwt_token');
        // Navigate to login screen
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 📝 Complete Flow Example

```
User Flow:
1. User enters phone number
2. Frontend calls Firebase OTP
3. Firebase sends OTP to phone
4. User enters OTP
5. Firebase verifies and returns firebase_uid
6. Frontend calls: api.authLogin(phone, firebase_uid)
7. Backend creates/updates user and returns jwt_token
8. Frontend stores token in AsyncStorage
9. All subsequent requests include Bearer token
10. Frontend displays customer list, orders, etc.
```

---

## ✅ Checklist

- [ ] Created api.js service file
- [ ] Installed axios and AsyncStorage
- [ ] Configured API base URL
- [ ] Added JWT token to headers
- [ ] Implemented error handling
- [ ] Created example screens
- [ ] Stored JWT token securely
- [ ] Tested login flow
- [ ] Tested API calls
- [ ] Backend URL matches environment

---

## 🆘 Troubleshooting

### Issue: "Network Error - Can't reach server"
```
Solution:
1. Is backend running? npm run dev
2. Is IP/URL correct?
3. Check firewall settings
4. Use ngrok for testing on real device
```

### Issue: "401 Unauthorized"
```
Solution:
1. Is JWT token stored?
2. Is token valid?
3. Is Authorization header correct?
4. Did token expire?
```

### Issue: "CORS Error"
```
Solution:
Backend already has CORS enabled
But if needed, add to backend app.js:
app.use(cors({
  origin: 'http://localhost:3000'
}));
```

---

## 📞 Next Steps

1. **Test** all API calls in your app
2. **Handle** errors gracefully
3. **Proceed to STEP 6**: Firebase OTP integration

---

**✅ STEP 5 COMPLETE!** 🎉

Frontend is now connected to backend! Proceed to **STEP 6: Firebase OTP Integration**
