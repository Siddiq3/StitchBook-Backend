/**
 * User Routes
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.post('/delete-account', require('express-rate-limit')({windowMs:60000,max:60,standardHeaders:true,legacyHeaders:false}),
  (req,res,next) => {
    if (!req.get('x-deletion-token')) return authMiddleware(req,res,next);
    try { require('../services/accountDeletion.service').verifyToken(req.get('x-deletion-token')); next(); }
    catch { res.status(401).json({success:false,message:'Please re-authenticate to continue deletion'}); }
  }, require('../controllers/accountDeletion.controller').deleteAccount);
router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

module.exports = router;
