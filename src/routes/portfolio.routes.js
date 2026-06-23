/**
 * Portfolio Routes
 * Endpoints for portfolio management
 */

const express = require('express');
const portfolioController = require('../controllers/portfolio.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');

const router = express.Router();

// POST /portfolio - Create portfolio item (authenticated)
router.post('/', authMiddleware, subscriptionGate, portfolioController.createPortfolioItem);

// GET /portfolio - Get user's portfolio items (authenticated)
router.get('/', authMiddleware, subscriptionGate, portfolioController.getPortfolioItems);

// GET /portfolio/public/:shopId - Get public portfolio (no auth)
router.get('/public/:shopId', portfolioController.getPublicPortfolio);

// DELETE /portfolio/:id - Delete portfolio item (authenticated)
router.delete('/:id', authMiddleware, subscriptionGate, portfolioController.deletePortfolioItem);

module.exports = router;
