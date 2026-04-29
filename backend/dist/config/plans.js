"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANS = exports.ENTERPRISE_FEATURES = exports.ALL_FEATURES = exports.BASIC_FEATURES = void 0;
exports.getPlan = getPlan;
exports.planHasFeature = planHasFeature;
exports.BASIC_FEATURES = [
    'missions', 'checklist', 'photo_upload', 'dashboard',
    'agents', 'sites', 'notifications', 'offline',
    'quality_score', 'pdf_export',
];
exports.ALL_FEATURES = [
    ...exports.BASIC_FEATURES,
    'ai_analysis', 'video_capture', 'live_stream', 'audit_logs', 'ai_report',
];
exports.ENTERPRISE_FEATURES = [
    ...exports.ALL_FEATURES,
    'api_access', 'customization',
];
exports.PLANS = {
    trial: {
        id: 'trial',
        name: 'Essai gratuit',
        priceFcfa: 0,
        agentLimit: 3,
        siteLimit: 1,
        features: exports.BASIC_FEATURES,
        platforms: ['android', 'web'],
        trialDays: 14,
    },
    essential: {
        id: 'essential',
        name: 'Essentiel',
        priceFcfa: 50000,
        agentLimit: 20,
        siteLimit: 3,
        features: exports.BASIC_FEATURES,
        platforms: ['android'],
    },
    business: {
        id: 'business',
        name: 'Business',
        priceFcfa: 100000,
        agentLimit: 80,
        siteLimit: 15,
        features: exports.ALL_FEATURES,
        platforms: ['android', 'ios', 'web'],
    },
    enterprise: {
        id: 'enterprise',
        name: 'Entreprise',
        priceFcfa: 200000,
        agentLimit: -1,
        siteLimit: -1,
        features: exports.ENTERPRISE_FEATURES,
        platforms: ['android', 'ios', 'web', 'api'],
    },
};
function getPlan(id) {
    return exports.PLANS[id] ?? exports.PLANS.trial;
}
function planHasFeature(plan, feature) {
    return exports.PLANS[plan]?.features.includes(feature) ?? false;
}
//# sourceMappingURL=plans.js.map