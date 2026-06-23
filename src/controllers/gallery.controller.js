/**
 * Gallery Controller
 * Handles gallery-related business logic
 */

const GalleryModel = require('../models/gallery.model');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

class GalleryController {
  /**
   * Create a new gallery item
   * POST /api/gallery
   */
  static async createGalleryItem(req, res) {
    try {
      const { shop_id, title, description, image_url, category, tags, is_active, order_index } = req.body;

      // Validation
      if (!shop_id || !image_url) {
        return res.status(400).json({
          success: false,
          message: 'shop_id and image_url are required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const galleryItem = await GalleryModel.createGalleryItem({
        shop_id,
        title,
        description,
        image_url,
        category,
        tags,
        is_active,
        order_index
      });

      return res.status(201).json({
        success: true,
        message: 'Gallery item created successfully',
        data: galleryItem,
        error: {}
      });
    } catch (error) {
      logger.error('Create gallery item error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create gallery item',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get gallery item by ID
   * GET /api/gallery/:id
   */
  static async getGalleryById(req, res) {
    try {
      const { id } = req.params;
      const galleryItem = await GalleryModel.getGalleryById(id);

      if (!galleryItem) {
        return res.status(404).json({
          success: false,
          message: 'Gallery item not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Gallery item retrieved successfully',
        data: galleryItem,
        error: {}
      });
    } catch (error) {
      logger.error('Get gallery item error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve gallery item',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get all gallery items for a shop
   * GET /api/gallery
   */
  static async getGalleryByShop(req, res) {
    try {
      const { shop_id } = req.query;
      const shopId = Number(shop_id);
      const activeOnly = req.query.active_only === 'true';
      const category = req.query.category || null;
      const { limit, offset } = parsePagination(req, 50, 100);

      if (!shop_id || Number.isNaN(shopId)) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const galleryItems = await GalleryModel.getGalleryByShop(shopId, activeOnly, category, limit, offset);
      const total = await GalleryModel.getGalleryCount(shopId, activeOnly, category);
      const categories = await GalleryModel.getCategories(shopId);

      return res.status(200).json({
        success: true,
        message: 'Gallery items retrieved successfully',
        data: {
          gallery_items: galleryItems,
          categories,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + galleryItems.length < total
          }
        },
        error: {}
      });
    } catch (error) {
      logger.error('Get gallery list error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve gallery items',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Get gallery categories
   * GET /api/gallery/categories
   */
  static async getCategories(req, res) {
    try {
      const { shop_id } = req.query;
      const shopId = Number(shop_id);

      if (!shop_id || Number.isNaN(shopId)) {
        return res.status(400).json({
          success: false,
          message: 'shop_id is required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      const categories = await GalleryModel.getCategories(shopId);

      return res.status(200).json({
        success: true,
        message: 'Categories retrieved successfully',
        data: categories,
        error: {}
      });
    } catch (error) {
      logger.error('Get categories error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve categories',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Update gallery item
   * PUT /api/gallery/:id
   */
  static async updateGalleryItem(req, res) {
    try {
      const { id } = req.params;
      const { title, description, image_url, category, tags, is_active, order_index } = req.body;

      const existingItem = await GalleryModel.getGalleryById(id);
      if (!existingItem) {
        return res.status(404).json({
          success: false,
          message: 'Gallery item not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      const galleryItem = await GalleryModel.updateGalleryItem(id, {
        title,
        description,
        image_url,
        category,
        tags,
        is_active,
        order_index
      });

      return res.status(200).json({
        success: true,
        message: 'Gallery item updated successfully',
        data: galleryItem,
        error: {}
      });
    } catch (error) {
      logger.error('Update gallery item error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update gallery item',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Delete gallery item
   * DELETE /api/gallery/:id
   */
  static async deleteGalleryItem(req, res) {
    try {
      const { id } = req.params;

      const deleted = await GalleryModel.deleteGalleryItem(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Gallery item not found',
          error: { code: 'NOT_FOUND', details: {} }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Gallery item deleted successfully',
        data: {},
        error: {}
      });
    } catch (error) {
      logger.error('Delete gallery item error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete gallery item',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }

  /**
   * Reorder gallery items
   * PUT /api/gallery/reorder
   */
  static async reorderItems(req, res) {
    try {
      const { shop_id, item_orders } = req.body;

      if (!shop_id || !item_orders || !Array.isArray(item_orders)) {
        return res.status(400).json({
          success: false,
          message: 'shop_id and item_orders array are required',
          error: { code: 'VALIDATION_ERROR', details: {} }
        });
      }

      await GalleryModel.reorderItems(shopId, item_orders);

      return res.status(200).json({
        success: true,
        message: 'Gallery items reordered successfully',
        data: {},
        error: {}
      });
    } catch (error) {
      logger.error('Reorder gallery items error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reorder gallery items',
        error: { code: 'SERVER_ERROR', details: {} }
      });
    }
  }
}

module.exports = GalleryController;
