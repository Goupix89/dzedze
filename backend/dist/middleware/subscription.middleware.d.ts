import { Request, Response, NextFunction } from 'express';
import { Feature } from '../config/plans';
export declare function requireFeature(feature: Feature): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare function checkQuota(resource: 'agents' | 'sites'): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare function loadOrgContext(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=subscription.middleware.d.ts.map