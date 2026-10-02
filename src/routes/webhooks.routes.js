const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/cashfree', express.raw({ type: 'application/json' }), webhookController.handleCashfreeWebhook);

module.exports = router;
