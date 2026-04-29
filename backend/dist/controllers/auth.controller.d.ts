import { Request, Response, NextFunction } from 'express';
export declare function login(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function signup(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function register(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function giveConsent(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function logout(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map