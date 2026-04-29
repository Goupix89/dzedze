interface AuditEntry {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}
export declare class AuditService {
    static log(entry: AuditEntry): Promise<void>;
}
export {};
//# sourceMappingURL=audit.service.d.ts.map