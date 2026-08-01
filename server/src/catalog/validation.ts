import { z } from 'zod';

export const productIdSchema = z.string().uuid();

export const productInputSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(3).max(5000),
  priceKopecks: z.coerce.number().int().min(0).max(2_000_000_000),
  unit: z.string().trim().min(1).max(40),
  minimumQuantity: z.coerce.number().int().min(1).max(1_000_000),
});

export const productStateInputSchema = z.object({ state: z.enum(['available', 'hidden']) });
export const imageOrderInputSchema = z.object({ imageIds: z.array(z.string().uuid()).min(1).max(5) });

export type ProductInput = z.infer<typeof productInputSchema>;
