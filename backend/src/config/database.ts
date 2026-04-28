import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

db.on('error', (err) => logger.error('Unexpected database error:', err));

export async function connectDatabase(): Promise<void> {
  const client = await db.connect();
  client.release();
  logger.info('Database connected');
}
