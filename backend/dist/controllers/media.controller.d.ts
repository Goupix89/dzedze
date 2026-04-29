import { Request, Response, NextFunction } from 'express';
export declare const uploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMedia(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMissionMedia(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=media.controller.d.ts.map