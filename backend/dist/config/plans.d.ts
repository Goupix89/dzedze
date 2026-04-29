export type PlanId = 'trial' | 'essential' | 'business' | 'enterprise';
export type Feature = 'missions' | 'checklist' | 'photo_upload' | 'dashboard' | 'agents' | 'sites' | 'notifications' | 'offline' | 'quality_score' | 'pdf_export' | 'ai_analysis' | 'video_capture' | 'live_stream' | 'audit_logs' | 'ai_report' | 'api_access' | 'customization';
export declare const BASIC_FEATURES: Feature[];
export declare const ALL_FEATURES: Feature[];
export declare const ENTERPRISE_FEATURES: Feature[];
export interface PlanConfig {
    id: PlanId;
    name: string;
    priceFcfa: number;
    agentLimit: number;
    siteLimit: number;
    features: Feature[];
    platforms: string[];
    trialDays?: number;
}
export declare const PLANS: Record<PlanId, PlanConfig>;
export declare function getPlan(id: PlanId): PlanConfig;
export declare function planHasFeature(plan: PlanId, feature: Feature): boolean;
//# sourceMappingURL=plans.d.ts.map