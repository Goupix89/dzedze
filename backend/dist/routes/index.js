"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const mission_routes_1 = __importDefault(require("./mission.routes"));
const media_routes_1 = __importDefault(require("./media.routes"));
const site_routes_1 = __importDefault(require("./site.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const audit_routes_1 = __importDefault(require("./audit.routes"));
const organization_routes_1 = __importDefault(require("./organization.routes"));
const gps_routes_1 = __importDefault(require("./gps.routes"));
const rating_routes_1 = __importDefault(require("./rating.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/org', organization_routes_1.default);
router.use('/users', user_routes_1.default);
router.use('/sites', site_routes_1.default);
router.use('/missions', mission_routes_1.default);
router.use('/media', media_routes_1.default);
router.use('/gps', gps_routes_1.default);
router.use('/', rating_routes_1.default);
router.use('/audit', audit_routes_1.default);
if (process.env.ENABLE_STREAM === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const streamRoutes = require('./stream.routes').default;
    router.use('/stream', streamRoutes);
}
if (process.env.ENABLE_AI === 'true') {
    const aiRoutes = require('./ai.routes').default;
    router.use('/ai', aiRoutes);
}
exports.default = router;
//# sourceMappingURL=index.js.map