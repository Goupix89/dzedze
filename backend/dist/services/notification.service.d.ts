interface Notification {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
}
export declare class NotificationService {
    static send(userId: string, notification: Notification): Promise<void>;
}
export {};
//# sourceMappingURL=notification.service.d.ts.map