/**
 * User Routes
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.get('/by-phone/:phone', userController.getUserByPhone);

module.exports = router;
