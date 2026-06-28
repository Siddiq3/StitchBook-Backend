/**
 * Server Entry Point
 * Starts the Express server with Redis and graceful shutdown
 */

// Set working directory to project root
process.chdir(__dirname + '/..');

require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { shutdownRedis } = require('./config/redis');
const { ensureDatabaseSchema } = require('./config/schema');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

// Start server
const startServer = async () => {
  await ensureDatabaseSchema();

  server = app.listen(PORT, () => {
    logger.info(`✓ Server started successfully`);
    logger.info(`✓ Environment: ${NODE_ENV}`);
    logger.info(`✓ Server running on http://localhost:${PORT}`);
    logger.info(`✓ Health check: http://localhost:${PORT}/health`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error.message);
  process.exit(1);
});

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.warn(`${signal} signal received: closing HTTP server`);

  if (!server) {
    await shutdownRedis();
    process.exit(0);
    return;
  }

  server.close(async () => {
    logger.info('HTTP server closed');

    // Shutdown Redis
    await shutdownRedis();
    logger.info('Redis connection closed');

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
