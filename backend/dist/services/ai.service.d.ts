export interface MediaAnalysis {
    qualityScore: number;
    cleanliness: number;
    completeness: number;
    anomalies: Anomaly[];
    tags: string[];
    brightness: number;
    blurScore: number;
    recommendation: string;
}
export interface Anomaly {
    type: string;
    confidence: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    bbox?: [number, number, number, number];
}
export declare class AIService {
    static analyzeMedia(mediaId: string, storageKey: string): Promise<MediaAnalysis | null>;
    static generateMissionQualityReport(missionId: string): Promise<{
        overallScore: number;
        beforeAfterComparison: any;
        issues: string[];
        recommendation: string;
    }>;
    static analyzeFrame(frameData: Buffer): Promise<{
        qualityScore: number;
        anomalies: Anomaly[];
        alerts: string[];
    }>;
    static computeAgentQualityScore(agentId: string, periodDays?: number): Promise<{
        score: number;
        trend: 'up' | 'down' | 'stable';
        details: any;
    }>;
}
//# sourceMappingURL=ai.service.d.ts.map