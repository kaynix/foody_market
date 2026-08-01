import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { createAuthRouter } from './auth/routes';
import { createIdentityProviderRegistry } from './auth/registry';
import { SellerSessionService } from './auth/sessionService';
import { env } from './config/env';
import { database } from './db/client';
import { CatalogService } from './catalog/catalogService';
import { createSellerProductRouter } from './catalog/sellerProductRoutes';
import { SellerProductService } from './catalog/sellerProductService';
import { createSellerRouter, createStorefrontRouter } from './sellers/routes';
import { SellerProfileService } from './sellers/service';
import { StorefrontService } from './sellers/storefrontService';
import { createProductRouter } from './routes/products';
import { createCategoryRouter } from './routes/categories';
import bannerRoutes from './routes/banners';
import { errorHandler, notFound } from './middleware/errorHandler';
import { ProductImageProcessor } from './storage/images';
import { createFileStorage } from './storage/registry';
import { ChannelActionTokenService } from './messaging/actionTokenService';
import { ChannelLinkIntentService } from './messaging/linkIntentService';
import { createMessagingRegistry } from './messaging/registry';
import { createPublicMessagingRouter, createSellerChannelRouter } from './messaging/routes';
import { MessagingUpdateService } from './messaging/updateService';
import { CheckoutService } from './checkout/service';
import { createCheckoutRouter, createTrackingRouter } from './checkout/routes';
import { ApplicationService } from './applications/service';
import { createSellerApplicationRouter } from './applications/routes';

const app = express();
const sellerSessionService = new SellerSessionService(database.db, {
  secret: env.SESSION_SECRET,
  ttlHours: env.SESSION_TTL_HOURS,
});
const sellerProfileService = new SellerProfileService(database.db);
const fileStorage = createFileStorage(env);
const storefrontService = new StorefrontService(database.db, fileStorage, env.PUBLIC_API_URL);
const imageProcessor = new ProductImageProcessor(fileStorage);
const catalogService = new CatalogService(database.db, fileStorage, env.PUBLIC_API_URL);
const sellerProductService = new SellerProductService(
  database.db,
  fileStorage,
  imageProcessor,
  env.PUBLIC_API_URL,
);
const messagingRegistry = createMessagingRegistry(env);
const channelLinks = new ChannelLinkIntentService(
  database.db,
  messagingRegistry,
  env.SESSION_SECRET,
  env.PII_ENCRYPTION_KEY,
  env.CHANNEL_LINK_TTL_MINUTES,
);
const channelActions = new ChannelActionTokenService(database.db, env.SESSION_SECRET);
const applicationService = new ApplicationService(database.db, env.PII_ENCRYPTION_KEY);
const messagingUpdates = new MessagingUpdateService(
  messagingRegistry, channelLinks, channelActions, applicationService,
);
const checkoutService = new CheckoutService(
  database.db,
  channelLinks,
  env.SESSION_SECRET,
  env.PII_ENCRYPTION_KEY,
  applicationService,
);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static images ───────────────────────────────────────────────────────────
app.use('/images', express.static(path.join(__dirname, '../public/images')));
if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads', express.static(path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR), {
    fallthrough: true,
    index: false,
  }));
}

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Foody API is running', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/products', createProductRouter(catalogService));
app.use('/api/categories', createCategoryRouter(catalogService));
app.use('/api/banners', bannerRoutes);
app.use('/api/messaging', createPublicMessagingRouter(env, messagingRegistry, messagingUpdates));
app.use('/api/checkout', createCheckoutRouter(checkoutService));
app.use('/api/tracking', createTrackingRouter(checkoutService));
app.use(
  '/api/auth',
  createAuthRouter({
    config: env,
    registry: createIdentityProviderRegistry(env),
    sessionService: sellerSessionService,
  }),
);
app.use(
  '/api/seller/products',
  createSellerProductRouter(env, sellerSessionService, sellerProductService),
);
app.use(
  '/api/seller/channels',
  createSellerChannelRouter(env, sellerSessionService, messagingRegistry, channelLinks),
);
app.use(
  '/api/seller/applications',
  createSellerApplicationRouter(env, sellerSessionService, applicationService),
);
app.use(
  '/api/seller',
  createSellerRouter({
    config: env,
    sessionService: sellerSessionService,
    profileService: sellerProfileService,
  }),
);
app.use('/api/storefronts', createStorefrontRouter(storefrontService));

// ── 404 & Error handlers ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
