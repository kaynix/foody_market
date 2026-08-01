import { z } from 'zod';

export const contactTypeSchema = z.enum([
  'phone',
  'telegram',
  'viber',
  'whatsapp',
  'website',
  'other',
]);

export const deliveryTypeSchema = z.enum(['nova_poshta', 'pickup', 'arrangement']);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/[\s_]+/g, '-').replace(/-+/g, '-'))
  .pipe(
    z
      .string()
      .min(3, 'Slug must contain at least 3 characters')
      .max(64, 'Slug must contain at most 64 characters')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain Latin letters, numbers and hyphens'),
  );

export const profileInputSchema = z.object({
  slug: slugSchema,
  storeName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  region: z.string().trim().max(120).default(''),
});

export const profileUpdateSchema = profileInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one profile field is required',
);

function isAllowedContactValue(type: z.infer<typeof contactTypeSchema>, value: string): boolean {
  if (type === 'phone') return /^(?:tel:)?\+?[0-9 ()-]{7,24}$/.test(value);
  if (type === 'other') {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return true;
    try {
      return ['https:', 'tel:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (type === 'website') return url.protocol === 'https:';
  if (type === 'telegram') {
    return url.protocol === 'tg:' || (url.protocol === 'https:' && ['t.me', 'telegram.me'].includes(url.hostname));
  }
  if (type === 'viber') {
    return url.protocol === 'viber:' || (url.protocol === 'https:' && url.hostname === 'invite.viber.com');
  }
  return url.protocol === 'whatsapp:' || (url.protocol === 'https:' && ['wa.me', 'api.whatsapp.com'].includes(url.hostname));
}

export const contactInputSchema = z
  .object({
    type: contactTypeSchema,
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(2).max(300),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .superRefine((contact, context) => {
    if (!isAllowedContactValue(contact.type, contact.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Contact value does not match its type or uses an unsafe URL',
      });
    }
  });

export const deliveryOptionInputSchema = z.object({
  type: deliveryTypeSchema,
  instructions: z.string().trim().min(3).max(1000),
  active: z.boolean().default(true),
});

export const onboardingInputSchema = z
  .object({
    profile: profileInputSchema,
    contacts: z.array(contactInputSchema).min(1).max(10),
    deliveryOptions: z.array(deliveryOptionInputSchema).min(1).max(3),
  })
  .superRefine((input, context) => {
    if (!input.deliveryOptions.some((option) => option.active)) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryOptions'],
        message: 'At least one active delivery option is required',
      });
    }
    if (new Set(input.deliveryOptions.map((option) => option.type)).size !== input.deliveryOptions.length) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryOptions'],
        message: 'Delivery option types must be unique',
      });
    }
  });

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type DeliveryOptionInput = z.infer<typeof deliveryOptionInputSchema>;
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
