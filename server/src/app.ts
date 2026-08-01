import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { createAuthRouter } from './auth/routes';
import { createIdentityProviderRegistry } from './auth/registry';
import { SellerSessionService } from './auth/sessionService';
import { env } from './config/env';
import { database } from './db/client';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import bannerRoutes from './routes/banners';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

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

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Foody API is running', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/banners', bannerRoutes);
app.use(
  '/api/auth',
  createAuthRouter({
    config: env,
    registry: createIdentityProviderRegistry(env),
    sessionService: new SellerSessionService(database.db, {
      secret: env.SESSION_SECRET,
      ttlHours: env.SESSION_TTL_HOURS,
    }),
  }),
);

// ── 404 & Error handlers ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
