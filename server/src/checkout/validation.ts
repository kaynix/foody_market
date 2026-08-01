import { z } from 'zod';

export const checkoutLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1_000_000),
});

export const checkoutLinesSchema = z.object({
  lines: z.array(checkoutLineSchema).min(1).max(100),
});

const checkoutCreateLineSchema = checkoutLineSchema.extend({
  expectedPriceKopecks: z.number().int().min(0).max(2_000_000_000),
});

export const checkoutCreateSchema = z.object({
  lines: z.array(checkoutCreateLineSchema).min(1).max(100),
  buyer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/),
  }),
  channel: z.object({
    provider: z.string().trim().min(1).max(40),
    browserSecret: z.string().min(20).max(100),
  }),
  deliveries: z.array(z.object({
    sellerId: z.string().uuid(),
    type: z.enum(['nova_poshta', 'pickup', 'arrangement']),
    details: z.string().trim().min(1).max(1000),
  })).min(1).max(100),
});

export type CheckoutLineInput = z.infer<typeof checkoutLineSchema>;
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;
