# 🔐 STEP 6: FIREBASE OTP INTEGRATION

## Overview
Implement Firebase OTP verification for user authentication. Firebase handles OTP on frontend, backend validates and creates user.

---

## 🎯 Goal
- ✅ Understand Firebase authentication flow
- ✅ Setup Firebase in React Native app
- ✅ Send OTP via Firebase
- ✅ Verify OTP and get firebase_uid
- ✅ Create user with backend

---

## 📱 How Firebase OTP Works

```
User Flow:
1. User enters phone number
2. Frontend calls Firebase sendSignInCode(phone)
3. Firebase sends OTP to phone
4. User enters OTP
5. Frontend calls signInWithPhoneNumber(otp)
6. Firebase returns firebase_uid
7. Frontend calls backend: api.authLogin(phone, firebase_uid)
8. Backend creates/updates user and returns jwt_token
9. Frontend stores jwt_token
10. User logged in! ✅
```

---

## 🛠 STEP 1: Setup Firebase in React Native App

### Install Firebase Package

```bash
cd /path/to/stitchpro-app

# Install Firebase
npm install @react-native-firebase/app @react-native-firebase/auth

# Link native modules
npx react-native link @react-native-firebase/auth
```

### Initialize Firebase in App.js

```javascript
// File: App.js
import React, { useEffect } from 'react';
import auth from '@react-native-firebase/auth';

export default function App() {
  useEffect(() => {
    // Initialize Firebase auth
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (user) {
        console.log('User authenticated:', user.uid);
      } else {
        console.log('User not authenticated');
      }
    });

    return unsubscribe;
  }, []);

  return (
    // Your app components
  );
}
```

---

## 🛠 STEP 2: Create OTP Service Module

**File: `services/firebaseAuth.js`** (in your React Native project)

```javascript
/**
 * Firebase Authentication Service
 * Handles OTP verification flow
 */

import auth from '@react-native-firebase/auth';

// State to hold confirmation object
let confirmationResult = null;

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone with country code (e.g., +919876543210)
 * @returns {Promise}
 */
export const sendOTP = async (phoneNumber) => {
  try {
    // Ensure phone number format is correct
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must start with +');
    }

    // Send OTP using Firebase
    confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
    
    console.log('OTP sent successfully');
    return {
      success: true,
      message: 'OTP sent to phone',
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      message: error.message || 'Failed to send OTP',
    };
  }
};

/**
 * Verify OTP and get firebase_uid
 * @param {string} otp - 6-digit OTP
 * @returns {Promise} - Firebase UID if successful
 */
export const verifyOTP = async (otp) => {
  try {
    if (!confirmationResult) {
      throw new Error('OTP not sent yet. Call sendOTP first.');
    }

    // Verify OTP
    const userCredential = await confirmationResult.confirm(otp);
    
    // Get user UID
    const firebaseUid = userCredential.user.uid;
    
    console.log('OTP verified. Firebase UID:', firebaseUid);
    
    return {
      success: true,
      firebase_uid: firebaseUid,
      message: 'OTP verified successfully',
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      message: error.message || 'Invalid OTP',
    };
  }
};

/**
 * Logout user
 */
export const firebaseLogout = async () => {
  try {
    await auth().signOut();
    confirmationResult = null;
    return {
      success: true,
      message: 'Logged out',
    };
  } catch (error) {
    console.error('Error logging out:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Get current Firebase user
 * @returns {object} - Current user or null
 */
export const getCurrentFirebaseUser = async () => {
  return auth().currentUser;
};
```

---

## 🛠 STEP 3: Create OTP Screen in React Native

**File: `screens/OTPScreen.js`** (in your React Native project)

```javascript
/**
 * OTP Verification Screen
 * 1. Take phone number
 * 2. Send OTP
 * 3. Take OTP
 * 4. Verify OTP
 * 5. Call backend API
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as firebaseAuth from '../services/firebaseAuth';
import * as api from '../services/api';

export default function OTPScreen({ navigation }) {
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // STEP 1: Send OTP
  const handleSendOTP = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    // Validate phone format
    if (phone.length < 10) {
      Alert.alert('Error', 'Phone number must be at least 10 digits');
      return;
    }

    setLoading(true);
    try {
      // Format phone number with country code
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      
      // Send OTP via Firebase
      const result = await firebaseAuth.sendOTP(formattedPhone);
      
      if (result.success) {
        Alert.alert('Success', 'OTP sent to your phone');
        setStep('otp'); // Move to OTP entry
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter OTP');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Error', 'OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP with Firebase
      const result = await firebaseAuth.verifyOTP(otp);
      
      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      // STEP 3: Call backend API with firebase_uid
      const backendResult = await api.authLogin(phone, result.firebase_uid);
      
      if (backendResult.success) {
        Alert.alert('Success', 'Logged in successfully!');
        // Navigate to home screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        Alert.alert('Error', backendResult.message);
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
          Enter Phone Number
        </Text>
        
        <TextInput
          placeholder="9876543210 (without +91)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          editable={!loading}
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 10,
            marginBottom: 10,
            borderRadius: 5,
          }}
        />
        
        <TouchableOpacity
          onPress={handleSendOTP}
          disabled={loading}
          style={{
            backgroundColor: '#007AFF',
            padding: 15,
            borderRadius: 5,
            alignItems: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
              Send OTP
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Enter OTP
      </Text>
      
      <Text style={{ marginBottom: 10 }}>
        OTP sent to {phone}
      </Text>
      
      <TextInput
        placeholder="Enter 6-digit OTP"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        editable={!loading}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5,
          fontSize: 20,
          letterSpacing: 2,
        }}
      />
      
      <TouchableOpacity
        onPress={handleVerifyOTP}
        disabled={loading}
        style={{
          backgroundColor: '#007AFF',
          padding: 15,
          borderRadius: 5,
          alignItems: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Verify OTP
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => setStep('phone')}
        style={{ marginTop: 15 }}
      >
        <Text style={{ color: '#007AFF', textAlign: 'center' }}>
          Change Phone Number
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 🛠 STEP 4: Backend API for OTP Verification

The backend already handles this in the existing auth controller. Here's what happens:

**Backend File: `src/controllers/auth.controller.js`** (already created)

```javascript
// This endpoint already exists:
// POST /api/auth/login

// It expects:
// {
//   "phone": "9876543210",
//   "firebase_uid": "firebase_user_id_from_otp"
// }

// Backend does:
// 1. Check if user with this firebase_uid exists
// 2. If yes - update phone
// 3. If no - create new user
// 4. Generate JWT token
// 5. Return token + user data

// Frontend stores JWT token in AsyncStorage
// All subsequent requests use this JWT token
```

---

## 🛠 STEP 5: Add Firebase Variables to .env

Update `.env` file with Firebase credentials:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_from_firebase_console
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## 📋 Complete Integration Checklist

```
Frontend (React Native):
  [ ] Install Firebase packages
  [ ] Create firebaseAuth.js service
  [ ] Create OTPScreen component
  [ ] Implement sendOTP function
  [ ] Implement verifyOTP function
  [ ] Call backend API after OTP verification
  [ ] Handle loading states
  
Backend (Node.js):
  [ ] Already has /api/auth/login endpoint
  [ ] Receives phone + firebase_uid
  [ ] Creates/updates user
  [ ] Generates JWT token
  [ ] Returns user data + token
  
Storage:
  [ ] JWT token saved in AsyncStorage
  [ ] User ID saved in AsyncStorage
  [ ] Token sent in all requests
```

---

## 🧪 Test Firebase OTP Flow

### 1. Test Phone Entry
```
- Go to OTP screen
- Enter phone: 9876543210
- Tap "Send OTP"
- Should see: "OTP sent to your phone"
```

### 2. Test OTP Verification
```
- On test device: Check your SMS
- Enter OTP from SMS
- Tap "Verify OTP"
- Should see: "Logged in successfully!"
- Redirected to Home screen
```

### 3. Test Postman (Backend)

Send this request:
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "firebase_uid": "test_firebase_uid_123"
}
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "firebase_uid": "test_firebase_uid_123",
      "created_at": "2026-04-11T04:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 🔑 Firebase Setup (Console Steps)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project or select existing
3. Enable Authentication → Phone number
4. Get credentials from Project Settings
5. Add to your `.env` file

---

## 🆘 Troubleshooting

### Issue: "OTP not sent - Firebase error"
```
Solution:
1. Check phone format: must start with +
2. Verify Firebase is initialized
3. Check Firebase console has Phone enabled
4. Try with +91 country code (India)
```

### Issue: "Invalid OTP"
```
Solution:
1. Ensure OTP is exactly 6 digits
2. OTP expires after 5 minutes
3. Each sendOTP invalidates previous OTP
```

### Issue: "Backend returns 401 - invalid firebase_uid"
```
Solution:
1. Firebase UID must match backend
2. Check phone number is correct
3. Verify firebase_uid is not null
```

### Issue: "No SMS received"
```
Solution:
1. Check phone number is correct
2. Try test device with real number
3. Ensure phone balance (for some regions)
4. Check SPAM folder
```

---

## 📞 Next Steps

1. ✅ Implement Firebase OTP in your app
2. ✅ Test full login flow
3. ✅ Proceed to **STEP 7**: Razorpay Payment Integration

---

**✅ STEP 6 COMPLETE!** 🎉

Firebase OTP integration is now ready! Users can login with phone number verification.
