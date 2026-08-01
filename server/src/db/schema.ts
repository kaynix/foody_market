import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const sellerStatusEnum = pgEnum('seller_status', ['active', 'blocked']);
export const productStateEnum = pgEnum('product_state', ['available', 'hidden']);
export const deliveryTypeEnum = pgEnum('delivery_type', [
  'nova_poshta',
  'pickup',
  'arrangement',
]);
export const channelTargetKindEnum = pgEnum('channel_target_kind', ['seller', 'buyer']);
export const linkIntentStatusEnum = pgEnum('link_intent_status', [
  'pending',
  'confirmed',
  'consumed',
  'expired',
]);
export const applicationStatusEnum = pgEnum('application_status', [
  'new',
  'accepted',
  'rejected',
  'cancelled',
  'completed',
]);
export const outboxStateEnum = pgEnum('outbox_state', [
  'pending',
  'processing',
  'sent',
  'failed',
]);
export const deliveryAttemptStatusEnum = pgEnum('delivery_attempt_status', [
  'sent',
  'retryable_failure',
  'permanent_failure',
]);
export const auditActorKindEnum = pgEnum('audit_actor_kind', [
  'seller',
  'buyer',
  'system',
]);

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sellers = pgTable(
  'sellers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityProvider: text('identity_provider').notNull(),
    providerSubjectHash: text('provider_subject_hash').notNull(),
    status: sellerStatusEnum('status').notNull().default('active'),
    slug: text('slug').notNull(),
    storeName: text('store_name').notNull(),
    description: text('description').notNull().default(''),
    region: text('region').notNull().default(''),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('sellers_identity_subject_uq').on(
      table.identityProvider,
      table.providerSubjectHash,
    ),
    uniqueIndex('sellers_slug_uq').on(table.slug),
    check('sellers_slug_not_blank', sql`length(trim(${table.slug})) > 0`),
    check('sellers_store_name_not_blank', sql`length(trim(${table.storeName})) > 0`),
  ],
);

export const sellerSessions = pgTable(
  'seller_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('seller_sessions_token_hash_uq').on(table.tokenHash),
    index('seller_sessions_seller_idx').on(table.sellerId),
    index('seller_sessions_expiry_idx').on(table.expiresAt),
  ],
);

export const sellerPublicContacts = pgTable(
  'seller_public_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    label: text('label').notNull(),
    value: text('value').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index('seller_public_contacts_seller_idx').on(table.sellerId),
    check('seller_public_contacts_value_not_blank', sql`length(trim(${table.value})) > 0`),
    check('seller_public_contacts_sort_nonnegative', sql`${table.sortOrder} >= 0`),
  ],
);

export const sellerDeliveryOptions = pgTable(
  'seller_delivery_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    type: deliveryTypeEnum('type').notNull(),
    instructions: text('instructions').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('seller_delivery_options_seller_type_uq').on(table.sellerId, table.type),
    check(
      'seller_delivery_options_instructions_not_blank',
      sql`length(trim(${table.instructions})) > 0`,
    ),
  ],
);

export const categories = pgTable('categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    priceKopecks: integer('price_kopecks').notNull(),
    unit: text('unit').notNull(),
    minimumQuantity: integer('minimum_quantity').notNull().default(1),
    state: productStateEnum('state').notNull().default('available'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('products_seller_idx').on(table.sellerId),
    index('products_category_idx').on(table.categoryId),
    index('products_catalog_idx').on(table.state, table.deletedAt),
    check('products_name_not_blank', sql`length(trim(${table.name})) > 0`),
    check('products_price_nonnegative', sql`${table.priceKopecks} >= 0`),
    check('products_minimum_quantity_positive', sql`${table.minimumQuantity} > 0`),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    altText: text('alt_text').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('product_images_product_order_uq').on(table.productId, table.sortOrder),
    uniqueIndex('product_images_storage_key_uq').on(table.storageKey),
    check('product_images_storage_key_not_blank', sql`length(trim(${table.storageKey})) > 0`),
    check('product_images_sort_nonnegative', sql`${table.sortOrder} >= 0`),
  ],
);

export const channelLinkIntents = pgTable(
  'channel_link_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    targetKind: channelTargetKindEnum('target_kind').notNull(),
    targetId: uuid('target_id'),
    browserSecretHash: text('browser_secret_hash').notNull(),
    providerTokenHash: text('provider_token_hash').notNull(),
    confirmedDestinationEncrypted: text('confirmed_destination_encrypted'),
    destinationFingerprint: text('destination_fingerprint'),
    status: linkIntentStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('channel_link_intents_browser_secret_uq').on(table.browserSecretHash),
    uniqueIndex('channel_link_intents_provider_token_uq').on(table.providerTokenHash),
    index('channel_link_intents_expiry_idx').on(table.status, table.expiresAt),
  ],
);

export const channelActionTokens = pgTable(
  'channel_action_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    provider: text('provider').notNull(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    destinationFingerprint: text('destination_fingerprint').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    action: text('action').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('channel_action_tokens_hash_uq').on(table.tokenHash),
    uniqueIndex('channel_action_tokens_idempotency_uq').on(table.idempotencyKey),
    index('channel_action_tokens_expiry_idx').on(table.expiresAt, table.consumedAt),
  ],
);

export const channelConnections = pgTable(
  'channel_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    destinationEncrypted: text('destination_encrypted').notNull(),
    destinationFingerprint: text('destination_fingerprint').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('channel_connections_seller_provider_uq').on(table.sellerId, table.provider),
    uniqueIndex('channel_connections_primary_uq')
      .on(table.sellerId)
      .where(sql`${table.isPrimary} = true AND ${table.active} = true`),
    index('channel_connections_seller_idx').on(table.sellerId, table.active),
  ],
);

export const checkoutGroups = pgTable(
  'checkout_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buyerNameEncrypted: text('buyer_name_encrypted').notNull(),
    buyerPhoneEncrypted: text('buyer_phone_encrypted').notNull(),
    buyerChannelProvider: text('buyer_channel_provider').notNull(),
    buyerChannelDestinationEncrypted: text('buyer_channel_destination_encrypted').notNull(),
    buyerChannelFingerprint: text('buyer_channel_fingerprint').notNull(),
    trackingTokenHash: text('tracking_token_hash').notNull(),
    trackingExpiresAt: timestamp('tracking_expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '90 days'`),
    trackingRevokedAt: timestamp('tracking_revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('checkout_groups_tracking_token_uq').on(table.trackingTokenHash),
    index('checkout_groups_created_idx').on(table.createdAt),
    index('checkout_groups_tracking_expiry_idx').on(table.trackingExpiresAt, table.trackingRevokedAt),
  ],
);

export const sellerApplications = pgTable(
  'seller_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    checkoutGroupId: uuid('checkout_group_id')
      .notNull()
      .references(() => checkoutGroups.id, { onDelete: 'restrict' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    status: applicationStatusEnum('status').notNull().default('new'),
    amountKopecks: integer('amount_kopecks').notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('seller_applications_group_seller_uq').on(
      table.checkoutGroupId,
      table.sellerId,
    ),
    index('seller_applications_seller_status_idx').on(
      table.sellerId,
      table.status,
      table.createdAt,
    ),
    check('seller_applications_amount_nonnegative', sql`${table.amountKopecks} >= 0`),
  ],
);

export const applicationItems = pgTable(
  'application_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => sellerApplications.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    unitPriceKopecks: integer('unit_price_kopecks').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalKopecks: integer('line_total_kopecks').notNull(),
  },
  (table) => [
    index('application_items_application_idx').on(table.applicationId),
    check('application_items_unit_price_nonnegative', sql`${table.unitPriceKopecks} >= 0`),
    check('application_items_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'application_items_total_matches',
      sql`${table.lineTotalKopecks} = ${table.unitPriceKopecks} * ${table.quantity}`,
    ),
  ],
);

export const deliverySelections = pgTable(
  'delivery_selections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => sellerApplications.id, { onDelete: 'cascade' }),
    type: deliveryTypeEnum('type').notNull(),
    detailsEncrypted: text('details_encrypted').notNull(),
    instructionsSnapshot: text('instructions_snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('delivery_selections_application_uq').on(table.applicationId)],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    state: outboxStateEnum('state').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    retryCycle: integer('retry_cycle').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lockToken: text('lock_token'),
    lastError: text('last_error'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('outbox_events_idempotency_uq').on(table.idempotencyKey),
    index('outbox_events_claim_idx').on(table.state, table.availableAt, table.lockedUntil),
    check('outbox_events_attempt_count_nonnegative', sql`${table.attemptCount} >= 0`),
    check('outbox_events_retry_cycle_nonnegative', sql`${table.retryCycle} >= 0`),
  ],
);

export const outboxAttempts = pgTable(
  'outbox_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outboxEventId: uuid('outbox_event_id')
      .notNull()
      .references(() => outboxEvents.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: deliveryAttemptStatusEnum('status').notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('outbox_attempts_event_number_uq').on(
      table.outboxEventId,
      table.attemptNumber,
    ),
    check('outbox_attempts_number_positive', sql`${table.attemptNumber} > 0`),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorKind: auditActorKindEnum('actor_kind').notNull(),
    actorId: uuid('actor_id'),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    action: text('action').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_events_aggregate_idx').on(table.aggregateType, table.aggregateId)],
);

export const workerHeartbeats = pgTable('worker_heartbeats', {
  workerName: text('worker_name').primaryKey(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
});

export const schema = {
  sellers,
  sellerSessions,
  sellerPublicContacts,
  sellerDeliveryOptions,
  categories,
  products,
  productImages,
  channelLinkIntents,
  channelActionTokens,
  channelConnections,
  checkoutGroups,
  sellerApplications,
  applicationItems,
  deliverySelections,
  outboxEvents,
  outboxAttempts,
  auditEvents,
  workerHeartbeats,
};
