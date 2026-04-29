import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    role: 'admin' | 'manager' | 'agent';
    orgId?: string;
    plan?: string;
}
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
export declare function requireRole(...roles: AuthPayload['role'][]): (req: Request, _res: Response, next: NextFunction) => void;
export declare function requireConsent(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map