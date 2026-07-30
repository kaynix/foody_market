import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import bannerRoutes from './routes/banners';
import { errorHandler, notFound } from './middleware/errorHandler';

dotenv.config();

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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
