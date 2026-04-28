import { db } from '../config/database';
import { logger } from '../utils/logger';

interface Notification {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  static async send(userId: string, notification: Notification): Promise<void> {
    try {
      const result = await db.query(
        'SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL',
        [userId]
      );

      if (!result.rows[0]?.fcm_token) return;

      // Firebase Admin SDK push (lazy-init to avoid startup failure if unconfigured)
      const admin = await import('firebase-admin');
      if (!admin.apps.length) return;

      await admin.messaging().send({
        token: result.rows[0].fcm_token,
        notification: { title: notification.title, body: notification.message },
        data: notification.data
          ? Object.fromEntries(Object.entries(notification.data).map(([k, v]) => [k, String(v)]))
          : undefined,
      });
    } catch (err) {
      logger.error(`Failed to send notification to user ${userId}:`, err);
    }
  }
}
