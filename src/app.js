/**
 * Express App Configuration
 * Sets up middleware, routes, and error handling
 */

const express = require('express');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const { swaggerUi, specs } = require('./config/swagger');
const corsMiddleware = require('./middleware/security/cors');
const helmetMiddleware = require('./middleware/security/helmet');
const compressionMiddleware = require('./middleware/security/compression');
const hppMiddleware = require('./middleware/security/hpp');
const requestTimeout = require('./middleware/security/timeout');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/logging');
const { globalLimiter } = require('./middleware/rateLimit/limitersRedis');
const { getStatus: getRedisStatus } = require('./config/redis');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const shopRoutes = require('./routes/shop.routes');
const customerRoutes = require('./routes/customer.routes');
const measurementRoutes = require('./routes/measurement.routes');
const orderRoutes = require('./routes/order.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const paymentRoutes = require('./routes/payment.routes');
const activityRoutes = require('./routes/activity.routes');
const webhooksRoutes = require('./routes/webhooks.routes');
const portfolioRoutes = require('./routes/portfolio.routes');
const uploadRoutes = require('./routes/upload.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const staffRoutes = require('./routes/staff.routes');
const notificationRoutes = require('./routes/notification.routes');
const galleryRoutes = require('./routes/gallery.routes');
const invoiceRoutes = require('./routes/invoice.routes');

// Initialize Express app
const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security hardening
app.disable('x-powered-by');
app.use(requestId);
app.use(helmetMiddleware);
app.use(requestLogger);
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(hppMiddleware);

// Webhook route needs the raw payload for signature validation
app.use('/api/webhooks', webhooksRoutes);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));

// Request timeout
app.use(requestTimeout);
app.use((req, res, next) => {
  if (!req.timedout) {
    next();
  }
});

// Cheap liveness, and bounded/cache-coalesced dependency readiness.
app.get(['/health','/live'],(req,res)=>res.json({success:true,status:'OK'}));
const ready = require('./services/readiness').createReadinessProbe({
  checkDatabase:()=>require('./config/database').pool.query({text:'SELECT 1',query_timeout:2000}),
  checkRedis:()=>getRedisStatus()==='ready',
});
app.get('/ready', require('express-rate-limit')({windowMs:60000,max:30,standardHeaders:true,legacyHeaders:false}), async(req,res)=>{
  const result=await ready(); res.status(result.status==='READY'?200:503).json(result);
});
app.use(globalLimiter);
app.get('/',(req,res)=>res.json({success:true,message:'StitchBook backend is running',health:'/health',api:'/api'}));
app.get('/api',(req,res)=>res.json({success:true,message:'StitchBook API is running'}));

// Swagger UI - API Documentation
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2.5em }
    `,
    customSiteTitle: 'Tailor CRM API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    }
  }));
}

// Static file serving for uploads
app.get('/uploads/:shopId/:filename',(req,res)=>{
  const {shopId,filename}=req.params;
  if(!require('./utils/privateFiles').verifyFile(shopId,filename,req.query.expires,req.query.signature)) return res.sendStatus(404);
  res.set('Cache-Control','private, max-age=60');
  res.sendFile(path.join(__dirname,'../uploads',shopId,filename));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/measurement', measurementRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/invoice', invoiceRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

module.exports = app;
