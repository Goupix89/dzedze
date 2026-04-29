import { Request, Response, NextFunction } from 'express';
export declare function requestStream(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function respondToStream(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function stopStream(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStreamSession(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=stream.controller.d.ts.map