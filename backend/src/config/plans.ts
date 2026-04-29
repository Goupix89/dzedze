export type PlanId = 'trial' | 'essential' | 'business' | 'enterprise';

export type Feature =
  | 'missions' | 'checklist' | 'photo_upload' | 'dashboard'
  | 'agents' | 'sites' | 'notifications' | 'offline'
  | 'quality_score' | 'pdf_export'
  | 'ai_analysis' | 'video_capture' | 'live_stream' | 'audit_logs' | 'ai_report'
  | 'api_access' | 'customization';

export const BASIC_FEATURES: Feature[] = [
  'missions', 'checklist', 'photo_upload', 'dashboard',
  'agents', 'sites', 'notifications', 'offline',
  'quality_score', 'pdf_export',
];

export const ALL_FEATURES: Feature[] = [
  ...BASIC_FEATURES,
  'ai_analysis', 'video_capture', 'live_stream', 'audit_logs', 'ai_report',
];

export const ENTERPRISE_FEATURES: Feature[] = [
  ...ALL_FEATURES,
  'api_access', 'customization',
];

export interface PlanConfig {
  id:          PlanId;
  name:        string;
  priceFcfa:   number;
  agentLimit:  number;  // -1 = illimité
  siteLimit:   number;  // -1 = illimité
  features:    Feature[];
  platforms:   string[];
  trialDays?:  number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  trial: {
    id:         'trial',
    name:       'Essai gratuit',
    priceFcfa:  0,
    agentLimit: 3,
    siteLimit:  1,
    features:   BASIC_FEATURES,
    platforms:  ['android', 'web'],
    trialDays:  14,
  },
  essential: {
    id:         'essential',
    name:       'Essentiel',
    priceFcfa:  50_000,
    agentLimit: 20,
    siteLimit:  3,
    features:   BASIC_FEATURES,
    platforms:  ['android'],
  },
  business: {
    id:         'business',
    name:       'Business',
    priceFcfa:  100_000,
    agentLimit: 80,
    siteLimit:  15,
    features:   ALL_FEATURES,
    platforms:  ['android', 'ios', 'web'],
  },
  enterprise: {
    id:         'enterprise',
    name:       'Entreprise',
    priceFcfa:  200_000,
    agentLimit: -1,
    siteLimit:  -1,
    features:   ENTERPRISE_FEATURES,
    platforms:  ['android', 'ios', 'web', 'api'],
  },
};

export function getPlan(id: PlanId): PlanConfig {
  return PLANS[id] ?? PLANS.trial;
}

export function planHasFeature(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan]?.features.includes(feature) ?? false;
}
