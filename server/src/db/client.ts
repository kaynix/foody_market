import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

const runtimeDatabaseUrl =
  env.NODE_ENV === 'test' ? (env.TEST_DATABASE_URL ?? env.DATABASE_URL) : env.DATABASE_URL;

export const database = createDatabase(runtimeDatabaseUrl);

export type Database = ReturnType<typeof createDatabase>['db'];
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function inTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return database.db.transaction(operation);
}
