/**
 * Gallery Routes
 * Handles gallery-related API endpoints
 */

const express = require('express');
const router = express.Router();
const GalleryController = require('../controllers/gallery.controller');
const authMiddleware = require('../middleware/auth');
const subscriptionGate = require('../middleware/subscriptionGate');

// All routes require authentication
router.use(authMiddleware);
router.use(subscriptionGate);

/**
 * @swagger
 * /api/gallery:
 *   post:
 *     summary: Create a new gallery item
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shop_id
 *               - image_url
 *             properties:
 *               shop_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *               order_index:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Gallery item created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', GalleryController.createGalleryItem);

/**
 * @swagger
 * /api/gallery:
 *   get:
 *     summary: Get all gallery items for a shop
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Gallery items retrieved successfully
 */
router.get('/', GalleryController.getGalleryByShop);

/**
 * @swagger
 * /api/gallery/categories:
 *   get:
 *     summary: Get gallery categories
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shop_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', GalleryController.getCategories);

/**
 * @swagger
 * /api/gallery/{id}:
 *   get:
 *     summary: Get gallery item by ID
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Gallery item retrieved successfully
 *       404:
 *         description: Gallery item not found
 */
router.get('/:id', GalleryController.getGalleryById);

/**
 * @swagger
 * /api/gallery/{id}:
 *   put:
 *     summary: Update gallery item
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *               order_index:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Gallery item updated successfully
 *       404:
 *         description: Gallery item not found
 */
router.put('/:id', GalleryController.updateGalleryItem);

/**
 * @swagger
 * /api/gallery/{id}:
 *   delete:
 *     summary: Delete gallery item
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Gallery item deleted successfully
 *       404:
 *         description: Gallery item not found
 */
router.delete('/:id', GalleryController.deleteGalleryItem);

/**
 * @swagger
 * /api/gallery/reorder:
 *   put:
 *     summary: Reorder gallery items
 *     tags: [Gallery]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shop_id
 *               - item_orders
 *             properties:
 *               shop_id:
 *                 type: integer
 *               item_orders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     order_index:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Gallery items reordered successfully
 */
router.put('/reorder', GalleryController.reorderItems);

module.exports = router;
