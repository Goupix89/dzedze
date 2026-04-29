import { Request, Response, NextFunction } from 'express';
export declare function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQualityTrend(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function listMissions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function createMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getMissionHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function submitMissionReport(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function startMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function completeMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function scoreMission(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateChecklist(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=mission.controller.d.ts.map