import express from 'express';
import cors from 'cors';
import path from 'path';

import { env } from './config/env';
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

// ── 404 & Error handlers ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
